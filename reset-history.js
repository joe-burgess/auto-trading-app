#!/usr/bin/env node

// Trading History Reset Utility
const fs = require('fs');
const path = require('path');

class TradingHistoryReset {
  constructor() {
    this.dataDir = './data';
    this.configDir = './config';
    
    // Define initial balance values
    this.initialBalance = {
      timestamp: new Date().toISOString(),
      btcAmount: 0.0035,
      btcValue: 50.012315,
      gbpAmount: 0,
      totalValue: 50.012315,
      btcPrice: 14289.09
    };
  }

  /**
   * Reset all trading history while preserving initial balance
   */
  resetAllHistory() {
    console.log('🔄 Resetting all trading history...');
    
    try {
      // Reset profit tracking with initial balance only
      this.resetProfitTracking();
      
      // Reset balance history with initial setup only
      this.resetBalanceHistory();
      
      // Clear all trading logs
      this.clearTradingLogs();
      
      // Reset buying system last sell price
      this.resetBuyingMetadata();
      
      console.log('✅ All trading history reset successfully!');
      console.log(`📊 Initial balance preserved: £${this.initialBalance.totalValue.toFixed(2)}`);
      console.log(`   BTC: ${this.initialBalance.btcAmount} (£${this.initialBalance.btcValue.toFixed(2)})`);
      console.log(`   GBP: £${this.initialBalance.gbpAmount}`);
      
    } catch (error) {
      console.error('❌ Error resetting history:', error.message);
      process.exit(1);
    }
  }

  /**
   * Reset profit tracking to initial balance only
   */
  resetProfitTracking() {
    const profitTrackingData = [
      {
        timestamp: this.initialBalance.timestamp,
        type: "initial_balance",
        balances: {
          GBP: {
            total: this.initialBalance.gbpAmount,
            available: this.initialBalance.gbpAmount,
            held: 0
          },
          BTC: {
            total: this.initialBalance.btcAmount,
            available: this.initialBalance.btcAmount,
            held: 0
          }
        },
        btcPrice: this.initialBalance.btcPrice,
        portfolioValue: {
          gbp: this.initialBalance.gbpAmount,
          btc: this.initialBalance.btcValue,
          total: this.initialBalance.totalValue
        },
        note: `Initial balance: £${this.initialBalance.btcValue.toFixed(2)} worth of BTC (${this.initialBalance.btcAmount} BTC) + £${this.initialBalance.gbpAmount} GBP`
      }
    ];

    this.writeDataFile('profit-tracking.json', profitTrackingData);
    console.log('✅ Profit tracking reset');
  }

  /**
   * Reset balance history to initial setup only
   */
  resetBalanceHistory() {
    const balanceHistoryData = [
      {
        timestamp: this.initialBalance.timestamp,
        type: "initial_setup",
        balances: {
          GBP: {
            total: this.initialBalance.gbpAmount,
            available: this.initialBalance.gbpAmount,
            held: 0
          },
          BTC: {
            total: this.initialBalance.btcAmount,
            available: this.initialBalance.btcAmount,
            held: 0
          }
        },
        btcPrice: this.initialBalance.btcPrice,
        portfolioValue: {
          gbpValue: this.initialBalance.gbpAmount,
          btcValue: this.initialBalance.btcValue,
          totalValue: this.initialBalance.totalValue
        },
        profitLoss: {
          absolute: 0,
          percentage: 0
        },
        note: `Starting balance: ${this.initialBalance.btcAmount} BTC (£${this.initialBalance.btcValue.toFixed(2)} worth) + £${this.initialBalance.gbpAmount} GBP`
      }
    ];

    this.writeDataFile('balance-history.json', balanceHistoryData);
    console.log('✅ Balance history reset');
  }

  /**
   * Clear all trading logs
   */
  clearTradingLogs() {
    const logFiles = [
      'trading-log.json',
      'buying-log.json',
      'btc-price-history.json'
    ];

    logFiles.forEach(filename => {
      this.writeDataFile(filename, []);
    });
    
    console.log('✅ Trading logs cleared');
  }

