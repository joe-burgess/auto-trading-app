#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import required modules
const ProfitTracker = require('./profit-tracker');

class BalanceInitializer {
  constructor() {
    this.loadConfig();
    this.initializeProfitTracker();
  }

  /**
   * Load configuration
   */
  loadConfig() {
    try {
      const configData = fs.readFileSync('./config/unified-config.json', 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      console.error('❌ Error loading config:', error.message);
      process.exit(1);
    }
  }

  /**
   * Initialize profit tracker
   */
  initializeProfitTracker() {
    this.profitTracker = new ProfitTracker(this.config.profitTracking || {});
  }

  /**
   * Make authenticated API request to Coinbase
   */
  async makeApiRequest(method, path, body = null) {
    if (this.config.api?.sandbox !== false) {
      console.log('⚠️ WARNING: Using sandbox mode. No real API credentials configured.');
      return this.simulateApiResponse(path);
    }

    // In production, this would use real Coinbase Pro API with authentication
    const crypto = require('crypto');
    const timestamp = Date.now() / 1000;
    
    // This would normally use your API credentials
    const apiKey = process.env.COINBASE_API_KEY;
    const apiSecret = process.env.COINBASE_API_SECRET;
    const passphrase = process.env.COINBASE_PASSPHRASE;

    if (!apiKey || !apiSecret || !passphrase) {
      throw new Error('Coinbase API credentials not configured');
    }

    // Implementation would go here for real API calls
    throw new Error('Real API implementation needed for production');
  }

  /**
   * Simulate API responses for testing
   */
  simulateApiResponse(path) {
    if (path === '/accounts') {
      return [
        {
          id: 'gbp-account-id',
          currency: 'GBP',
          balance: '1250.75',
          available: '1250.75',
          hold: '0.00'
        },
        {
          id: 'btc-account-id', 
          currency: 'BTC',
          balance: '0.08745',
          available: '0.08745',
          hold: '0.00'
        }
      ];
    }
    
    if (path === '/products/BTC-GBP/ticker') {
      return {
        price: '89750.25',
        bid: '89725.00',
        ask: '89775.50'
      };
    }

    return {};
  }

  /**
   * Fetch current account balances from Coinbase
   */
  async fetchCurrentBalances() {
    try {
      console.log('🔄 Fetching current account balances from Coinbase...');
      
      const accounts = await this.makeApiRequest('GET', '/accounts');
      const priceData = await this.makeApiRequest('GET', '/products/BTC-GBP/ticker');
      
      const balances = {
        GBP: null,
        BTC: null
      };

      // Parse account data
      accounts.forEach(account => {
        if (account.currency === 'GBP') {
          balances.GBP = {
            total: parseFloat(account.balance),
            available: parseFloat(account.available),
            held: parseFloat(account.hold || 0)
          };
        } else if (account.currency === 'BTC') {
          balances.BTC = {
            total: parseFloat(account.balance),
            available: parseFloat(account.available),
            held: parseFloat(account.hold || 0)
          };
        }
      });

      // Calculate portfolio value
      const btcPrice = parseFloat(priceData.price);
      const gbpValue = balances.GBP?.available || 0;
      const btcValue = (balances.BTC?.available || 0) * btcPrice;
      const totalValue = gbpValue + btcValue;

      return {
        balances,
        btcPrice,
        gbpValue,
        btcValue,
        totalValue,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error fetching balances:', error.message);
      throw error;
    }
  }

  /**
   * Display current balances in a formatted way
   */
  displayBalances(balanceData) {
    console.log('\n💰 ======= CURRENT COINBASE BALANCES =======');
    console.log(`📅 Timestamp: ${new Date(balanceData.timestamp).toLocaleString()}`);
    console.log(`📈 BTC Price: £${balanceData.btcPrice.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log('\n💷 GBP BALANCE:');
    console.log(`   Available: £${balanceData.gbpValue.toFixed(2)}`);
    console.log(`   Held: £${balanceData.balances.GBP?.held?.toFixed(2) || '0.00'}`);
    
    console.log('\n₿ BTC BALANCE:');
    console.log(`   Available: ${balanceData.balances.BTC?.available?.toFixed(8) || '0.00000000'} BTC`);
    console.log(`   GBP Value: £${balanceData.btcValue.toFixed(2)}`);
    console.log(`   Held: ${balanceData.balances.BTC?.held?.toFixed(8) || '0.00000000'} BTC`);
    
    console.log('\n📊 PORTFOLIO SUMMARY:');
    console.log(`   Total GBP: £${balanceData.gbpValue.toFixed(2)} (${((balanceData.gbpValue / balanceData.totalValue) * 100).toFixed(1)}%)`);
    console.log(`   Total BTC Value: £${balanceData.btcValue.toFixed(2)} (${((balanceData.btcValue / balanceData.totalValue) * 100).toFixed(1)}%)`);
    console.log(`   Total Portfolio: £${balanceData.totalValue.toFixed(2)}`);
    console.log('==========================================\n');
  }

  /**
   * Initialize profit tracking with current balances
   */
  async initializeProfitTracking(force = false) {
    try {
      // Check if initial balance is already set
      if (this.profitTracker.config.initialBalance && !force) {
        console.log(`ℹ️ Initial balance already set: £${this.profitTracker.config.initialBalance.toFixed(2)}`);
        console.log('💡 Use --force to override existing initial balance');
        return false;
      }

      const balanceData = await this.fetchCurrentBalances();
      
      // Record the balance snapshot
      const balanceRecord = this.profitTracker.recordBalance(balanceData.balances, 'initialization');
      
      console.log('✅ Profit tracking initialized with current balances!');
      console.log(`💰 Initial balance set to: £${balanceRecord.totalBalance.toFixed(2)}`);
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing profit tracking:', error.message);
      throw error;
    }
  }

  /**
   * Update current balances (for regular monitoring)
   */
  async updateCurrentBalances() {
    try {
      const balanceData = await this.fetchCurrentBalances();
      this.displayBalances(balanceData);
      
      // Record current balance for profit tracking
      const balanceRecord = this.profitTracker.recordBalance(balanceData.balances, 'update');
      
      if (this.profitTracker.config.initialBalance) {
        const currentProfit = balanceRecord.profitLoss;
        console.log(`📈 Current Profit/Loss: £${currentProfit.toFixed(2)}`);
        
        if (currentProfit > 0) {
          console.log(`🎉 You're up £${currentProfit.toFixed(2)} since initialization!`);
        } else if (currentProfit < 0) {
          console.log(`📉 You're down £${Math.abs(currentProfit).toFixed(2)} since initialization`);
        } else {
          console.log(`💹 No change since initialization`);
        }
      }
      
      return balanceData;
    } catch (error) {
      console.error('❌ Error updating balances:', error.message);
      throw error;
    }
  }

