#!/usr/bin/env node

/**
 * Automated Balance Reset Script
 * Resets the trading system to £50 GBP + £200 worth of BTC
 */

const fs = require('fs');
const path = require('path');

class BalanceResetter {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.targetGbp = 50;
    this.targetBtcValue = 200; // £200 worth of BTC
  }

  /**
   * Get current BTC price to calculate the correct BTC amount
   */
  async getCurrentBtcPrice() {
    try {
      // Get fresh price data from the same source as unified trader
      const BTCBuyingSystem = require('./btc-buyer.js');
      const buyer = new BTCBuyingSystem();
      
      // Force a fresh price fetch
      const priceData = await buyer.getCurrentPrice();
      console.log(`🔄 Fetched fresh BTC price: £${priceData.price.toLocaleString()}`);
      return priceData.price;
    } catch (error) {
      console.error('❌ Failed to get current BTC price:', error.message);
      // Fallback to a reasonable current price if API fails
      console.log('⚠️ Using fallback price due to API error');
      return 82000; // Updated fallback to current market levels
    }
  }

  /**
   * Reset balance history to clean state with proper baseline tracking
   */
  resetBalanceHistory(btcPrice, btcAmount) {
    const balanceHistoryPath = path.join(this.dataDir, 'balance-history.json');
    
    const resetRecord = {
      timestamp: new Date().toISOString(),
      source: "automated-reset",
      gbpBalance: this.targetGbp,
      btcBalance: btcAmount,
      btcPrice: btcPrice,
      btcValueInGbp: this.targetBtcValue,
      totalBalance: this.targetGbp + this.targetBtcValue,
      profitLoss: 0,
      resetBaseline: {
        btcAmount: btcAmount,
        btcBaselinePrice: btcPrice,
        btcBaselineValue: this.targetBtcValue,
        totalBaselineValue: this.targetGbp + this.targetBtcValue
      },
      note: `Automated reset: £${this.targetGbp} GBP + £${this.targetBtcValue} worth of BTC (${btcAmount.toFixed(8)} BTC) = £${this.targetGbp + this.targetBtcValue} total`
    };

    fs.writeFileSync(balanceHistoryPath, JSON.stringify([resetRecord], null, 2));
    console.log('✅ Balance history reset with baseline tracking');
  }

  /**
   * Clear buying log
   */
  resetBuyingLog() {
    const buyingLogPath = path.join(this.dataDir, 'buying-log.json');
    fs.writeFileSync(buyingLogPath, JSON.stringify([], null, 2));
    console.log('✅ Buying log cleared');
  }

  /**
   * Clear profit tracking (optional)
   */
  resetProfitTracking() {
    const profitTrackingPath = path.join(this.dataDir, 'profit-tracking.json');
    if (fs.existsSync(profitTrackingPath)) {
      fs.writeFileSync(profitTrackingPath, JSON.stringify([], null, 2));
      console.log('✅ Profit tracking reset');
    }
  }

  /**
   * Update hardcoded BTC balance in btc-buyer.js
   */
  updateBtcBuyerBalance(btcAmount) {
    const btcBuyerPath = path.join(__dirname, 'btc-buyer.js');
    let content = fs.readFileSync(btcBuyerPath, 'utf8');
    
    // Update the initial BTC balance (handle multiple comment patterns)
    content = content.replace(
      /let btcBalance = [0-9.]+;.*\/\/ Current BTC amount after reset.*/g,
      `let btcBalance = ${btcAmount.toFixed(8)}; // Current BTC amount after reset (£${this.targetBtcValue} worth)`
    );
    
    // Update the fallback BTC balance in simulated accounts
    content = content.replace(
      /BTC: { balance: [0-9.]+, available: [0-9.]+, hold: 0 }/g,
      `BTC: { balance: ${btcAmount.toFixed(8)}, available: ${btcAmount.toFixed(8)}, hold: 0 }`
    );
    
    fs.writeFileSync(btcBuyerPath, content);
    console.log('✅ BTC buyer balance updated');
  }

  /**
   * Update configuration files with new initial balance
   */
  updateConfigInitialBalance() {
    const configFile = path.join(__dirname, 'config', 'unified-config.json');
    
    try {
      if (fs.existsSync(configFile)) {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        
        if (config.profitTracking) {
          config.profitTracking.initialBalance = this.targetGbp + this.targetBtcValue; // £250 total
          
          fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
          console.log('✅ Config initial balance updated');
        }
      }
    } catch (error) {
      console.log('⚠️ Error updating config:', error.message);
    }
  }

  /**
   * Clear trading logs (optional)
   */
  clearTradingLogs() {
    const tradingDataPath = path.join(this.dataDir, 'trading-data.json');
    if (fs.existsSync(tradingDataPath)) {
      fs.writeFileSync(tradingDataPath, JSON.stringify([], null, 2));
      console.log('✅ Trading logs cleared');
    }
  }

  /**
   * Reset payment tracking and record initial payment
   */
  resetPaymentTracking(btcPrice, btcAmount) {
    try {
      // Clear existing payment history
      const paymentHistoryPath = path.join(this.dataDir, 'payment-history.json');
      
      // Create initial payment record for the reset BTC balance
      const initialPayment = {
        id: `pay_reset_${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('en-GB'),
        gbpAmount: this.targetBtcValue,
        btcAmount: btcAmount,
        btcPrice: btcPrice,
        type: 'initial-balance',
        status: 'active',
        note: `Initial balance from reset: £${this.targetBtcValue} worth of BTC`
      };

      // Write initial payment to file
      fs.writeFileSync(paymentHistoryPath, JSON.stringify([initialPayment], null, 2));
      console.log('✅ Payment tracking reset with initial balance payment');
      console.log(`   💰 Initial payment: £${this.targetBtcValue} for ${btcAmount.toFixed(8)} BTC`);
      
    } catch (error) {
      console.log('⚠️ Error resetting payment tracking:', error.message);
    }
  }

  /**
   * Main reset function
   */
  async performReset(options = {}) {
    console.log('🔄 Starting automated balance reset...\n');
    
    try {
      // Get current BTC price
      console.log('📊 Getting current BTC price...');
      const btcPrice = await this.getCurrentBtcPrice();
      const btcAmount = this.targetBtcValue / btcPrice;
      
      console.log(`💰 Current BTC Price: £${btcPrice.toLocaleString()}`);
      console.log(`🪙 BTC amount for £${this.targetBtcValue}: ${btcAmount.toFixed(8)} BTC\n`);
      
      // Perform resets
      this.resetBalanceHistory(btcPrice, btcAmount);
      this.resetBuyingLog();
      this.updateBtcBuyerBalance(btcAmount);
      this.updateConfigInitialBalance(); // Add this line
      
      if (options.clearProfitTracking !== false) {
        this.resetProfitTracking();
      }
      
      if (options.clearTradingLogs !== false) {
        this.clearTradingLogs();
      }
      
      // Reset payment tracking and record initial payment
      this.resetPaymentTracking(btcPrice, btcAmount);
      
      console.log('\n🎉 Balance reset completed successfully!');
      console.log('📊 New Configuration:');
      console.log(`   💷 GBP Balance: £${this.targetGbp}.00`);
      console.log(`   🪙 BTC Balance: ${btcAmount.toFixed(8)} BTC (£${this.targetBtcValue} worth)`);
      console.log(`   🏦 Total Value: £${this.targetGbp + this.targetBtcValue}.00`);
      console.log(`   📦 Payment Tracking: 1 initial payment recorded`);
      
    } catch (error) {
      console.error('❌ Reset failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Show current balance before reset
   */
  async showCurrentBalance() {
    try {
      const BTCBuyingSystem = require('./btc-buyer.js');
      const buyer = new BTCBuyingSystem();
      const balances = await buyer.getAccountBalances();
      const priceData = await buyer.getCurrentPrice();
      
      const btcValue = balances.BTC.balance * priceData.price;
      const totalValue = balances.GBP.balance + btcValue;
      
      console.log('📋 Current Balance:');
      console.log(`   💷 GBP: £${balances.GBP.balance.toFixed(2)}`);
      console.log(`   🪙 BTC: ${balances.BTC.balance.toFixed(8)} BTC (£${btcValue.toFixed(2)})`);
      console.log(`   🏦 Total: £${totalValue.toFixed(2)}\n`);
      
    } catch (error) {
      console.log('⚠️ Could not get current balance:', error.message, '\n');
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const resetter = new BalanceResetter();
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔄 Automated Balance Reset Script

Usage: node reset-balance.js [options]

Options:
  --help, -h          Show this help message
  --show-current      Show current balance before reset
  --keep-profit       Don't reset profit tracking
  --keep-logs         Don't clear trading logs
  --confirm           Skip confirmation prompt

This script resets your trading system to:
  💷 £50 GBP + 🪙 £200 worth of BTC = 🏦 £250 total

Files affected:
  - data/balance-history.json (reset to clean state)
  - data/buying-log.json (cleared)
  - data/profit-tracking.json (cleared unless --keep-profit)
  - data/trading-data.json (cleared unless --keep-logs)
  - btc-buyer.js (BTC balance updated)
`);
    return;
  }
  
  if (args.includes('--show-current')) {
    await resetter.showCurrentBalance();
    return;
  }
  
  // Show current balance
  await resetter.showCurrentBalance();
  
  // Confirmation prompt unless --confirm is passed
  if (!args.includes('--confirm')) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const confirm = await new Promise(resolve => {
      rl.question('❓ Reset to £50 GBP + £200 BTC? (yes/no): ', answer => {
        rl.close();
        resolve(answer.toLowerCase().trim());
      });
    });
    
    if (confirm !== 'yes' && confirm !== 'y') {
      console.log('❌ Reset cancelled');
      return;
    }
  }
  
  // Perform reset with options
  const options = {
    clearProfitTracking: !args.includes('--keep-profit'),
    clearTradingLogs: !args.includes('--keep-logs')
  };
  
  await resetter.performReset(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = BalanceResetter;