  /**
   * Reset buying system metadata (last sell price)
   */
  resetBuyingMetadata() {
    const metadataFile = path.join(this.dataDir, 'buying-metadata.json');
    
    try {
      if (fs.existsSync(metadataFile)) {
        const resetMetadata = {
          lastSellPrice: null,
          lastTradeTime: null,
          dailyBuyingTotal: 0,
          lastResetDate: new Date().toDateString()
        };
        
        fs.writeFileSync(metadataFile, JSON.stringify(resetMetadata, null, 2));
        console.log('✅ Buying metadata reset');
      }
    } catch (error) {
      console.log('⚠️ Buying metadata file not found or error resetting');
    }
  }

  /**
   * Update initial balance configuration
   */
  updateConfigInitialBalance() {
    const configFile = path.join(this.configDir, 'unified-config.json');
    
    try {
      if (fs.existsSync(configFile)) {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        
        if (config.profitTracking) {
          config.profitTracking.initialBalance = this.initialBalance.totalValue;
          
          fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
          console.log('✅ Config initial balance updated');
        }
      }
    } catch (error) {
      console.log('⚠️ Error updating config:', error.message);
    }
  }

  /**
   * Write data to file
   */
  writeDataFile(filename, data) {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Display current status after reset
   */
  displayStatus() {
    console.log('\n📊 ===== RESET COMPLETE =====');
    console.log(`💰 Initial Balance: £${this.initialBalance.totalValue.toFixed(2)}`);
    console.log(`₿  BTC Holdings: ${this.initialBalance.btcAmount} BTC`);
    console.log(`💷 GBP Balance: £${this.initialBalance.gbpAmount}`);
    console.log(`📈 BTC Price: £${this.initialBalance.btcPrice.toLocaleString()}`);
    console.log('🔄 All trading history cleared');
    console.log('✅ Ready for fresh trading session');
    console.log('===========================\n');
  }

  /**
   * Backup current data before reset
   */
  createBackup() {
    const backupDir = './data/backups';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const dataFiles = fs.readdirSync(this.dataDir).filter(file => 
        file.endsWith('.json') && !file.startsWith('backup-')
      );

      dataFiles.forEach(file => {
        const source = path.join(this.dataDir, file);
        const backup = path.join(backupDir, `backup-${timestamp}-${file}`);
        
        if (fs.existsSync(source)) {
          fs.copyFileSync(source, backup);
        }
      });

      console.log(`💾 Backup created: ${backupDir}/backup-${timestamp}-*`);
      
    } catch (error) {
      console.log('⚠️ Warning: Could not create backup:', error.message);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const forceFlag = args.includes('--force') || args.includes('-f');

  const resetUtil = new TradingHistoryReset();

  switch (command) {
    case 'reset':
      if (!forceFlag) {
        console.log('⚠️  This will clear ALL trading history!');
        console.log('   Use --force flag to confirm: npm run reset-history -- --force');
        process.exit(1);
      }
      
      resetUtil.createBackup();
      resetUtil.resetAllHistory();
      resetUtil.updateConfigInitialBalance();
      resetUtil.displayStatus();
      break;

    case 'backup':
      resetUtil.createBackup();
      console.log('✅ Backup completed');
      break;

    case 'status':
      resetUtil.displayStatus();
      break;

    case 'help':
    default:
      console.log(`
🔄 Trading History Reset Utility

Commands:
  reset --force      Reset all trading history (requires --force flag)
  backup            Create backup of current data
  status            Show current initial balance settings
  help              Show this help message

Examples:
  node reset-history.js reset --force
  npm run reset-history -- reset --force
  npm run reset-history -- backup

⚠️  WARNING: Reset permanently deletes all trading history!
💾 Automatic backup is created before reset.
      `);
  }
}

module.exports = TradingHistoryReset;