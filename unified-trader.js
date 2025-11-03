// Unified Auto Trading System - Buy Low, Sell High
const BTCBuyingSystem = require('./btc-buyer');
const CoinbaseTrader = require('./btc-trader');
const ProfitTracker = require('./profit-tracker');
const TimingController = require('./timing-controller');

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
        interval: config.monitoring?.interval || 60000, // 1 minute
        enableAlerts: config.monitoring?.enableAlerts !== false,
        logAllDecisions: config.monitoring?.logAllDecisions !== false,
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
    
    this.monitoring = false;
    this.lastTradeTime = 0;
    this.lastCheckTime = 0; // Track when we last checked prices
    this.recentHigh = 0;
    this.recentLow = Infinity;
    this.buyPrice = 0; // Track average buy price
    this.previousPrice = 0; // Track previous price for change calculation
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
        const initialBalance = this.profitTracker.config.initialBalance || 50.012315;
        const currentBtcValue = balances.BTC?.available * priceData.price || 0;
        const btcHoldings = balances.BTC?.available || 0;
        const gbpHoldings = balances.GBP?.available || 0;
        const valueIncrease = currentBtcValue - initialBalance;
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
          
        console.log(`[${new Date().toLocaleTimeString()}] 📊 Analysis:`, {
          price: `£${priceData.price.toLocaleString()}${changeStr}`,
          holdings: {
            btc: `${btcHoldings} BTC (£${currentBtcValue.toFixed(2)})`,
            gbp: `£${gbpHoldings.toFixed(2)}`,
            btcIncrease: `+${btcIncrease.toFixed(8)} BTC`,
            valueIncrease: `+£${valueIncrease.toFixed(2)}`
          },
          profit: `£${currentProfit.toFixed(2)}`,
          decisions: analysis.decisions,
          tradingStatus: tradingStatus
        });
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
    
    // Profit target reached
    if (currentProfit >= this.config.selling.profitTarget) {
      reasons.push(`Profit target £${this.config.selling.profitTarget} reached`);
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
        if (this.config.safety.requireManualApproval) {
          console.log('🤖 Buy opportunity detected, but manual approval required');
          console.log('   Reasons:', analysis.decisions.reasons.join(', '));
        } else {
          console.log('🛒 Buy opportunity detected - scheduling with human-like timing...');
          const buyAction = async () => {
            const buyAmount = this.buyer.getRandomizedBuyAmount();
            return await this.buyer.executeBTCPurchase(
              buyAmount, 
              'automated: ' + analysis.decisions.reasons.join(', ')
            );
          };
          
          const scheduled = await this.timingController.scheduleAction(
            'buy_' + Date.now(),
            buyAction,
            'buy',
            priceData
          );
          
          if (scheduled) {
            executed = true;
          }
        }
      }
      
      // Execute sell if conditions met (and we didn't just buy)
      if (analysis.decisions.shouldSell && !executed) {
        if (this.config.safety.requireManualApproval) {
          console.log('🤖 Sell opportunity detected, but manual approval required');
          console.log('   Reasons:', analysis.decisions.reasons.join(', '));
        } else {
          console.log('💰 Sell opportunity detected - scheduling with human-like timing...');
          
          const sellAction = async () => {
            const balances = await this.buyer.getAccountBalances();
            const withdrawalOptions = {
              confirmTrade: true,
              withdrawToBank: this.config.selling.autoWithdrawToBank,
              minWithdrawalAmount: this.config.selling.minWithdrawalAmount,
              withdrawalDelay: this.config.selling.withdrawalDelay,
              keepMinimumGbpBalance: this.config.selling.keepMinimumGbpBalance
            };
            
            const sellAmount = this.getRandomizedSellAmount(balances.BTC?.available || 0);
            return await this.seller.executeBTCtoGBP(sellAmount, withdrawalOptions);
          };
          
          const scheduled = await this.timingController.scheduleAction(
            'sell_' + Date.now(),
            sellAction,
            'sell',
            priceData
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
    console.log(`   Monitoring interval: ${this.config.monitoring.interval / 1000}s`);
    console.log(`   Manual approval: ${this.config.safety.requireManualApproval ? 'Required' : 'Automatic'}`);
    console.log('────────────────────────────────\n');

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
      
      // Check if next execution will be during trading hours
      const nextExecutionTime = Date.now() + randomInterval;
      const willBeTradingHours = this.timingController.isTradingAllowedAt(nextExecutionTime);
      
      if (willBeTradingHours) {
        console.log(`🤖 Next trading evaluation in ${hours} hours ✅ (during trading hours)`);
      } else {
        console.log(`🤖 Next trading evaluation in ${hours} hours ⏸️ (outside trading hours - will queue)`);
      }
      
    } else {
      // Original short-period randomization (48-72 seconds)
      const baseInterval = this.config.monitoring.interval;
      const randomFactor = 0.8 + (Math.random() * 0.4);
      randomInterval = Math.floor(baseInterval * randomFactor);
      
      // Check if next execution will be during trading hours
      const nextExecutionTime = Date.now() + randomInterval;
      const willBeTradingHours = this.timingController.isTradingAllowedAt(nextExecutionTime);
      
      if (willBeTradingHours) {
        console.log(`🤖 Next trading evaluation in ${Math.round(randomInterval/1000)}s ✅ (during trading hours)`);
      } else {
        console.log(`🤖 Next trading evaluation in ${Math.round(randomInterval/1000)}s ⏸️ (outside trading hours - will queue)`);
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
        if (analysis) {
          console.log('📊 Current Trading Analysis:');
          console.log(`   Price: £${analysis.price.toLocaleString()}`);
          console.log(`   Should Buy: ${analysis.decisions.shouldBuy ? '✅' : '❌'}`);
          console.log(`   Should Sell: ${analysis.decisions.shouldSell ? '✅' : '❌'}`);
          console.log(`   Reasons: ${analysis.decisions.reasons.join(', ') || 'None'}`);
        }
      }).catch(console.error);
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