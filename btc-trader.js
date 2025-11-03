// Coinbase Auto Trading System with Fee Calculation and Profit Tracking
const https = require('https');
const crypto = require('crypto-js');
const fs = require('fs');
const ProfitTracker = require('./profit-tracker');

class CoinbaseTrader {
  constructor(config = {}) {
    this.config = {
      // API credentials (will be loaded from environment or config file)
      apiKey: config.apiKey || process.env.COINBASE_API_KEY,
      apiSecret: config.apiSecret || process.env.COINBASE_API_SECRET,
      passphrase: config.passphrase || process.env.COINBASE_PASSPHRASE,
      
      // Trading settings
      sandbox: config.sandbox !== false, // Use sandbox by default for safety
      baseUrl: config.sandbox !== false ? 'api-public.sandbox.exchange.coinbase.com' : 'api.exchange.coinbase.com',
      
      // Safety limits
      maxTradeAmount: config.maxTradeAmount || 0.01, // Max 0.01 BTC per trade
      minTradeValue: config.minTradeValue || 50, // Min £50 trade value
      
      // Fee structure (Coinbase Pro rates)
      fees: {
        trading: {
          maker: 0.005, // 0.5% maker fee
          taker: 0.005, // 0.5% taker fee
        },
        withdrawal: {
          gbp: 0.15, // £0.15 GBP withdrawal fee
          minimum: 10, // £10 minimum withdrawal
        },
        spread: 0.0025, // Estimated 0.25% spread cost
      },
      
      // Logging
      logFile: config.logFile || 'data/trading-log.json',
      dryRun: config.dryRun !== false, // Dry run by default for safety
    };
    
    this.tradingHistory = [];
    this.loadTradingHistory();
    
    // Initialize profit tracker
    this.profitTracker = new ProfitTracker({
      profitThreshold: config.profitThreshold || 10, // £10 profit threshold
      alerts: {
        enabled: config.profitAlerts !== false,
        profitAlert: true,
        lossAlert: true,
        milestoneAlert: true
      }
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
      return {}; // No auth headers in dry run mode
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
   * Make authenticated API request to Coinbase Pro
   */
  async makeApiRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const bodyString = body ? JSON.stringify(body) : '';
      const headers = {
        'User-Agent': 'auto-trading-app/1.0.0',
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
   * Get current BTC-GBP price and order book
   */
  async getCurrentPrice() {
    try {
      const ticker = await this.makeApiRequest('GET', '/products/BTC-GBP/ticker');
      const orderBook = await this.makeApiRequest('GET', '/products/BTC-GBP/book?level=1');
      
      return {
        price: parseFloat(ticker.price),
        bid: parseFloat(ticker.bid),
        ask: parseFloat(ticker.ask),
        volume: parseFloat(ticker.volume),
        spread: parseFloat(ticker.ask) - parseFloat(ticker.bid),
        spreadPercent: ((parseFloat(ticker.ask) - parseFloat(ticker.bid)) / parseFloat(ticker.price)) * 100,
        orderBook: {
          bestBid: parseFloat(orderBook.bids[0][0]),
          bestAsk: parseFloat(orderBook.asks[0][0]),
          bidSize: parseFloat(orderBook.bids[0][1]),
          askSize: parseFloat(orderBook.asks[0][1])
        },
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
      // Simulated balances: £50 worth of BTC + £0 GBP
      return {
        BTC: { balance: 0.00059556, available: 0.00059556, hold: 0 },
        GBP: { balance: 0, available: 0, hold: 0 }
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
   * Calculate all fees for a BTC sale
   */
  calculateFees(btcAmount, btcPrice) {
    const grossGbpValue = btcAmount * btcPrice;
    
    // Trading fee (0.5% of trade value)
    const tradingFee = grossGbpValue * this.config.fees.trading.taker;
    
    // Spread cost (estimated)
    const spreadCost = grossGbpValue * this.config.fees.spread;
    
    // Net amount after trading
    const netAfterTrading = grossGbpValue - tradingFee - spreadCost;
    
    // Withdrawal fee (fixed £0.15)
    const withdrawalFee = this.config.fees.withdrawal.gbp;
    
    // Final amount deposited to bank
    const finalAmount = netAfterTrading - withdrawalFee;
    
    return {
      btcAmount,
      btcPrice,
      grossGbpValue,
      fees: {
        trading: tradingFee,
        spread: spreadCost,
        withdrawal: withdrawalFee,
        total: tradingFee + spreadCost + withdrawalFee
      },
      netAfterTrading,
      finalAmount,
      effectiveRate: finalAmount / btcAmount, // GBP per BTC after all fees
      feePercentage: ((grossGbpValue - finalAmount) / grossGbpValue) * 100
    };
  }

  /**
   * Create a market sell order for BTC
   */
  async createSellOrder(btcAmount, orderType = 'market') {
    if (btcAmount > this.config.maxTradeAmount) {
      throw new Error(`Trade amount ${btcAmount} BTC exceeds maximum limit of ${this.config.maxTradeAmount} BTC`);
    }

    const priceData = await this.getCurrentPrice();
    const estimatedValue = btcAmount * priceData.bid;
    
    if (estimatedValue < this.config.minTradeValue) {
      throw new Error(`Trade value £${estimatedValue.toFixed(2)} is below minimum of £${this.config.minTradeValue}`);
    }

    const order = {
      type: orderType,
      side: 'sell',
      product_id: 'BTC-GBP',
      size: btcAmount.toString(),
    };

    if (this.config.dryRun) {
      // Simulate order execution
      const simulatedOrder = {
        id: 'sim_' + Date.now(),
        ...order,
        status: 'filled',
        filled_size: btcAmount.toString(),
        executed_value: estimatedValue.toString(),
        fill_fees: (estimatedValue * this.config.fees.trading.taker).toString(),
        created_at: new Date().toISOString(),
        done_at: new Date().toISOString(),
        simulated: true
      };
      
      console.log('🧪 SIMULATED ORDER:', simulatedOrder);
      return simulatedOrder;
    }

    try {
      const result = await this.makeApiRequest('POST', '/orders', order);
      console.log('✅ Order placed:', result);
      return result;
    } catch (error) {
      throw new Error(`Failed to create sell order: ${error.message}`);
    }
  }

  /**
   * Execute complete BTC to GBP conversion with fee calculation
   */
  async executeBTCtoGBP(btcAmount, options = {}) {
    const startTime = new Date().toISOString();
    
    try {
      console.log(`🚀 Starting BTC to GBP conversion: ${btcAmount} BTC`);
      
      // Step 1: Get current market data
      console.log('📊 Getting current market data...');
      const priceData = await this.getCurrentPrice();
      
      // Step 2: Calculate fees
      console.log('💰 Calculating fees...');
      const feeCalculation = this.calculateFees(btcAmount, priceData.bid);
      
      // Step 3: Display fee breakdown
      this.displayFeeBreakdown(feeCalculation);
      
      // Step 4: Check account balances
      console.log('🏦 Checking account balances...');
      const balances = await this.getAccountBalances();
      
      if (balances.BTC && balances.BTC.available < btcAmount) {
        throw new Error(`Insufficient BTC balance. Available: ${balances.BTC.available}, Required: ${btcAmount}`);
      }
      
      // Step 5: Execute the trade
      if (options.confirmTrade !== false) {
        console.log('⚡ Executing BTC sell order...');
        const order = await this.createSellOrder(btcAmount);
        
        // Step 6: Wait for order completion (in real scenario)
        if (!this.config.dryRun) {
          console.log('⏳ Waiting for order to complete...');
          // In production, you'd poll the order status until filled
        }
        
        // Step 7: Log the trade
        const trade = {
          timestamp: startTime,
          btcAmount,
          priceData,
          feeCalculation,
          order,
          balancesBefore: balances,
          type: 'BTC_TO_GBP_CONVERSION',
          status: 'completed'
        };
        
        this.logTrade(trade);
        
        // Record trade for profit tracking
        this.profitTracker.recordTrade(trade);
        
        // Check and update balances for profit tracking
        const updatedBalances = await this.getAccountBalances();
        this.profitTracker.recordBalance(updatedBalances, 'post-trade');
        
        console.log('✅ BTC to GBP conversion completed!');
        return trade;
      } else {
        console.log('ℹ️ Trade calculation completed (no execution requested)');
        return { feeCalculation, priceData, balances };
      }
      
    } catch (error) {
      console.error('❌ BTC to GBP conversion failed:', error.message);
      throw error;
    }
  }

  /**
   * Display detailed fee breakdown
   */
  displayFeeBreakdown(calc) {
    console.log('\n💷 ====== FEE BREAKDOWN ======');
    console.log(`🪙 BTC Amount: ${calc.btcAmount} BTC`);
    console.log(`📈 BTC Price: £${calc.btcPrice.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
    console.log(`💵 Gross Value: £${calc.grossGbpValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
    console.log('\n📊 FEES:');
    console.log(`   Trading Fee (0.5%): £${calc.fees.trading.toFixed(2)}`);
    console.log(`   Spread Cost (~0.25%): £${calc.fees.spread.toFixed(2)}`);
    console.log(`   Withdrawal Fee: £${calc.fees.withdrawal.toFixed(2)}`);
    console.log(`   Total Fees: £${calc.fees.total.toFixed(2)}`);
    console.log('\n💰 FINAL AMOUNTS:');
    console.log(`   Net After Trading: £${calc.netAfterTrading.toFixed(2)}`);
    console.log(`   Final Bank Deposit: £${calc.finalAmount.toFixed(2)}`);
    console.log(`   Effective Rate: £${calc.effectiveRate.toLocaleString('en-GB')} per BTC`);
    console.log(`   Total Fee %: ${calc.feePercentage.toFixed(2)}%`);
    console.log('================================\n');
  }

  /**
   * Automated withdrawal to bank account
   */
  async withdrawToBank(amount, bankDetails = null) {
    if (amount < this.config.fees.withdrawal.minimum) {
      throw new Error(`Withdrawal amount £${amount} is below minimum of £${this.config.fees.withdrawal.minimum}`);
    }

    if (this.config.dryRun) {
      console.log(`🧪 SIMULATED BANK WITHDRAWAL: £${amount.toFixed(2)}`);
      return {
        id: 'sim_withdrawal_' + Date.now(),
        amount: amount,
        currency: 'GBP',
        status: 'completed',
        simulated: true,
        created_at: new Date().toISOString()
      };
    }

    // In production, this would use Coinbase's withdrawal API
    const withdrawal = {
      amount: amount.toString(),
      currency: 'GBP',
      payment_method: bankDetails?.paymentMethodId || 'default_bank_account'
    };

    try {
      const result = await this.makeApiRequest('POST', '/withdrawals/payment-method', withdrawal);
      console.log('✅ Bank withdrawal initiated:', result);
      return result;
    } catch (error) {
      throw new Error(`Failed to withdraw to bank: ${error.message}`);
    }
  }

  /**
   * Evaluate whether withdrawal conditions are met
   */
  async evaluateWithdrawalConditions(withdrawalAmount, options) {
    // Check if auto-withdrawal is enabled
    if (!options.withdrawToBank) {
      return { withdraw: false, reason: 'Auto-withdrawal disabled' };
    }

    // Check minimum withdrawal amount
    const minAmount = options.minWithdrawalAmount || this.config.fees.withdrawal.minimum;
    if (withdrawalAmount < minAmount) {
      return { 
        withdraw: false, 
        reason: `Amount £${withdrawalAmount.toFixed(2)} below minimum £${minAmount}` 
      };
    }

    // Check if we need to keep minimum GBP balance in Coinbase
    if (options.keepMinimumGbpBalance && options.keepMinimumGbpBalance > 0) {
      const balances = await this.getAccountBalances();
      const currentGbp = balances.GBP?.available || 0;
      const afterWithdrawal = currentGbp - withdrawalAmount;
      
      if (afterWithdrawal < options.keepMinimumGbpBalance) {
        const maxWithdrawal = Math.max(0, currentGbp - options.keepMinimumGbpBalance);
        if (maxWithdrawal < minAmount) {
          return { 
            withdraw: false, 
            reason: `Would leave £${afterWithdrawal.toFixed(2)} in account (minimum: £${options.keepMinimumGbpBalance})` 
          };
        }
        return { 
          withdraw: true, 
          amount: maxWithdrawal, 
          reason: `Partial withdrawal to maintain minimum balance` 
        };
      }
    }

    return { withdraw: true, amount: withdrawalAmount, reason: 'All conditions met' };
  }

  /**
   * Execute the actual withdrawal
   */
  async executeWithdrawal(amount, tradeResult) {
    try {
      console.log(`🏦 Initiating bank withdrawal: £${amount.toFixed(2)}...`);
      const withdrawal = await this.withdrawToBank(amount);
      
      tradeResult.withdrawal = withdrawal;
      console.log(`✅ Complete! £${amount.toFixed(2)} will be deposited to your bank account.`);
      
      // Final balance check for profit tracking
      const finalBalances = await this.getAccountBalances();
      this.profitTracker.recordBalance(finalBalances, 'post-withdrawal');
      
      return withdrawal;
    } catch (error) {
      console.error('❌ Withdrawal failed:', error.message);
      throw error;
    }
  }

  /**
   * Complete automated trading sequence: BTC -> GBP -> Bank
   */
  async autoTradeToBankAccount(btcAmount, options = {}) {
    try {
      console.log('🤖 Starting automated BTC to bank account conversion...');
      
      // Step 1: Convert BTC to GBP
      const tradeResult = await this.executeBTCtoGBP(btcAmount, options);
      
      if (options.confirmTrade === false) {
        console.log('ℹ️ Stopping at calculation phase (no execution)');
        return tradeResult;
      }
      
      // Step 2: Handle GBP withdrawal based on configuration
      if (options.withdrawToBank !== false && tradeResult.feeCalculation) {
        const withdrawalAmount = tradeResult.feeCalculation.finalAmount;
        const shouldWithdraw = await this.evaluateWithdrawalConditions(withdrawalAmount, options);
        
        if (shouldWithdraw.withdraw) {
          if (options.withdrawalDelay && options.withdrawalDelay > 0) {
            console.log(`⏳ Delaying withdrawal for ${options.withdrawalDelay} minutes...`);
            // In production, this would schedule the withdrawal
            setTimeout(async () => {
              await this.executeWithdrawal(shouldWithdraw.amount, tradeResult);
            }, options.withdrawalDelay * 60 * 1000);
          } else {
            await this.executeWithdrawal(shouldWithdraw.amount, tradeResult);
          }
        } else {
          console.log(`💰 Keeping £${withdrawalAmount.toFixed(2)} in Coinbase GBP wallet`);
          console.log(`   Reason: ${shouldWithdraw.reason}`);
        }
      }
      
      return tradeResult;
      
    } catch (error) {
      console.error('❌ Automated trading failed:', error.message);
      throw error;
    }
  }

  /**
   * Load trading history from file
   */
  loadTradingHistory() {
    try {
      if (fs.existsSync(this.config.logFile)) {
        const data = fs.readFileSync(this.config.logFile, 'utf8');
        this.tradingHistory = JSON.parse(data);
        console.log(`📂 Loaded ${this.tradingHistory.length} trading records`);
      }
    } catch (error) {
      console.log('⚠️ Could not load trading history:', error.message);
      this.tradingHistory = [];
    }
  }

  /**
   * Log a trade to history
   */
  logTrade(trade) {
    this.tradingHistory.push(trade);
    
    try {
      fs.writeFileSync(this.config.logFile, JSON.stringify(this.tradingHistory, null, 2));
      console.log('📝 Trade logged to history');
    } catch (error) {
      console.error('❌ Failed to log trade:', error.message);
    }
  }

  /**
   * Get trading statistics
   */
  getTradingStats() {
    if (this.tradingHistory.length === 0) {
      return { totalTrades: 0, totalVolume: 0, totalFees: 0, totalBTC: 0, totalGBP: 0, averageFeePercent: 0 };
    }

    const stats = this.tradingHistory.reduce((acc, trade) => {
      if (trade.feeCalculation) {
        acc.totalVolume += trade.feeCalculation.grossGbpValue || 0;
        acc.totalFees += trade.feeCalculation.fees.total || 0;
        acc.totalBTC += trade.btcAmount || 0;
        acc.totalGBP += trade.feeCalculation.finalAmount || 0;
      }
      return acc;
    }, { totalTrades: this.tradingHistory.length, totalVolume: 0, totalFees: 0, totalBTC: 0, totalGBP: 0 });

    stats.averageFeePercent = stats.totalVolume > 0 ? (stats.totalFees / stats.totalVolume) * 100 : 0;
    
    return stats;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  const trader = new CoinbaseTrader({
    dryRun: true, // Always start in dry run mode for safety
    sandbox: false,
    maxTradeAmount: 0.01
  });

  switch (command) {
    case 'price':
      trader.getCurrentPrice().then(price => {
        console.log('💰 Current BTC-GBP Market Data:');
        console.log(`   Price: £${price.price.toLocaleString('en-GB')}`);
        console.log(`   Bid: £${price.bid.toLocaleString('en-GB')}`);
        console.log(`   Ask: £${price.ask.toLocaleString('en-GB')}`);
        console.log(`   Spread: £${price.spread.toFixed(2)} (${price.spreadPercent.toFixed(3)}%)`);
      }).catch(console.error);
      break;

    case 'calculate':
      const btcAmount = parseFloat(args[1]) || 0.01;
      trader.getCurrentPrice().then(price => {
        const calc = trader.calculateFees(btcAmount, price.bid);
        trader.displayFeeBreakdown(calc);
      }).catch(console.error);
      break;

    case 'balance':
      trader.getAccountBalances().then(balances => {
        console.log('🏦 Account Balances:');
        Object.entries(balances).forEach(([currency, balance]) => {
          console.log(`   ${currency}: ${balance.available} (Hold: ${balance.hold})`);
        });
      }).catch(console.error);
      break;

    case 'simulate':
      const simAmount = parseFloat(args[1]) || 0.01;
      trader.autoTradeToBankAccount(simAmount, { confirmTrade: false }).then(result => {
        console.log('✅ Simulation completed');
      }).catch(console.error);
      break;

    case 'stats':
      const stats = trader.getTradingStats();
      console.log('📊 Trading Statistics:');
      console.log(`   Total Trades: ${stats.totalTrades}`);
      console.log(`   Total BTC Traded: ${stats.totalBTC}`);
      console.log(`   Total GBP Value: £${stats.totalGBP.toFixed(2)}`);
      console.log(`   Total Fees Paid: £${stats.totalFees.toFixed(2)}`);
      console.log(`   Average Fee %: ${stats.averageFeePercent.toFixed(2)}%`);
      
      // Show profit report as well
      console.log('\n' + '='.repeat(40));
      trader.profitTracker.displayProfitReport();
      break;

    case 'profit':
      trader.profitTracker.displayProfitReport();
      break;

    case 'set-initial-balance':
      const initialAmount = parseFloat(args[1]);
      if (initialAmount) {
        trader.profitTracker.setInitialBalance(initialAmount);
      } else {
        console.log('Usage: node btc-trader.js set-initial-balance 1000');
      }
      break;

    default:
      console.log(`
🤖 Coinbase Auto Trading System with Profit Tracking

Commands:
  price                    Get current BTC-GBP market data
  calculate [amount]       Calculate fees for BTC amount (default: 0.01)
  balance                 Show account balances
  simulate [amount]       Simulate full trading process (default: 0.01)
  stats                   Show trading & profit statistics
  profit                  Show detailed profit report
  set-initial-balance [amt] Set initial balance for profit tracking

Examples:
  node btc-trader.js price
  node btc-trader.js calculate 0.05
  node btc-trader.js simulate 0.02
  node btc-trader.js set-initial-balance 1000

⚠️ SAFETY: All operations run in DRY RUN mode by default.
To enable real trading, you must configure API credentials and set dryRun: false.

💰 PROFIT TRACKING: Set your initial balance to track profits/losses.
System will alert you when you reach £10 profit threshold (configurable).
      `);
  }
}

module.exports = CoinbaseTrader;