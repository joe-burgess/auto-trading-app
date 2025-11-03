// Unified Auto Trading System - Buy Low, Sell High
const BTCBuyingSystem = require('./btc-buyer');
const CoinbaseTrader = require('./btc-trader');
const ProfitTracker = require('./profit-tracker');
const TimingController = require('./timing-controller');
const TelegramNotifier = require('./telegram-notifier');

class UnifiedTradingSystem {
  constructor(config = {}) {
    this.config = {
      // Overall trading settings
      enabled: config.enabled !== false,
      dryRun: config.dryRun !== false,
      sandbox: config.sandbox === true,
      
      // Buy configuration
      buying: {
        enabled: config.buying?.enabled !== false,
        priceThreshold: config.buying?.priceThreshold || 80000, // Buy below £80,000
        percentageDrop: config.buying?.percentageDrop || 3,    // Buy on 3% drops
        maxBuyAmount: config.buying?.maxBuyAmount || 50,       // £50 per buy
        maxDailyBuying: config.buying?.maxDailyBuying || 200,  // £200 per day
        postSellDropThreshold: config.buying?.postSellDropThreshold || 10, // £10 drop after sell
      },
      
      // Sell configuration
      selling: {
        enabled: config.selling?.enabled !== false,
        priceThreshold: config.selling?.priceThreshold || 90000, // Sell above £90,000
        percentageGain: config.selling?.percentageGain || 5,     // Sell on 5% gains
        maxSellAmount: config.selling?.maxSellAmount || 0.01,    // 0.01 BTC per sell
        minSellAmount: config.selling?.minSellAmount || 0.001,   // 0.001 BTC minimum
        randomizeAmount: config.selling?.randomizeAmount !== false, // Enable randomization
        maxDailySellTrades: config.selling?.maxDailySellTrades || 1, // Max sells per day
        profitTarget: config.selling?.profitTarget || 10,        // Sell when £10 profit reached
        btcProfitTarget: config.selling?.btcProfitTarget || 10,  // BTC profit target
      },
      
      // Strategy settings
      strategy: {
        buyLowSellHigh: config.strategy?.buyLowSellHigh !== false,
        dollarCostAveraging: config.strategy?.dollarCostAveraging || false,
        profitTaking: config.strategy?.profitTaking !== false,
        stopLoss: config.strategy?.stopLoss || false,
        stopLossPercent: config.strategy?.stopLossPercent || 10, // 10% stop loss
      },
      
      // Monitoring settings
      monitoring: {
        interval: config.monitoring?.interval || 60000, // 1 minute (fallback)
        enableAlerts: config.monitoring?.enableAlerts !== false,
        logAllDecisions: config.monitoring?.logAllDecisions !== false,
        
        // Randomized polling to avoid detection
        randomPolling: {
          enabled: config.monitoring?.randomPolling?.enabled !== false, // Enable by default
          minInterval: config.monitoring?.randomPolling?.minInterval || 2 * 60 * 1000,    // 2 minutes minimum
          maxInterval: config.monitoring?.randomPolling?.maxInterval || 8 * 60 * 1000,    // 8 minutes maximum
          minGapBetweenChecks: config.monitoring?.randomPolling?.minGapBetweenChecks || 90 * 1000, // 90 seconds minimum gap
        },
        
        // Telegram price alerts
        telegramAlerts: {
          enabled: config.monitoring?.telegramAlerts?.enabled !== false,
          priceDropAlert: config.monitoring?.telegramAlerts?.priceDropAlert || 81000,   // Alert when BTC drops to £81,000
          priceRiseAlert: config.monitoring?.telegramAlerts?.priceRiseAlert || 85000,   // Alert when BTC rises to £85,000
          significantDropPercent: config.monitoring?.telegramAlerts?.significantDropPercent || 5, // Alert on 5% drops
          significantRisePercent: config.monitoring?.telegramAlerts?.significantRisePercent || 5  // Alert on 5% rises
        },
      },
      
      // Safety limits
      safety: {
        maxDailyTrades: config.safety?.maxDailyTrades || 10,
        cooldownBetweenTrades: config.safety?.cooldownBetweenTrades || 300000, // 5 minutes
        requireManualApproval: config.safety?.requireManualApproval || false,
      }
    };
    
    // Initialize subsystems
    this.buyer = new BTCBuyingSystem({
      dryRun: this.config.dryRun,
      sandbox: this.config.sandbox,
      buyTriggers: {
        enabled: this.config.buying.enabled,
        priceThreshold: this.config.buying.priceThreshold,
        percentageDrop: this.config.buying.percentageDrop,
        postSellDropThreshold: this.config.buying.postSellDropThreshold,
      },
      limits: {
        maxBuyAmount: this.config.buying.maxBuyAmount,
        maxDailyBuying: this.config.buying.maxDailyBuying,
      }
    });
    
    this.seller = new CoinbaseTrader({
      dryRun: this.config.dryRun,
      sandbox: this.config.sandbox,
      maxTradeAmount: this.config.selling.maxSellAmount,
    });
    
    this.profitTracker = new ProfitTracker({
      profitThreshold: this.config.selling.profitTarget,
    });
    
    // Initialize timing controller for human-like behavior
    this.timingController = new TimingController(this.config.timing || {});
    
    // Initialize Telegram notifier if enabled
    this.telegramNotifier = null;
    if (this.config.monitoring.telegramAlerts.enabled) {
      try {
        // Load Telegram config
        const fs = require('fs');
        const path = require('path');
        const telegramConfigPath = path.join(__dirname, 'config', 'telegram-config.json');
        
        if (fs.existsSync(telegramConfigPath)) {
          this.telegramConfig = JSON.parse(fs.readFileSync(telegramConfigPath, 'utf8'));
          
          if (this.telegramConfig.botToken && this.telegramConfig.chatId && 
              this.telegramConfig.botToken !== 'YOUR_BOT_TOKEN_HERE' && 
              this.telegramConfig.chatId !== 'YOUR_CHAT_ID_HERE') {
            
            this.telegramNotifier = new TelegramNotifier(this.telegramConfig.botToken, this.telegramConfig.chatId);
            console.log('📱 Telegram alerts enabled');
          } else {
            console.log('⚠️ Telegram configuration incomplete, continuing without alerts');
            this.config.monitoring.telegramAlerts.enabled = false;
          }
        } else {
          console.log('⚠️ Telegram config file not found, continuing without alerts');
          this.config.monitoring.telegramAlerts.enabled = false;
        }
      } catch (error) {
        console.log('⚠️ Telegram setup not configured, continuing without alerts');
        this.config.monitoring.telegramAlerts.enabled = false;
      }
    }
    
    this.monitoring = false;
    this.lastTradeTime = 0;
    this.lastCheckTime = 0; // Track when we last checked prices
    this.recentHigh = 0;
    this.recentLow = Infinity;
    this.buyPrice = 0; // Track average buy price
    this.previousPrice = 0; // Track previous price for change calculation
    
    // Price alert tracking
    this.alertHistory = {
      lastDropAlert: 0,
      lastRiseAlert: 0,
      dailyDrops: 0,
      dailyRises: 0,
      lastAlertReset: new Date().toDateString()
    };
  }

