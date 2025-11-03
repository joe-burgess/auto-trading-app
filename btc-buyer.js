// Automated BTC Buying System with Price Triggers
const https = require('https');
const crypto = require('crypto-js');
const fs = require('fs');
const ProfitTracker = require('./profit-tracker');

class BTCBuyingSystem {
  constructor(config = {}) {
    this.config = {
      // API credentials
      apiKey: config.apiKey || process.env.COINBASE_API_KEY,
      apiSecret: config.apiSecret || process.env.COINBASE_API_SECRET,
      passphrase: config.passphrase || process.env.COINBASE_PASSPHRASE,
      
      // Trading environment
      sandbox: config.sandbox !== false,
      baseUrl: config.sandbox !== false ? 'api-public.sandbox.exchange.coinbase.com' : 'api.exchange.coinbase.com',
      dryRun: config.dryRun !== false,
      
      // Buying triggers and limits
      buyTriggers: {
        enabled: config.buyTriggers?.enabled || true,
        priceThreshold: config.buyTriggers?.priceThreshold || 80000, // Buy when BTC drops below £80,000
        percentageDrop: config.buyTriggers?.percentageDrop || 5, // Buy on 5% drop from recent high
        minimumGapBetweenBuys: config.buyTriggers?.minimumGapBetweenBuys || 3600000, // 1 hour between buys
        postSellDropThreshold: config.buyTriggers?.postSellDropThreshold || 10, // £10 drop required after sell
      },
      
      // Safety limits
      limits: {
        maxBuyAmount: config.limits?.maxBuyAmount || 100, // Max £100 per buy
        maxDailyBuying: config.limits?.maxDailyBuying || 500, // Max £500 per day
        minAccountBalance: config.limits?.minAccountBalance || 200, // Keep £200 minimum in account
        maxBtcHolding: config.limits?.maxBtcHolding || 0.05, // Max 0.05 BTC total holding
      },
      
      // Fee structure for buying
      fees: {
        trading: {
          maker: 0.005, // 0.5% maker fee
          taker: 0.005, // 0.5% taker fee
        },
        deposit: {
          gbp: 0, // Usually free to deposit GBP
        },
        spread: 0.0025, // Estimated 0.25% spread cost
      },
      
      // Strategy settings
      strategy: {
        dollarCostAveraging: config.strategy?.dollarCostAveraging || false,
        dcaAmount: config.strategy?.dcaAmount || 50, // £50 regular purchases
        dcaInterval: config.strategy?.dcaInterval || 86400000, // Daily (24 hours)
        
        dipBuying: config.strategy?.dipBuying !== false, // Enabled by default
        dipPercentage: config.strategy?.dipPercentage || 3, // Buy on 3% dips
        
        supportLevelBuying: config.strategy?.supportLevelBuying || false,
        supportLevels: config.strategy?.supportLevels || [75000, 70000, 65000], // Support levels in GBP
      },
      
      // Logging
      logFile: config.logFile || 'data/buying-log.json',
    };
    
    this.buyingHistory = [];
    this.priceHistory = [];
    this.lastBuyTime = 0;
    this.recentHigh = 0;
    this.lastSellPrice = null; // Track last sell price for post-sell threshold
    this.lastSellTime = 0;     // Track when last sell occurred
    
    this.loadBuyingHistory();
    
    // Initialize profit tracker
    this.profitTracker = new ProfitTracker({
      profitThreshold: config.profitThreshold || 10,
    });
    
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.passphrase) {
      console.log('⚠️ WARNING: Coinbase API credentials not configured. Running in simulation mode.');
      this.config.dryRun = true;
    }
  }

  /**
   * Generate authentication headers for Coinbase Pro API
   */
  generateAuthHeaders(method, path, body = '') {
    if (this.config.dryRun || !this.config.apiKey) {
      return {};
    }

    const timestamp = Date.now() / 1000;
    const message = timestamp + method + path + body;
    const key = Buffer.from(this.config.apiSecret, 'base64');
    const hmac = crypto.HmacSHA256(message, key);
    const signature = hmac.toString('base64');

    return {
      'CB-ACCESS-KEY': this.config.apiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-ACCESS-PASSPHRASE': this.config.passphrase,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make authenticated API request
   */
  async makeApiRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const bodyString = body ? JSON.stringify(body) : '';
      const headers = {
        'User-Agent': 'auto-trading-app-buyer/1.0.0',
        ...this.generateAuthHeaders(method, path, bodyString)
      };

      const options = {
        hostname: this.config.baseUrl,
        port: 443,
        path: path,
        method: method,
        headers: headers
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`API Error ${res.statusCode}: ${response.message || data}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      if (bodyString) {
        req.write(bodyString);
      }

      req.end();
    });
  }

  /**
   * Load last sell data from metadata file
   */
  loadLastSellData() {
    try {
      const metadataFile = this.config.logFile.replace('.json', '-metadata.json');
      if (fs.existsSync(metadataFile)) {
        const data = fs.readFileSync(metadataFile, 'utf8');
        const metadata = JSON.parse(data);
        this.lastSellPrice = metadata.lastSellPrice || null;
        this.lastSellTime = metadata.lastSellTime || 0;
        if (this.lastSellPrice) {
          console.log(`📊 Last sell price loaded: £${this.lastSellPrice.toFixed(2)}`);
        }
      }
    } catch (error) {
      console.log('⚠️ Could not load last sell data:', error.message);
    }
  }

  /**
   * Save last sell data to metadata file
   */
  saveLastSellData() {
    try {
      const metadataFile = this.config.logFile.replace('.json', '-metadata.json');
      const metadata = {
        lastSellPrice: this.lastSellPrice,
        lastSellTime: this.lastSellTime,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error('❌ Failed to save last sell data:', error.message);
    }
  }

  /**
   * Update last sell price (called from trading system)
   */
  updateLastSellPrice(sellPrice) {
    this.lastSellPrice = sellPrice;
    this.lastSellTime = Date.now();
    this.saveLastSellData();
    console.log(`📝 Updated last sell price: £${sellPrice.toFixed(2)}`);
  }
  async getCurrentPrice() {
    try {
      const ticker = await this.makeApiRequest('GET', '/products/BTC-GBP/ticker');
      return {
        price: parseFloat(ticker.price),
        bid: parseFloat(ticker.bid),
        ask: parseFloat(ticker.ask),
        volume: parseFloat(ticker.volume),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to get current price: ${error.message}`);
    }
  }

  /**
   * Get account balances
   */
  async getAccountBalances() {
    if (this.config.dryRun) {
      // In simulation mode, calculate actual balances from buying history
      try {
        const fs = require('fs');
        const path = require('path');
        const balanceHistoryPath = path.join(__dirname, 'data', 'balance-history.json');
        const buyingLogPath = path.join(__dirname, 'data', 'buying-log.json');
        
        let gbpBalance = 0;
        let btcBalance = 0.00243902; // Current BTC amount after reset (£200 worth)
        
        // Get GBP balance from latest balance history (includes simulated funds)
        if (fs.existsSync(balanceHistoryPath)) {
          const balanceHistory = JSON.parse(fs.readFileSync(balanceHistoryPath, 'utf8'));
          if (balanceHistory.length > 0) {
            const latestBalance = balanceHistory[balanceHistory.length - 1];
            gbpBalance = latestBalance.gbpBalance || 0;
          }
        }
        
        // Calculate actual BTC balance by adding all purchases
        if (fs.existsSync(buyingLogPath)) {
          const buyingLog = JSON.parse(fs.readFileSync(buyingLogPath, 'utf8'));
          const totalPurchasedBTC = buyingLog.reduce((total, purchase) => {
            return total + (purchase.feeCalculation?.actualBtcReceived || 0);
          }, 0);
          
          btcBalance += totalPurchasedBTC;
          
          // Also deduct spent GBP from purchases
          const totalSpentGBP = buyingLog.reduce((total, purchase) => {
            return total + (purchase.gbpAmount || 0);
          }, 0);
          
          // Only deduct if we haven't already accounted for it in balance history
          // (This prevents double-deduction when simulated funds are added)
          if (gbpBalance >= totalSpentGBP) {
            gbpBalance -= totalSpentGBP;
          }
        }
        
        // Balance display moved to specific actions to avoid duplicates
        
        // Convert to API format
        return {
          GBP: { 
            balance: gbpBalance, 
            available: gbpBalance, 
            hold: 0 
          },
          BTC: { 
            balance: btcBalance, 
            available: btcBalance, 
            hold: 0 
          }
        };
        
      } catch (error) {
        console.log('⚠️ Could not calculate simulated balance:', error.message);
      }
      
      // Fallback to original hardcoded values
      return {
        GBP: { balance: 0, available: 0, hold: 0 },
        BTC: { balance: 0.00243902, available: 0.00243902, hold: 0 }
      };
    }

    try {
      const accounts = await this.makeApiRequest('GET', '/accounts');
      const balances = {};
      
      accounts.forEach(account => {
        balances[account.currency] = {
          balance: parseFloat(account.balance),
          available: parseFloat(account.available),
          hold: parseFloat(account.hold)
        };
      });
      
      return balances;
    } catch (error) {
      throw new Error(`Failed to get account balances: ${error.message}`);
    }
  }

  /**
   * Display current simulated balance
   */
  async displayBalance() {
    const balances = await this.getAccountBalances();
    const gbpBalance = balances.GBP.balance;
    const btcBalance = balances.BTC.balance;
    
    console.log(`💰 Simulated Balance: £${gbpBalance.toFixed(2)} GBP + ${btcBalance.toFixed(8)} BTC`);
    return balances;
  }

  /**
   * Calculate fees for buying BTC
   */
  calculateBuyingFees(gbpAmount, btcPrice) {
    const btcAmount = gbpAmount / btcPrice;
    
    // Trading fee (0.5% of trade value)
    const tradingFee = gbpAmount * this.config.fees.trading.taker;
    
    // Spread cost (estimated)
    const spreadCost = gbpAmount * this.config.fees.spread;
    
    // Total cost including fees
    const totalCost = gbpAmount + tradingFee + spreadCost;
    
    // Actual BTC received after fees
    const actualBtcReceived = (gbpAmount - tradingFee - spreadCost) / btcPrice;
    
    return {
      gbpAmount,
      btcPrice,
      estimatedBtcAmount: btcAmount,
      actualBtcReceived,
      fees: {
        trading: tradingFee,
        spread: spreadCost,
        total: tradingFee + spreadCost
      },
      totalCost,
      effectivePrice: totalCost / actualBtcReceived, // Actual GBP per BTC including fees
      feePercentage: ((tradingFee + spreadCost) / gbpAmount) * 100
    };
  }

  /**
   * Check if buying conditions are met
   */
  async checkBuyingConditions(currentPrice) {
    const balances = await this.getAccountBalances();
    const now = Date.now();
    
    // Update recent high
    if (currentPrice.price > this.recentHigh) {
      this.recentHigh = currentPrice.price;
    }
    
    const conditions = {
      priceThreshold: false,
      percentageDrop: false,
      sufficientBalance: false,
      withinDailyLimit: false,
      timingOk: false,
      belowMaxHolding: false,
      supportLevel: false,
      postSellThreshold: true // Default to true if no recent sell
    };
    
    // Check price threshold
    if (this.config.buyTriggers.enabled && currentPrice.price <= this.config.buyTriggers.priceThreshold) {
      conditions.priceThreshold = true;
    }
    
    // Check percentage drop from recent high
    if (this.recentHigh > 0) {
      const dropPercentage = ((this.recentHigh - currentPrice.price) / this.recentHigh) * 100;
      if (dropPercentage >= this.config.buyTriggers.percentageDrop) {
        conditions.percentageDrop = true;
      }
    }
    
    // Check sufficient GBP balance
    const availableGbp = balances.GBP?.available || 0;
    const requiredAmount = this.config.limits.maxBuyAmount + this.config.limits.minAccountBalance;
    conditions.sufficientBalance = availableGbp >= requiredAmount;
    
    // Check daily buying limit (both amount and trade count)
    const todaysBuying = this.getTodaysBuyingAmount();
    const todaysTradeCount = this.getTodaysBuyingTradeCount();
    const maxDailyTrades = this.config.limits.maxDailyBuyTrades || this.config.buyTriggers.maxDailyBuyTrades || 5;
    
    conditions.withinDailyLimit = 
      (todaysBuying + this.config.limits.maxBuyAmount <= this.config.limits.maxDailyBuying) &&
      (todaysTradeCount < maxDailyTrades);
    
    // Check timing between buys
    conditions.timingOk = (now - this.lastBuyTime) >= this.config.buyTriggers.minimumGapBetweenBuys;
    
    // Check max BTC holding
    const currentBtcHolding = balances.BTC?.available || 0;
    conditions.belowMaxHolding = currentBtcHolding < this.config.limits.maxBtcHolding;
    
    // Check support levels
    if (this.config.strategy.supportLevelBuying) {
      conditions.supportLevel = this.config.strategy.supportLevels.some(level => 
        Math.abs(currentPrice.price - level) <= (level * 0.01) // Within 1% of support level
      );
    }
    
    // Check post-sell price drop threshold
    if (this.lastSellPrice !== null) {
      const priceDrop = this.lastSellPrice - currentPrice.price;
      conditions.postSellThreshold = priceDrop >= this.config.buyTriggers.postSellDropThreshold;
      
      if (!conditions.postSellThreshold) {
        console.log(`⏸️ Post-sell threshold not met: Need £${this.config.buyTriggers.postSellDropThreshold} drop, current drop: £${priceDrop.toFixed(2)}`);
      }
    } else {
      // No sell has happened yet - prevent buying until first profitable sell
      conditions.postSellThreshold = false;
      console.log(`⏸️ No previous sell recorded - buying disabled until first profitable sell occurs`);
    }
    
    return {
      conditions,
      shouldBuy: (conditions.priceThreshold || conditions.percentageDrop || conditions.supportLevel) &&
                conditions.sufficientBalance &&
                conditions.withinDailyLimit &&
                conditions.timingOk &&
                conditions.belowMaxHolding &&
                conditions.postSellThreshold, // Added post-sell threshold requirement
      availableGbp,
      currentBtcHolding,
      todaysBuying,
      dropFromHigh: this.recentHigh > 0 ? ((this.recentHigh - currentPrice.price) / this.recentHigh) * 100 : 0,
      lastSellPrice: this.lastSellPrice,
      postSellDrop: this.lastSellPrice ? this.lastSellPrice - currentPrice.price : null
    };
  }

  /**
   * Create a market buy order for BTC
   */
  async createBuyOrder(gbpAmount, isEmergency = false) {
    const priceData = await this.getCurrentPrice();
    const feeCalc = this.calculateBuyingFees(gbpAmount, priceData.ask);
    
    // Check limits unless it's an emergency buy
    if (!isEmergency && gbpAmount > this.config.limits.maxBuyAmount) {
      throw new Error(`Buy amount £${gbpAmount} exceeds maximum limit of £${this.config.limits.maxBuyAmount}`);
    }
    
    // Log if emergency limit bypass is used
    if (isEmergency && gbpAmount > this.config.limits.maxBuyAmount) {
      console.log(`⚠️ Emergency buy: Bypassing £${this.config.limits.maxBuyAmount} limit for £${gbpAmount} purchase`);
    }

    const order = {
      type: 'market',
      side: 'buy',
      product_id: 'BTC-GBP',
      funds: gbpAmount.toString(), // Use funds for market buy orders
    };

    if (this.config.dryRun) {
      const simulatedOrder = {
        id: 'sim_buy_' + Date.now(),
        ...order,
        status: 'filled',
        filled_size: feeCalc.actualBtcReceived.toString(),
        executed_value: gbpAmount.toString(),
        fill_fees: feeCalc.fees.trading.toString(),
        created_at: new Date().toISOString(),
        done_at: new Date().toISOString(),
        simulated: true
      };
      
      console.log('🧪 SIMULATED BUY ORDER:', simulatedOrder);
      return simulatedOrder;
    }

    try {
      const result = await this.makeApiRequest('POST', '/orders', order);
      console.log('✅ Buy order placed:', result);
      return result;
    } catch (error) {
      throw new Error(`Failed to create buy order: ${error.message}`);
    }
  }

  /**
   * Execute automated BTC purchase
   */
  async executeBTCPurchase(gbpAmount, reason = 'manual', isEmergency = false) {
    const startTime = new Date().toISOString();
    
    try {
      console.log(`🛒 Starting BTC purchase: £${gbpAmount} (${reason})`);
      
      // Get current market data
      const priceData = await this.getCurrentPrice();
      
      // Calculate fees
      const feeCalculation = this.calculateBuyingFees(gbpAmount, priceData.ask);
      
      // Display fee breakdown
      this.displayBuyingFeeBreakdown(feeCalculation);
      
      // Execute the buy order
      const order = await this.createBuyOrder(gbpAmount, isEmergency);
      
      // Record the purchase
      const purchase = {
        timestamp: startTime,
        type: 'buy',
        gbpAmount,
        reason,
        priceData,
        feeCalculation,
        order,
        status: 'completed'
      };
      
      this.logPurchase(purchase);
      this.lastBuyTime = Date.now();
      
      // Update profit tracking
      const balances = await this.getAccountBalances();
      this.profitTracker.recordBalance(balances, 'post-buy');
      
      console.log(`✅ BTC purchase completed! Received ${feeCalculation.actualBtcReceived.toFixed(8)} BTC`);
      return purchase;
      
    } catch (error) {
      console.error('❌ BTC purchase failed:', error.message);
      throw error;
    }
  }

  /**
   * Display buying fee breakdown
   */
  displayBuyingFeeBreakdown(calc) {
    console.log('\n💷 ====== BUY FEE BREAKDOWN ======');
    console.log(`💰 GBP Amount: £${calc.gbpAmount.toFixed(2)}`);
    console.log(`📈 BTC Price: £${calc.btcPrice.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
    console.log(`🪙 Est. BTC Amount: ${calc.estimatedBtcAmount.toFixed(8)} BTC`);
    console.log('\n📊 FEES:');
    console.log(`   Trading Fee (0.5%): £${calc.fees.trading.toFixed(2)}`);
    console.log(`   Spread Cost (~0.25%): £${calc.fees.spread.toFixed(2)}`);
    console.log(`   Total Fees: £${calc.fees.total.toFixed(2)}`);
    console.log('\n🎯 FINAL AMOUNTS:');
    console.log(`   Total Cost: £${calc.totalCost.toFixed(2)}`);
    console.log(`   Actual BTC Received: ${calc.actualBtcReceived.toFixed(8)} BTC`);
    console.log(`   Effective Price: £${calc.effectivePrice.toLocaleString('en-GB')} per BTC`);
    console.log(`   Fee Percentage: ${calc.feePercentage.toFixed(2)}%`);
    console.log('===================================\n');
  }

  /**
   * Monitor price and execute automatic buying
   */
  async monitorAndBuy(options = {}) {
    try {
      const priceData = await this.getCurrentPrice();
      const conditions = await this.checkBuyingConditions(priceData);
      
      console.log(`[${new Date().toLocaleTimeString()}] 💰 BTC: £${priceData.price.toLocaleString('en-GB')}`);
      
      if (conditions.dropFromHigh > 0) {
        console.log(`   📉 Drop from high: ${conditions.dropFromHigh.toFixed(2)}%`);
      }
      
      if (conditions.shouldBuy) {
        const buyAmount = this.getRandomizedBuyAmount();
        const reason = this.determineBuyReason(conditions.conditions);
        
        console.log(`🎯 Buy conditions met! Reason: ${reason}, Amount: £${buyAmount}`);
        await this.executeBTCPurchase(buyAmount, reason);
        
        return true;
      } else {
        // Show why we're not buying
        const reasons = [];
        if (!conditions.conditions.sufficientBalance) reasons.push('Insufficient balance');
        if (!conditions.conditions.withinDailyLimit) reasons.push('Daily limit reached');
        if (!conditions.conditions.timingOk) reasons.push('Too soon since last buy');
        if (!conditions.conditions.belowMaxHolding) reasons.push('Max BTC holding reached');
        
        if (reasons.length > 0) {
          console.log(`   ⏸️ Not buying: ${reasons.join(', ')}`);
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Monitor and buy failed:', error.message);
      return false;
    }
  }

  /**
   * Determine reason for buying
   */
  determineBuyReason(conditions) {
    if (conditions.priceThreshold) return 'Price below threshold';
    if (conditions.percentageDrop) return 'Percentage drop detected';
    if (conditions.supportLevel) return 'Support level reached';
    return 'Manual trigger';
  }

  /**
   * Get today's buying amount
   */
  getTodaysBuyingAmount() {
    const today = new Date().toDateString();
    return this.buyingHistory
      .filter(purchase => new Date(purchase.timestamp).toDateString() === today)
      .reduce((sum, purchase) => sum + purchase.gbpAmount, 0);
  }

  /**
   * Get today's buying trade count
   */
  getTodaysBuyingTradeCount() {
    const today = new Date().toDateString();
    return this.buyingHistory
      .filter(purchase => new Date(purchase.timestamp).toDateString() === today)
      .length;
  }

  /**
   * Generate randomized buy amount
   */
  getRandomizedBuyAmount() {
    const config = this.config.limits || this.config.buyTriggers;
    const maxAmount = config.maxBuyAmount || 50;
    const minAmount = config.minBuyAmount || Math.max(10, maxAmount * 0.4); // Default to 40% of max
    
    if (!config.randomizeAmount) {
      return maxAmount; // Return fixed amount if randomization disabled
    }
    
    // Generate random amount between min and max
    const randomAmount = Math.random() * (maxAmount - minAmount) + minAmount;
    
    // Round to nearest £1 to look more natural
    return Math.round(randomAmount);
  }

  /**
   * Load buying history
   */
  loadBuyingHistory() {
    try {
      if (fs.existsSync(this.config.logFile)) {
        const data = fs.readFileSync(this.config.logFile, 'utf8');
        this.buyingHistory = JSON.parse(data);
        console.log(`📂 Loaded ${this.buyingHistory.length} buying records`);
        
        // Set last buy time
        if (this.buyingHistory.length > 0) {
          this.lastBuyTime = new Date(this.buyingHistory[this.buyingHistory.length - 1].timestamp).getTime();
        }
        
        // Load last sell price from metadata if exists
        this.loadLastSellData();
      }
    } catch (error) {
      console.log('⚠️ Could not load buying history:', error.message);
      this.buyingHistory = [];
    }
  }

  /**
   * Log a purchase
   */
  logPurchase(purchase) {
    this.buyingHistory.push(purchase);
    
    try {
      fs.writeFileSync(this.config.logFile, JSON.stringify(this.buyingHistory, null, 2));
      console.log('📝 Purchase logged to history');
    } catch (error) {
      console.error('❌ Failed to log purchase:', error.message);
    }
  }

  /**
   * Get buying statistics
   */
  getBuyingStats() {
    if (this.buyingHistory.length === 0) {
      return { totalPurchases: 0, totalSpent: 0, totalBTC: 0, averagePrice: 0 };
    }

    const stats = this.buyingHistory.reduce((acc, purchase) => {
      acc.totalSpent += purchase.gbpAmount || 0;
      acc.totalBTC += purchase.feeCalculation?.actualBtcReceived || 0;
      acc.totalFees += purchase.feeCalculation?.fees.total || 0;
      return acc;
    }, { totalPurchases: this.buyingHistory.length, totalSpent: 0, totalBTC: 0, totalFees: 0 });

    stats.averagePrice = stats.totalBTC > 0 ? stats.totalSpent / stats.totalBTC : 0;
    stats.todaysSpending = this.getTodaysBuyingAmount();
    
    return stats;
  }

  /**
   * Display buying statistics
   */
  displayBuyingStats() {
    const stats = this.getBuyingStats();
    
    console.log('\n🛒 ======= BUYING STATS =======');
    console.log(`📊 Total Purchases: ${stats.totalPurchases}`);
    console.log(`💷 Total Spent: £${stats.totalSpent.toFixed(2)}`);
    console.log(`🪙 Total BTC Bought: ${stats.totalBTC.toFixed(8)} BTC`);
    console.log(`💰 Average Price: £${stats.averagePrice.toLocaleString('en-GB')}/BTC`);
    console.log(`📅 Today's Spending: £${stats.todaysSpending.toFixed(2)}`);
    console.log(`💸 Total Fees: £${stats.totalFees.toFixed(2)}`);
    console.log('==============================\n');
    
    return stats;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  const buyer = new BTCBuyingSystem({
    dryRun: true,
    sandbox: false,
    buyTriggers: {
      enabled: true,
      priceThreshold: 80000, // £80,000
      percentageDrop: 3,     // 3% drop
    },
    limits: {
      maxBuyAmount: 50,      // £50 per buy
      maxDailyBuying: 200,   // £200 per day
    }
  });

  switch (command) {
    case 'monitor':
      console.log('🤖 Starting BTC buying monitor...');
      buyer.monitorAndBuy().then(() => {
        console.log('Monitor cycle completed');
      }).catch(console.error);
      break;

    case 'buy':
      const amount = parseFloat(args[1]) || 50;
      buyer.executeBTCPurchase(amount, 'manual').then(() => {
        console.log('Manual purchase completed');
      }).catch(console.error);
      break;

    case 'calculate':
      const calcAmount = parseFloat(args[1]) || 50;
      buyer.getCurrentPrice().then(price => {
        const calc = buyer.calculateBuyingFees(calcAmount, price.ask);
        buyer.displayBuyingFeeBreakdown(calc);
      }).catch(console.error);
      break;

    case 'stats':
      buyer.displayBuyingStats();
      break;

    case 'check':
      buyer.getCurrentPrice().then(async price => {
        const conditions = await buyer.checkBuyingConditions(price);
        console.log('🔍 Current Buying Conditions:');
        console.log(`   Price: £${price.price.toLocaleString('en-GB')}`);
        console.log(`   Should Buy: ${conditions.shouldBuy ? '✅ YES' : '❌ NO'}`);
        console.log(`   Available GBP: £${conditions.availableGbp.toFixed(2)}`);
        console.log(`   Today's Buying: £${conditions.todaysBuying.toFixed(2)}`);
        console.log(`   Drop from High: ${conditions.dropFromHigh.toFixed(2)}%`);
        if (conditions.lastSellPrice) {
          console.log(`   Last Sell Price: £${conditions.lastSellPrice.toLocaleString('en-GB')}`);
          console.log(`   Price Drop Since Sell: £${conditions.postSellDrop?.toFixed(2) || '0.00'}`);
          console.log(`   Post-Sell Threshold (£${buyer.config.buyTriggers.postSellDropThreshold}): ${conditions.conditions.postSellThreshold ? '✅ MET' : '❌ NOT MET'}`);
        } else {
          console.log(`   Post-Sell Threshold: ✅ N/A (No recent sell)`);
        }
      }).catch(console.error);
      break;

    default:
      console.log(`
🛒 BTC Automated Buying System

Commands:
  monitor              Check conditions and buy if triggered
  buy [amount]         Manual BTC purchase (default: £50)
  calculate [amount]   Calculate buying fees (default: £50)
  check               Check current buying conditions
  stats               Show buying statistics

Examples:
  node btc-buyer.js monitor
  node btc-buyer.js buy 100
  node btc-buyer.js calculate 75

⚠️ SAFETY: Runs in DRY RUN mode by default.
      `);
  }
}

module.exports = BTCBuyingSystem;