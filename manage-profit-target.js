#!/usr/bin/env node

/**
 * Profit Target Management Tool
 * Configure profit targets for automated trading
 */

const fs = require('fs');
const path = require('path');

class ProfitTargetManager {
  constructor() {
    this.configPath = path.join(__dirname, 'config', 'unified-config.json');
  }

  loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      console.error('❌ Unified config file not found!');
      process.exit(1);
    }
    return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
  }

  saveConfig(config) {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  showCurrentSettings() {
    const config = this.loadConfig();
    
    console.log('\n💰 Current Profit Target Settings:');
    console.log('');
    console.log(`🎯 Main Profit Target: £${config.selling?.profitTarget || 10}`);
    console.log(`₿ BTC Profit Target: £${config.selling?.btcProfitTarget || 10}`);
    console.log(`📊 Profit Tracking Threshold: £${config.profitTracking?.profitThreshold || 10}`);
    console.log('');
    
    // Show what this means in practical terms
    this.showCalculatedTargets(config);
  }

  showCalculatedTargets(config) {
    const profitTarget = config.selling?.profitTarget || 10;
    
    // Estimate typical fees for a £200 BTC holding
    const estimatedBtcValue = 200;
    const feeRate = 0.0075; // 0.75% combined (trading + spread)
    const withdrawalFee = 0.15;
    
    const estimatedTotalFees = (estimatedBtcValue * feeRate) + withdrawalFee;
    const requiredGrossProfit = profitTarget + estimatedTotalFees;
    const requiredSaleAmount = estimatedBtcValue + requiredGrossProfit;
    
    console.log('📈 Practical Impact (based on £200 BTC holding):');
    console.log(`   Target Net Profit: £${profitTarget.toFixed(2)}`);
    console.log(`   Estimated Fees: £${estimatedTotalFees.toFixed(2)}`);
    console.log(`   Required Gross Profit: £${requiredGrossProfit.toFixed(2)}`);
    console.log(`   Required Sale Amount: £${requiredSaleAmount.toFixed(2)}`);
    console.log('');
  }

  setProfitTarget(amount) {
    if (isNaN(amount) || amount <= 0) {
      console.error('❌ Invalid profit target amount. Must be a positive number.');
      process.exit(1);
    }

    const config = this.loadConfig();
    
    // Update all profit-related settings
    config.selling.profitTarget = amount;
    config.selling.btcProfitTarget = amount;
    config.profitTracking.profitThreshold = amount;
    
    this.saveConfig(config);
    
    console.log(`✅ Profit target updated to £${amount}`);
    console.log('');
    this.showCurrentSettings();
  }

  setMainProfitTarget(amount) {
    if (isNaN(amount) || amount <= 0) {
      console.error('❌ Invalid profit target amount. Must be a positive number.');
      process.exit(1);
    }

    const config = this.loadConfig();
    config.selling.profitTarget = amount;
    this.saveConfig(config);
    
    console.log(`✅ Main profit target updated to £${amount}`);
    this.showCurrentSettings();
  }

  setBtcProfitTarget(amount) {
    if (isNaN(amount) || amount <= 0) {
      console.error('❌ Invalid BTC profit target amount. Must be a positive number.');
      process.exit(1);
    }

    const config = this.loadConfig();
    config.selling.btcProfitTarget = amount;
    this.saveConfig(config);
    
    console.log(`✅ BTC profit target updated to £${amount}`);
    this.showCurrentSettings();
  }

  setTrackingThreshold(amount) {
    if (isNaN(amount) || amount <= 0) {
      console.error('❌ Invalid tracking threshold amount. Must be a positive number.');
      process.exit(1);
    }

    const config = this.loadConfig();
    config.profitTracking.profitThreshold = amount;
    this.saveConfig(config);
    
    console.log(`✅ Profit tracking threshold updated to £${amount}`);
    this.showCurrentSettings();
  }

  showHelp() {
    console.log(`
💰 Profit Target Management Tool

Usage:
  node manage-profit-target.js [command] [options]

Commands:
  show                    Show current profit target settings
  set <amount>           Set all profit targets to amount (main, BTC, tracking)
  set-main <amount>      Set main profit target only
  set-btc <amount>       Set BTC profit target only  
  set-tracking <amount>  Set profit tracking threshold only
  help                   Show this help message

Examples:
  node manage-profit-target.js show
  node manage-profit-target.js set 15
  node manage-profit-target.js set-main 20
  node manage-profit-target.js set-btc 25
  node manage-profit-target.js set-tracking 10

Notes:
  - Main profit target: Controls when system triggers sells for net profit
  - BTC profit target: Alternative BTC-specific profit threshold
  - Tracking threshold: Used for profit tracking alerts and milestones
  - All amounts are in GBP (£)
  - Changes take effect immediately for new trading decisions
`);
  }
}

// Command line interface
function main() {
  const manager = new ProfitTargetManager();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    manager.showCurrentSettings();
    return;
  }

  const command = args[0].toLowerCase();
  
  switch (command) {
    case 'show':
      manager.showCurrentSettings();
      break;
      
    case 'set':
      const amount = parseFloat(args[1]);
      if (!amount) {
        console.error('❌ Please specify an amount: node manage-profit-target.js set 15');
        process.exit(1);
      }
      manager.setProfitTarget(amount);
      break;
      
    case 'set-main':
      const mainAmount = parseFloat(args[1]);
      if (!mainAmount) {
        console.error('❌ Please specify an amount: node manage-profit-target.js set-main 20');
        process.exit(1);
      }
      manager.setMainProfitTarget(mainAmount);
      break;
      
    case 'set-btc':
      const btcAmount = parseFloat(args[1]);
      if (!btcAmount) {
        console.error('❌ Please specify an amount: node manage-profit-target.js set-btc 25');
        process.exit(1);
      }
      manager.setBtcProfitTarget(btcAmount);
      break;
      
    case 'set-tracking':
      const trackingAmount = parseFloat(args[1]);
      if (!trackingAmount) {
        console.error('❌ Please specify an amount: node manage-profit-target.js set-tracking 10');
        process.exit(1);
      }
      manager.setTrackingThreshold(trackingAmount);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      manager.showHelp();
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      manager.showHelp();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ProfitTargetManager;