  /**
   * Format time duration in a human-readable way
   */
  formatTime(milliseconds) {
    const totalMinutes = Math.round(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0 && minutes > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }

  /**
   * Enhanced price alerts with multi-threshold support
   */
  async checkPriceAlerts(currentPrice, priceChangePercent) {
    if (!this.config.monitoring.telegramAlerts.enabled || !this.telegramNotifier) {
      return;
    }
    
    // Load threshold configuration from telegram config
    try {
      const fs = require('fs');
      const path = require('path');
      const telegramConfigPath = path.join(__dirname, 'config', 'telegram-config.json');
      
      if (!fs.existsSync(telegramConfigPath)) {
        console.log('⚠️ Telegram config file not found, using basic alerts');
        return this.checkBasicPriceAlerts(currentPrice, priceChangePercent);
      }
      
      const telegramConfig = JSON.parse(fs.readFileSync(telegramConfigPath, 'utf8'));
      const thresholds = telegramConfig.alerts?.priceThresholds;
      
      if (!thresholds?.enabled) {
        return this.checkBasicPriceAlerts(currentPrice, priceChangePercent);
      }
      
      await this.checkMultiThresholdAlerts(currentPrice, priceChangePercent, thresholds);
      
    } catch (error) {
      console.log('⚠️ Error loading threshold config:', error.message);
      return this.checkBasicPriceAlerts(currentPrice, priceChangePercent);
    }
  }

  /**
   * Check multi-threshold alerts
   */
  async checkMultiThresholdAlerts(currentPrice, priceChangePercent, thresholds) {
    const now = Date.now();
    
    // Initialize alert tracking if needed
    if (!this.thresholdAlertHistory) {
      this.thresholdAlertHistory = {
        triggeredDrops: new Set(),
        triggeredRises: new Set(),
        lastPercentageAlert: 0,
        dailyAlerts: 0,
        lastDayReset: new Date().toDateString()
      };
    }
    
    // Reset daily counters if new day
    const today = new Date().toDateString();
    if (this.thresholdAlertHistory.lastDayReset !== today) {
      this.thresholdAlertHistory.dailyAlerts = 0;
      this.thresholdAlertHistory.lastDayReset = today;
    }
    
    // Check drop thresholds
    if (thresholds.dropThresholds) {
      for (const threshold of thresholds.dropThresholds) {
        if (currentPrice <= threshold.price && 
            !this.thresholdAlertHistory.triggeredDrops.has(threshold.price)) {
          
          // Send alert
          await this.sendThresholdAlert('drop', currentPrice, threshold);
          this.thresholdAlertHistory.triggeredDrops.add(threshold.price);
          this.thresholdAlertHistory.dailyAlerts++;
          
          // Schedule cooldown reset
          setTimeout(() => {
            this.thresholdAlertHistory.triggeredDrops.delete(threshold.price);
          }, threshold.cooldown || 3600000); // Default 1 hour cooldown
        }
      }
    }
    
    // Check rise thresholds
    if (thresholds.riseThresholds) {
      for (const threshold of thresholds.riseThresholds) {
        if (currentPrice >= threshold.price && 
            !this.thresholdAlertHistory.triggeredRises.has(threshold.price)) {
          
          // Send alert
          await this.sendThresholdAlert('rise', currentPrice, threshold);
          this.thresholdAlertHistory.triggeredRises.add(threshold.price);
          this.thresholdAlertHistory.dailyAlerts++;
          
          // Schedule cooldown reset
          setTimeout(() => {
            this.thresholdAlertHistory.triggeredRises.delete(threshold.price);
          }, threshold.cooldown || 3600000); // Default 1 hour cooldown
        }
      }
    }
    
    // Check percentage-based alerts
    if (thresholds.percentageAlerts?.enabled && Math.abs(priceChangePercent) >= 3) {
      const percentCooldown = thresholds.percentageAlerts.cooldown || 1800000; // 30 minutes
      
      if ((now - this.thresholdAlertHistory.lastPercentageAlert) > percentCooldown) {
        const isSignificantDrop = priceChangePercent <= -thresholds.percentageAlerts.significantDrop;
        const isSignificantRise = priceChangePercent >= thresholds.percentageAlerts.significantRise;
        
        if (isSignificantDrop || isSignificantRise) {
          await this.sendPercentageAlert(currentPrice, priceChangePercent, isSignificantDrop);
          this.thresholdAlertHistory.lastPercentageAlert = now;
          this.thresholdAlertHistory.dailyAlerts++;
        }
      }
    }
  }

  /**
   * Send threshold-based alert
   */
  async sendThresholdAlert(type, currentPrice, threshold) {
    try {
      const alertData = {
        type: `threshold_${type}`,
        price: currentPrice,
        threshold: threshold.price,
        priority: threshold.priority || 'medium',
        message: threshold.message || `BTC ${type} alert: £${currentPrice.toLocaleString()}`,
        timestamp: new Date().toISOString()
      };
      
      await this.telegramNotifier.sendPriceAlert(alertData);
      console.log(`📱 ${threshold.priority?.toUpperCase() || 'MEDIUM'} Alert sent: ${threshold.message}`);
      
    } catch (error) {
      console.error('❌ Failed to send threshold alert:', error.message);
    }
  }

  /**
   * Send percentage-based alert
   */
  async sendPercentageAlert(currentPrice, percentChange, isDrop) {
    try {
      const direction = isDrop ? 'dropped' : 'rose';
      const emoji = isDrop ? '📉' : '📈';
      const message = `${emoji} BTC ${direction} ${Math.abs(percentChange).toFixed(1)}% to £${currentPrice.toLocaleString()}`;
      
      const alertData = {
        type: isDrop ? 'significant_drop' : 'significant_rise',
        price: currentPrice,
        percentChange: percentChange,
        message: message,
        priority: Math.abs(percentChange) >= 10 ? 'urgent' : 'high',
        timestamp: new Date().toISOString()
      };
      
      await this.telegramNotifier.sendPriceAlert(alertData);
      console.log(`📱 Percentage Alert sent: ${message}`);
      
    } catch (error) {
      console.error('❌ Failed to send percentage alert:', error.message);
    }
  }

  /**
   * Fallback to basic price alerts (original system)
   */
  async checkBasicPriceAlerts(currentPrice, priceChangePercent) {
    if (!this.config.monitoring.telegramAlerts.enabled || !this.telegramNotifier) {
      return;
    }
    
    const today = new Date().toDateString();
    
    // Reset daily counters if new day
    if (this.alertHistory.lastAlertReset !== today) {
      this.alertHistory.dailyDrops = 0;
      this.alertHistory.dailyRises = 0;
      this.alertHistory.lastAlertReset = today;
    }
    
    const config = this.config.monitoring.telegramAlerts;
    const cooldownPeriod = 30 * 60 * 1000; // 30 minutes between similar alerts
    const now = Date.now();
    
    try {
      // Check for specific price threshold alerts
      if (currentPrice <= config.priceDropAlert && 
          (now - this.alertHistory.lastDropAlert) > cooldownPeriod) {
        
        await this.telegramNotifier.sendPriceAlert({
          type: 'threshold_drop',
          price: currentPrice,
          threshold: config.priceDropAlert,
          message: `🚨 BTC Price Alert! Bitcoin has dropped to £${currentPrice.toLocaleString()}\n\nThis is at your £${config.priceDropAlert.toLocaleString()} alert threshold. Consider your trading strategy.`
        });
        
        this.alertHistory.lastDropAlert = now;
        this.alertHistory.dailyDrops++;
        console.log(`📱 Sent Telegram price drop alert: £${currentPrice.toLocaleString()}`);
      }
      
      if (currentPrice >= config.priceRiseAlert && 
          (now - this.alertHistory.lastRiseAlert) > cooldownPeriod) {
        
        await this.telegramNotifier.sendPriceAlert({
          type: 'threshold_rise',
          price: currentPrice,
          threshold: config.priceRiseAlert,
          message: `📈 BTC Price Alert! Bitcoin has risen to £${currentPrice.toLocaleString()}\n\nThis is at your £${config.priceRiseAlert.toLocaleString()} alert threshold. Consider your trading strategy.`
        });
        
        this.alertHistory.lastRiseAlert = now;
        this.alertHistory.dailyRises++;
        console.log(`📱 Sent Telegram price rise alert: £${currentPrice.toLocaleString()}`);
      }
      
      // Check for significant percentage changes
      if (Math.abs(priceChangePercent) >= config.significantDropPercent && this.previousPrice > 0) {
        const alertType = priceChangePercent < 0 ? 'significant_drop' : 'significant_rise';
        const lastAlertKey = priceChangePercent < 0 ? 'lastDropAlert' : 'lastRiseAlert';
        
        if ((now - this.alertHistory[lastAlertKey]) > cooldownPeriod) {
          const emoji = priceChangePercent < 0 ? '📉' : '📈';
          const direction = priceChangePercent < 0 ? 'dropped' : 'risen';
          
          await this.telegramNotifier.sendPriceAlert({
            type: alertType,
            price: currentPrice,
            previousPrice: this.previousPrice,
            changePercent: priceChangePercent,
            message: `${emoji} Significant Price Movement!\n\nBTC has ${direction} by ${Math.abs(priceChangePercent).toFixed(2)}%\nFrom £${this.previousPrice.toLocaleString()} to £${currentPrice.toLocaleString()}`
          });
          
          this.alertHistory[lastAlertKey] = now;
          console.log(`📱 Sent significant ${direction} alert: ${priceChangePercent.toFixed(2)}%`);
        }
      }
      
    } catch (error) {
      console.log('⚠️ Failed to send Telegram alert:', error.message);
    }
  }

  /**
   * Generate randomized sell amount
   */
  getRandomizedSellAmount(availableBtc) {
    const maxAmount = Math.min(this.config.selling.maxSellAmount, availableBtc);
    const minAmount = Math.min(this.config.selling.minSellAmount, maxAmount);
    
    if (!this.config.selling.randomizeAmount) {
      return maxAmount; // Return fixed amount if randomization disabled
    }
    
    // Generate random amount between min and max
    const randomAmount = Math.random() * (maxAmount - minAmount) + minAmount;
    
    // Round to 6 decimal places for BTC precision
    return Math.round(randomAmount * 1000000) / 1000000;
  }

  /**
   * Main trading logic - analyze and execute trades
   */
  async analyzeTradingOpportunity() {
    try {
      const priceData = await this.buyer.getCurrentPrice();
      const balances = await this.buyer.getAccountBalances();
      
      // Update profit tracker with current balances and prices
      this.profitTracker.recordBalance(balances, 'analysis', priceData.price);
      const currentProfit = this.profitTracker.getCurrentProfit();
      
      // Calculate price change from previous check
      const priceChange = this.previousPrice > 0 ? priceData.price - this.previousPrice : 0;
      const priceChangePercent = this.previousPrice > 0 ? ((priceChange / this.previousPrice) * 100) : 0;
      
      // Check for price alerts (only if we have a previous price to compare)
      if (this.previousPrice > 0) {
        await this.checkPriceAlerts(priceData.price, priceChangePercent);
      }
      
      // Update price tracking
      if (priceData.price > this.recentHigh) {
        this.recentHigh = priceData.price;
      }
      if (priceData.price < this.recentLow) {
        this.recentLow = priceData.price;
      }
      
      const analysis = {
        timestamp: new Date().toISOString(),
        price: priceData.price,
        priceData: priceData,  // Include full price data for timing controller
        priceChange: priceChange,
        priceChangePercent: priceChangePercent,
        previousPrice: this.previousPrice,
        balances,
        currentProfit,
        recentHigh: this.recentHigh,
        recentLow: this.recentLow,
        decisions: {
          shouldBuy: false,
          shouldSell: false,
          reasons: []
        }
      };
      
      // Check buying opportunities
      if (this.config.buying.enabled) {
        const buyConditions = await this.buyer.checkBuyingConditions(priceData);
        if (buyConditions.shouldBuy && this.canTrade()) {
          analysis.decisions.shouldBuy = true;
          analysis.decisions.reasons.push('Buy conditions met');
        }
      }
      
      // Check selling opportunities
      if (this.config.selling.enabled && balances.BTC?.available > 0) {
        const sellReasons = this.checkSellConditions(priceData, balances, currentProfit);
        if (sellReasons.length > 0 && this.canTrade()) {
          analysis.decisions.shouldSell = true;
          analysis.decisions.reasons.push(...sellReasons);
        }
      }
      
      // Log analysis if configured
      if (this.config.monitoring.logAllDecisions) {
        const priceDirection = priceChange > 0 ? '📈' : priceChange < 0 ? '📉' : '➡️';
        const changeStr = this.previousPrice > 0 
          ? ` (${priceDirection} ${priceChange >= 0 ? '+' : ''}£${priceChange.toFixed(2)} / ${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`
          : '';
        
        // Get initial balance for comparison  
        const initialBalance = this.profitTracker.config.initialBalance || 250.00;
        
        // Get baseline values from the reset record (first balance record)
        const firstBalanceRecord = this.profitTracker.balanceHistory.length > 0 
          ? this.profitTracker.balanceHistory[0] 
          : null;
          
        let baselineBtcValue, baselineBtcPrice;
        if (firstBalanceRecord && firstBalanceRecord.source === 'automated-reset' && firstBalanceRecord.resetBaseline) {
          // Use the stored baseline from reset
          baselineBtcValue = firstBalanceRecord.resetBaseline.btcBaselineValue;
          baselineBtcPrice = firstBalanceRecord.resetBaseline.btcBaselinePrice;
        } else {
          // Fallback for older resets without baseline tracking
          baselineBtcValue = firstBalanceRecord ? firstBalanceRecord.btcValueInGbp : 200.00;
          baselineBtcPrice = firstBalanceRecord ? firstBalanceRecord.btcPrice : 20000;
        }
          
        const currentBtcValue = balances.BTC?.available * priceData.price || 0;
        const btcHoldings = balances.BTC?.available || 0;
        const gbpHoldings = balances.GBP?.available || 0;
        
        // Calculate appreciation from baseline
        const btcAppreciation = currentBtcValue - baselineBtcValue;
        const valueIncrease = btcAppreciation; // Only show appreciation from baseline
        const btcIncrease = 0; // No BTC quantity changes yet (only price appreciation)
        
        // Check current trading status with emergency override consideration
        const buyAllowed = this.timingController.isTradingAllowed(priceData, 'buy');
        const sellAllowed = this.timingController.isTradingAllowed(priceData, 'sell');
        
        let tradingStatus;
        if (buyAllowed && sellAllowed) {
          tradingStatus = '✅ Active Trading';
        } else if (sellAllowed && !buyAllowed) {
          tradingStatus = '🚨 Emergency Sell Only';
        } else {
          tradingStatus = '⏸️ Queued (Outside Hours)';
        }
        
        // Calculate distance to sell trigger
        const profitTarget = this.config.selling.profitTarget;
        const profitNeeded = profitTarget - currentProfit;
        const sellDistance = profitNeeded > 0 
          ? `£${profitNeeded.toFixed(2)} needed (${((profitNeeded / profitTarget) * 100).toFixed(1)}% to target)`
          : '✅ Target reached';
        
        // Calculate selling fees if we were to sell now
        const btcValueForFees = btcHoldings * priceData.price;
        const tradingFee = btcValueForFees * (this.config.fees?.trading?.taker || 0.005); // 0.5% trading fee
        const spreadCost = btcValueForFees * (this.config.fees?.spread || 0.0025); // 0.25% spread
        const withdrawalFee = this.config.fees?.withdrawal?.gbp || 0.15; // £0.15 withdrawal
        const totalFees = tradingFee + spreadCost + withdrawalFee;
        const netProfit = currentProfit - totalFees;
        const feeInfo = `£${totalFees.toFixed(2)} fees (${((totalFees / btcValueForFees) * 100).toFixed(2)}%)`;
        const profitAfterSelling = netProfit > 0 
          ? `+£${netProfit.toFixed(2)} profit` 
          : `£${Math.abs(netProfit).toFixed(2)} loss`;

        // Calculate target BTC price needed to achieve £10 profit after fees
        const targetNetProfit = this.config.selling.profitTarget; // £10
        const feeRate = (this.config.fees?.trading?.taker || 0.005) + (this.config.fees?.spread || 0.0025); // Combined fee percentage
        
        // Required gross profit = target net profit + fees
        // Since fees depend on sale value, we need to solve: gross_profit - (sale_value * fee_rate + withdrawal_fee) = target_net_profit
        // Where sale_value = baseline_btc_value + gross_profit
        // Solving: gross_profit = (target_net_profit + withdrawal_fee + baseline_btc_value * fee_rate) / (1 - fee_rate)
        const requiredGrossProfit = (targetNetProfit + withdrawalFee + baselineBtcValue * feeRate) / (1 - feeRate);
        const targetBtcValue = baselineBtcValue + requiredGrossProfit;
        const targetBtcPrice = targetBtcValue / btcHoldings;
        
        const targetPriceInfo = btcHoldings > 0 
          ? `£${targetBtcPrice.toFixed(2)} BTC price needed (${((targetBtcPrice - priceData.price) / priceData.price * 100).toFixed(1)}% rise)`
          : 'No BTC to sell';

        // Calculate total GBP amount needed from sale (profit + fees + baseline)
        const targetSaleAmount = btcHoldings > 0 ? targetBtcValue : 0;
        const targetSaleInfo = btcHoldings > 0 
          ? `£${targetSaleAmount.toFixed(2)} sale needed (£${targetNetProfit.toFixed(2)} profit + £${(requiredGrossProfit - targetNetProfit).toFixed(2)} fees + £${baselineBtcValue.toFixed(2)} baseline)`
          : 'No BTC to sell';
          
        console.log(`\n[${new Date().toLocaleTimeString()}] 📊 Trading Analysis:`);
        console.log('─'.repeat(60));
        console.log(`💰 Current Price: £${priceData.price.toLocaleString()}${changeStr}`);
        console.log(`📈 Trading Status: ${tradingStatus}`);
        console.log('');
        console.log('📦 Holdings:');
        console.log(`   ₿ BTC: ${btcHoldings} BTC (£${baselineBtcValue.toFixed(2)} + £${btcAppreciation.toFixed(2)} appreciation)`);
        console.log(`   💷 GBP: £${gbpHoldings.toFixed(2)}`);
        console.log(`   📊 Value Change: +£${valueIncrease.toFixed(2)}`);
        console.log('');
        console.log('💵 Profit Analysis:');
        console.log(`   🔄 Current Profit: £${currentProfit.toFixed(2)} (unrealized)`);
        console.log(`   🎯 ${sellDistance}`);
        console.log(`   📍 ${targetPriceInfo}`);
        console.log(`   💰 ${targetSaleInfo}`);
        console.log('');
        console.log('💸 Selling Impact:');
        console.log(`   📋 ${feeInfo}`);
        console.log(`   💡 Result: ${profitAfterSelling}`);
        console.log('');
        console.log('🤖 Decisions:');
        console.log(`   🛒 Should Buy: ${analysis.decisions.shouldBuy ? '✅ Yes' : '❌ No'}`);
        console.log(`   💰 Should Sell: ${analysis.decisions.shouldSell ? '✅ Yes' : '❌ No'}`);
        if (analysis.decisions.reasons && analysis.decisions.reasons.length > 0) {
          console.log(`   📝 Reasons: ${analysis.decisions.reasons.join(', ')}`);
        }
        console.log('─'.repeat(60));
      }
      
      // Update previous price for next comparison
      this.previousPrice = priceData.price;
      
      return analysis;
      
    } catch (error) {
      console.error('❌ Trading analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Check conditions for selling
   */
  checkSellConditions(priceData, balances, currentProfit) {
    const reasons = [];
    
    // Price threshold selling
    if (priceData.price >= this.config.selling.priceThreshold) {
      reasons.push(`Price above £${this.config.selling.priceThreshold.toLocaleString()}`);
    }
    
    // Calculate fees for net profit calculation
    const currentBtcValue = balances.BTC?.available * priceData.price || 0;
    const tradingFee = currentBtcValue * (this.config.fees?.trading?.taker || 0.005);
    const spreadCost = currentBtcValue * (this.config.fees?.spread || 0.0025);
    const withdrawalFee = this.config.fees?.withdrawal?.gbp || 0.15;
    const totalFees = tradingFee + spreadCost + withdrawalFee;
    const netProfit = currentProfit - totalFees;
    
    // Profit target reached (NET profit after fees)
    if (netProfit >= this.config.selling.profitTarget) {
      reasons.push(`Net profit target £${this.config.selling.profitTarget} reached (after £${totalFees.toFixed(2)} fees)`);
    }
    
    // BTC holdings profit target (value increase after fees)
    if (this.config.selling.btcProfitTarget && balances.BTC?.available > 0) {
      const currentBtcValue = balances.BTC.available * priceData.price;
      const initialBtcValue = this.profitTracker.config.initialBalance || 50.012315; // fallback to known initial
      const btcGain = currentBtcValue - initialBtcValue;
      
      // Estimate selling fees to ensure net profit meets target
      const estimatedSellFees = currentBtcValue * (0.005 + 0.0025) + 0.15; // trading + spread + withdrawal
      const netBtcProfit = btcGain - estimatedSellFees;
      
      if (netBtcProfit >= this.config.selling.btcProfitTarget) {
        reasons.push(`BTC profit target £${this.config.selling.btcProfitTarget} reached (net: £${netBtcProfit.toFixed(2)})`);
      }
    }
    
    // Percentage gain from recent low
    if (this.recentLow < Infinity) {
      const gainPercent = ((priceData.price - this.recentLow) / this.recentLow) * 100;
      if (gainPercent >= this.config.selling.percentageGain) {
        reasons.push(`${gainPercent.toFixed(1)}% gain from recent low`);
      }
    }
    
    // Stop loss (if enabled)
    if (this.config.strategy.stopLoss && this.recentHigh > 0) {
      const dropPercent = ((this.recentHigh - priceData.price) / this.recentHigh) * 100;
      if (dropPercent >= this.config.strategy.stopLossPercent) {
        reasons.push(`Stop loss triggered: ${dropPercent.toFixed(1)}% drop`);
      }
    }
    
    return reasons;
  }

  /**
   * Check if we can trade (safety limits)
   */
  canTrade() {
    const now = Date.now();
    const timeSinceLastTrade = now - this.lastTradeTime;
    
    if (timeSinceLastTrade < this.config.safety.cooldownBetweenTrades) {
      return false;
    }
    
    // Check daily trade limit
    const todaysTrades = this.getTodaysTradeCount();
    if (todaysTrades >= this.config.safety.maxDailyTrades) {
      return false;
    }
    
    return true;
  }

  /**
   * Execute automated trading cycle
   */
  async executeAutomatedTrading() {
    try {
      const analysis = await this.analyzeTradingOpportunity();
      if (!analysis) return false;
      
      let executed = false;
      
      // Execute buy if conditions met
      if (analysis.decisions.shouldBuy) {
        const buyAmount = this.buyer.getRandomizedBuyAmount();
        const requireManualApproval = this.config.safety.requireManualApproval || 
          (this.telegramConfig?.alerts?.manualApproval?.enabled && this.telegramConfig?.alerts?.manualApproval?.requireBuyApproval);
        
        if (requireManualApproval) {
          console.log('🤖 Buy opportunity detected, but manual approval required');
          console.log('   Reasons:', analysis.decisions.reasons.join(', '));
          
          // Send Telegram buy confirmation request
          if (this.telegramNotifier) {
            await this.telegramNotifier.sendBuyConfirmation(buyAmount, analysis.priceData.price, false);
          }
        } else {
          console.log('🛒 Buy opportunity detected - scheduling with human-like timing...');
          const buyAction = async () => {
            const result = await this.buyer.executeBTCPurchase(
              buyAmount, 
              'automated: ' + analysis.decisions.reasons.join(', ')
            );
            
            // Send Telegram buy notification
            if (this.telegramNotifier) {
              await this.telegramNotifier.sendBuyNotification(buyAmount, analysis.priceData.price, 'executed');
            }
            
            return result;
          };
          
          const scheduled = await this.timingController.scheduleAction(
            'buy_' + Date.now(),
            buyAction,
            'buy',
            analysis.priceData
          );
          
          if (scheduled) {
            executed = true;
          }
        }
      }
      
      // Execute sell if conditions met (and we didn't just buy)
      if (analysis.decisions.shouldSell && !executed) {
        const balances = await this.buyer.getAccountBalances();
        const sellAmount = this.getRandomizedSellAmount(balances.BTC?.available || 0);
        const currentProfit = this.profitTracker.getCurrentProfit();
        const requireManualApproval = this.config.safety.requireManualApproval || 
          (this.telegramConfig?.alerts?.manualApproval?.enabled && this.telegramConfig?.alerts?.manualApproval?.requireSellApproval);
        
        if (requireManualApproval) {
          console.log('🤖 Sell opportunity detected, but manual approval required');
          console.log('   Reasons:', analysis.decisions.reasons.join(', '));
          
          // Send Telegram sell confirmation request
          if (this.telegramNotifier) {
            await this.telegramNotifier.sendSellConfirmation(sellAmount, analysis.priceData.price, currentProfit, false);
          }
        } else {
          console.log('💰 Sell opportunity detected - scheduling with human-like timing...');
          
          const sellAction = async () => {
            const withdrawalOptions = {
              confirmTrade: true,
              withdrawToBank: this.config.selling.autoWithdrawToBank,
              minWithdrawalAmount: this.config.selling.minWithdrawalAmount,
              withdrawalDelay: this.config.selling.withdrawalDelay,
              keepMinimumGbpBalance: this.config.selling.keepMinimumGbpBalance
            };
            
            const result = await this.seller.executeBTCtoGBP(sellAmount, withdrawalOptions);
            
            // Send Telegram sell notification
            if (this.telegramNotifier) {
              await this.telegramNotifier.sendSellNotification(sellAmount, analysis.priceData.price, currentProfit, 'executed');
            }
            
            return result;
          };
          
          const scheduled = await this.timingController.scheduleAction(
            'sell_' + Date.now(),
            sellAction,
            'sell',
            analysis.priceData
          );
          
          if (scheduled) {
            executed = true;
          }
        }
      }
      
      if (executed) {
        this.lastTradeTime = Date.now();
      }
      
      return executed;
      
    } catch (error) {
      console.error('❌ Automated trading execution failed:', error.message);
      return false;
    }
  }

  /**
   * Start continuous monitoring and trading
   */
  startAutomatedTrading() {
    if (this.monitoring) {
      console.log('⚠️ Automated trading is already running');
      return;
    }

    console.log('🤖 Starting Unified Auto Trading System...');
    console.log('📊 Configuration:');
    console.log(`   Buy below: £${this.config.buying.priceThreshold.toLocaleString()}`);
    console.log(`   Sell above: £${this.config.selling.priceThreshold.toLocaleString()}`);
    console.log(`   Profit target: £${this.config.selling.profitTarget}`);
    console.log(`   Max buy: £${this.config.buying.maxBuyAmount}`);
    console.log(`   Max sell: ${this.config.selling.maxSellAmount} BTC`);
    console.log(`   Post-sell drop threshold: £${this.config.buying.postSellDropThreshold}`);
    if (this.config.monitoring.randomPolling.enabled) {
      const minMins = this.config.monitoring.randomPolling.minInterval / 60000;
      const maxMins = this.config.monitoring.randomPolling.maxInterval / 60000;
      console.log(`   Monitoring interval: ${minMins}-${maxMins} minutes (randomized)`);
    } else {
      console.log(`   Monitoring interval: ${this.config.monitoring.interval / 1000}s`);
    }
    console.log(`   Manual approval: ${this.config.safety.requireManualApproval ? 'Required' : 'Automatic'}`);
    if (this.config.monitoring.telegramAlerts.enabled) {
      console.log(`   📱 Telegram alerts: Drop £${this.config.monitoring.telegramAlerts.priceDropAlert.toLocaleString()} / Rise £${this.config.monitoring.telegramAlerts.priceRiseAlert.toLocaleString()}`);
    }
    console.log('────────────────────────────────\n');

    // Send startup alert via Telegram
    if (this.telegramNotifier) {
      // Load alert thresholds from config and telegram-config.json
      let dropThresholds = [];
      let riseThresholds = [];
      let percentDrop = 5;
      let percentRise = 5;
      try {
        const telegramConfig = require('./config/telegram-config.json');
        const priceThresholds = telegramConfig.alerts?.priceThresholds;
        if (priceThresholds) {
          dropThresholds = priceThresholds.dropThresholds?.map(t => `${t.price.toLocaleString()} GBP`) || [];
          riseThresholds = priceThresholds.riseThresholds?.map(t => `${t.price.toLocaleString()} GBP`) || [];
          percentDrop = priceThresholds.percentageAlerts?.significantDrop || percentDrop;
          percentRise = priceThresholds.percentageAlerts?.significantRise || percentRise;
        }
      } catch (e) {
        // fallback to config if telegram-config.json not found
        dropThresholds = [
          `${this.config.monitoring.telegramAlerts.priceDropAlert?.toLocaleString?.() || this.config.monitoring.telegramAlerts.priceDropAlert} GBP`
        ];
        riseThresholds = [
          `${this.config.monitoring.telegramAlerts.priceRiseAlert?.toLocaleString?.() || this.config.monitoring.telegramAlerts.priceRiseAlert} GBP`
        ];
        percentDrop = this.config.monitoring.telegramAlerts.significantDropPercent || percentDrop;
        percentRise = this.config.monitoring.telegramAlerts.significantRisePercent || percentRise;
      }

      const alertSection =
        `🔔 Alert Thresholds:` +
        `\n• Drop: ${dropThresholds.join(', ')}` +
        `\n• Rise: ${riseThresholds.join(', ')}` +
        `\n• % Drop: ${percentDrop}% | % Rise: ${percentRise}%`;

      const startupMessage = '🚀 Auto-Trading System Started!\n\n' +
        '📊 Configuration:\n' +
        `• Buy below: £${this.config.buying.priceThreshold.toLocaleString()}\n` +
        `• Sell above: £${this.config.selling.priceThreshold.toLocaleString()}\n` +
        `• Profit target: £${this.config.selling.profitTarget}\n` +
        `• Max buy: £${this.config.buying.maxBuyAmount}\n` +
        `• Max sell: ${this.config.selling.maxSellAmount} BTC\n\n` +
        `⏱️ Monitoring: ${this.config.monitoring.randomPolling.enabled ? `${Math.round(this.config.monitoring.randomPolling.minInterval / 60000)}-${Math.round(this.config.monitoring.randomPolling.maxInterval / 60000)} minutes (randomized)` : `${this.config.monitoring.interval / 1000}s`}\n` +
        `🔧 Approval: ${this.config.safety.requireManualApproval ? 'Manual Required' : 'Automatic'}\n\n` +
        alertSection + '\n\n' +
        '✅ System is monitoring and ready to trade!';

      // Get local network IP for dashboard link
      let dashboardUrl = 'http://localhost:3001';
      try {
        const { execSync } = require('child_process');
        const networkIp = execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
        if (networkIp && networkIp !== '127.0.0.1') {
          dashboardUrl = `http://${networkIp}:3001`;
        }
      } catch (error) {
        console.log('⚠️ Could not get network IP, using localhost for dashboard link');
      }

      // Create a minimal startup message that we know works
      const fullStartupMessage = 
        `Auto-Trading System Started!\n\n` +
        `Configuration:\n` +
        `- Buy below: ${this.config.buying.priceThreshold.toLocaleString()} GBP\n` +
        `- Sell above: ${this.config.selling.priceThreshold.toLocaleString()} GBP\n` +
        `- Profit target: ${this.config.selling.profitTarget} GBP\n` +
        `- Max buy: ${this.config.buying.maxBuyAmount} GBP\n` +
        `- Max sell: ${this.config.selling.maxSellAmount} BTC\n\n` +
        `Alert Thresholds:\n` +
        `- Drop: ${dropThresholds.join(', ')}\n` +
        `- Rise: ${riseThresholds.join(', ')}\n` +
        `- Drop %: ${percentDrop}% | Rise %: ${percentRise}%\n\n` +
        `System is monitoring and ready to trade!\n\n` +
        `📊 Live Dashboard: ${dashboardUrl}\n` +
        `💡 Run: npm run dashboard (if not already running)`;

      // Send startup alert asynchronously
      if (fullStartupMessage && typeof fullStartupMessage === 'string' && fullStartupMessage.trim().length > 0) {
        this.telegramNotifier.sendMessage(fullStartupMessage.trim())
          .then(() => console.log('📱 Startup alert sent to Telegram'))
          .catch(error => console.log('⚠️ Could not send startup alert:', error.message));
      } else {
        console.log('⚠️ Startup alert not sent: message was empty or invalid.');
      }
    }

    this.monitoring = true;
    
    // Initial check
    this.executeAutomatedTrading();
    
    // Set up randomized monitoring interval
    this.scheduleNextCheck();
  }

  /**
   * Schedule next trading evaluation with randomized interval
   */
  scheduleNextCheck() {
    if (this.monitoringTimeout) {
      clearTimeout(this.monitoringTimeout);
    }
    
    let randomInterval;
    
    if (this.config.monitoring.randomPolling?.enabled) {
      // Long-period randomization (1-2 hours configurable)
      const minInterval = this.config.monitoring.randomPolling.minInterval;
      const maxInterval = this.config.monitoring.randomPolling.maxInterval;
      const minGap = this.config.monitoring.randomPolling.minGapBetweenChecks;
      
      // Calculate random interval within range
      randomInterval = minInterval + Math.random() * (maxInterval - minInterval);
      
      // Ensure minimum gap from last check
      if (this.lastCheckTime) {
        const timeSinceLastCheck = Date.now() - this.lastCheckTime;
        const remainingGap = minGap - timeSinceLastCheck;
        
        if (remainingGap > 0) {
          randomInterval = Math.max(randomInterval, remainingGap);
        }
      }
      
      const hours = (randomInterval / 3600000).toFixed(1);
      
      // Format time in a more readable way
      const timeStr = this.formatTime(randomInterval);
      
      // Check if next execution will be during trading hours
      const nextExecutionTime = Date.now() + randomInterval;
      const willBeTradingHours = this.timingController.isTradingAllowedAt(nextExecutionTime);
      
      if (willBeTradingHours) {
        console.log(`🤖 Next trading evaluation in ${timeStr} ✅ (during trading hours)`);
      } else {
        console.log(`🤖 Next trading evaluation in ${timeStr} ⏸️ (outside trading hours - will queue)`);
      }
      
    } else {
      // Original short-period randomization (48-72 seconds)
      const baseInterval = this.config.monitoring.interval;
      const randomFactor = 0.8 + (Math.random() * 0.4);
      randomInterval = Math.floor(baseInterval * randomFactor);
      
      // Check if next execution will be during trading hours
      const nextExecutionTime = Date.now() + randomInterval;
      const willBeTradingHours = this.timingController.isTradingAllowedAt(nextExecutionTime);
      
      const timeStr = this.formatTime(randomInterval);
      
      if (willBeTradingHours) {
        console.log(`🤖 Next trading evaluation in ${timeStr} ✅ (during trading hours)`);
      } else {
        console.log(`🤖 Next trading evaluation in ${timeStr} ⏸️ (outside trading hours - will queue)`);
      }
    }
    
    this.monitoringTimeout = setTimeout(() => {
      this.lastCheckTime = Date.now();
      this.executeAutomatedTrading();
      this.scheduleNextCheck(); // Schedule the next check
    }, randomInterval);
  }

  /**
   * Stop automated trading
   */
  stopAutomatedTrading() {
    if (!this.monitoring) {
      console.log('⚠️ Automated trading is not running');
      return;
    }

    console.log('\n🛑 Stopping Unified Auto Trading System...');
    this.monitoring = false;
    
    if (this.monitoringTimeout) {
      clearTimeout(this.monitoringTimeout);
      this.monitoringTimeout = null;
    }
    
    // Send shutdown alert via Telegram
    if (this.telegramNotifier) {
      const shutdownMessage = `🛑 Auto-Trading System Stopped\n\n✅ System has been safely shut down.\n\n⚠️ Trading is no longer active - manual intervention required for trades.`;
      
      this.telegramNotifier.sendMessage(shutdownMessage)
        .then(() => console.log('📱 Shutdown alert sent to Telegram'))
        .catch(error => console.log('⚠️ Could not send shutdown alert:', error.message));
    }
    
    console.log('✅ Automated trading stopped');
  }

  /**
   * Get today's trade count
   */
  getTodaysTradeCount() {
    // This would check both buying and selling history
    const today = new Date().toDateString();
    const buyTrades = this.buyer.buyingHistory.filter(trade => 
      new Date(trade.timestamp).toDateString() === today
    ).length;
    const sellTrades = this.seller.tradingHistory.filter(trade => 
      new Date(trade.timestamp).toDateString() === today
    ).length;
    return buyTrades + sellTrades;
  }

  /**
   * Display comprehensive trading status
   */
  async displayTradingStatus() {
    try {
      const priceData = await this.buyer.getCurrentPrice();
      const balances = await this.buyer.getAccountBalances();
      const currentProfit = this.profitTracker.getCurrentProfit();
      const buyStats = this.buyer.getBuyingStats();
      const sellStats = this.seller.getTradingStats();
      
      console.log('\n🤖 ====== UNIFIED TRADING STATUS ======');
      console.log(`💰 Current BTC Price: £${priceData.price.toLocaleString()}`);
      console.log(`🏦 Balances:`);
      console.log(`   GBP: £${balances.GBP?.available.toFixed(2) || '0.00'}`);
      console.log(`   BTC: ${balances.BTC?.available.toFixed(8) || '0.00000000'} BTC`);
      console.log(`💷 Current Profit: £${currentProfit.toFixed(2)}`);
      console.log('\n📊 TRADING STATISTICS:');
      console.log(`   Total Purchases: ${buyStats.totalPurchases}`);
      console.log(`   Total Sales: ${sellStats.totalTrades}`);
      console.log(`   Today's Trades: ${this.getTodaysTradeCount()}`);
      console.log(`   Total Spent: £${buyStats.totalSpent.toFixed(2)}`);
      console.log(`   Total Received: £${sellStats.totalGBP.toFixed(2)}`);
      console.log('\n🎯 CURRENT TARGETS:');
      console.log(`   Buy Trigger: £${this.config.buying.priceThreshold.toLocaleString()}`);
      console.log(`   Sell Trigger: £${this.config.selling.priceThreshold.toLocaleString()}`);
      console.log(`   Profit Target: £${this.config.selling.profitTarget}`);
      console.log('=====================================\n');
      
    } catch (error) {
      console.error('❌ Failed to display trading status:', error.message);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  // Load configuration from unified config file
  let config = {
    dryRun: true,
    sandbox: false,
    buying: {
      priceThreshold: 80000,
      maxBuyAmount: 50,
    },
    selling: {
      priceThreshold: 90000,
      profitTarget: 10,
      maxSellAmount: 0.01,
    },
    safety: {
      requireManualApproval: false,
    }
  };

  try {
    const fs = require('fs');
    const unifiedConfig = JSON.parse(fs.readFileSync('./config/unified-config.json', 'utf8'));
    config = unifiedConfig;
  } catch (error) {
    console.log('⚠️ Using default config (config/unified-config.json not found)');
  }

  const trader = new UnifiedTradingSystem(config);

  switch (command) {
    case 'start':
      trader.startAutomatedTrading();
      
      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🔄 Received shutdown signal...');
        trader.stopAutomatedTrading();
        process.exit(0);
      });
      break;

    case 'status':
      trader.displayTradingStatus();
      break;

    case 'analyze':
      trader.analyzeTradingOpportunity().then(analysis => {
        // Analysis is now displayed in the detailed format above
      }).catch(console.error);
      break;

    case 'test-alerts':
      if (trader.telegramNotifier) {
        console.log('🧪 Testing Telegram alerts...');
        trader.telegramNotifier.testConnection().then(success => {
          if (success) {
            console.log('✅ Telegram connection successful! Alerts are ready.');
          } else {
            console.log('❌ Telegram connection failed. Check your configuration.');
          }
        }).catch(console.error);
      } else {
        console.log('⚠️ Telegram alerts not enabled or configured');
      }
      break;

    case 'once':
      trader.executeAutomatedTrading().then(executed => {
        console.log(`Trade executed: ${executed ? 'Yes' : 'No'}`);
      }).catch(console.error);
      break;

    default:
      console.log(`
🤖 Unified Auto Trading System

Commands:
  start                Start automated trading (Ctrl+C to stop)
  status              Show current trading status
  analyze             Analyze current trading opportunity
  test-alerts         Test Telegram alert connection
  once                Execute one trading cycle

Configuration:
  - Buys BTC when price drops below £80,000
  - Sells BTC when price rises above £90,000
  - Sells when profit target (£10) is reached
  - Safety limits prevent over-trading

⚠️ SAFETY: Runs in DRY RUN mode by default.
      `);
  }
}

module.exports = UnifiedTradingSystem;