  /**
   * Reset profit tracking
   */
  resetProfitTracking() {
    this.profitTracker.resetProfitTracking();
    console.log('🔄 Profit tracking has been reset');
    console.log('💡 Run "init" command to set new initial balance');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const force = args.includes('--force');

  const initializer = new BalanceInitializer();

  async function runCommand() {
    try {
      switch (command) {
        case 'init':
          const initialized = await initializer.initializeProfitTracking(force);
          if (initialized) {
            const balanceData = await initializer.fetchCurrentBalances();
            initializer.displayBalances(balanceData);
          }
          break;

        case 'update':
          await initializer.updateCurrentBalances();
          break;

        case 'balances':
        case 'status':
          const balanceData = await initializer.fetchCurrentBalances();
          initializer.displayBalances(balanceData);
          break;

        case 'reset':
          initializer.resetProfitTracking();
          break;

        case 'help':
        default:
          console.log('\n🏦 Balance Initializer Commands:');
          console.log('');
          console.log('  init [--force]     Initialize profit tracking with current Coinbase balances');
          console.log('  update             Update current balances and show profit/loss');
          console.log('  balances           Show current Coinbase balances (alias: status)');
          console.log('  reset              Reset profit tracking data');
          console.log('  help               Show this help message');
          console.log('');
          console.log('Examples:');
          console.log('  node balance-init.js init          # Set initial balance from Coinbase');
          console.log('  node balance-init.js update        # Check current P&L');
          console.log('  node balance-init.js balances      # Show current balances');
          console.log('  node balance-init.js init --force  # Override existing initial balance');
          console.log('');
          break;
      }
    } catch (error) {
      console.error('❌ Command failed:', error.message);
      process.exit(1);
    }
  }

  runCommand();
}

module.exports = BalanceInitializer;