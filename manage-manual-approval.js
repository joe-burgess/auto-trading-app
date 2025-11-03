#!/usr/bin/env node

/**
 * Manual Approval Management Tool
 * Configure Telegram manual approval settings for buy/sell operations
 */

const fs = require('fs');
const path = require('path');

class ManualApprovalManager {
  constructor() {
    this.configPath = path.join(__dirname, 'config', 'telegram-config.json');
  }

  loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      console.error('❌ Telegram config file not found!');
      process.exit(1);
    }
    return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
  }

  saveConfig(config) {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  showCurrentSettings() {
    const config = this.loadConfig();
    const manualApproval = config.alerts?.manualApproval || {};
    
    console.log('\n📱 Current Manual Approval Settings:');
    console.log('');
    console.log(`🔧 Manual Approval: ${manualApproval.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`🛒 Buy Approval Required: ${manualApproval.requireBuyApproval ? '✅ Yes' : '❌ No'}`);
    console.log(`💰 Sell Approval Required: ${manualApproval.requireSellApproval ? '✅ Yes' : '❌ No'}`);
    console.log(`⏱️ Approval Timeout: ${manualApproval.timeoutMinutes || 15} minutes`);
    console.log('');
  }

  enableManualApproval(buyApproval = true, sellApproval = true) {
    const config = this.loadConfig();
    
    if (!config.alerts) config.alerts = {};
    if (!config.alerts.manualApproval) config.alerts.manualApproval = {};
    
    config.alerts.manualApproval.enabled = true;
    config.alerts.manualApproval.requireBuyApproval = buyApproval;
    config.alerts.manualApproval.requireSellApproval = sellApproval;
    
    this.saveConfig(config);
    
    console.log('\n✅ Manual approval enabled!');
    console.log(`🛒 Buy approval: ${buyApproval ? 'Required' : 'Auto'}`);
    console.log(`💰 Sell approval: ${sellApproval ? 'Required' : 'Auto'}`);
    console.log('\n💡 The system will now send Telegram messages requesting approval before trades.');
  }

  disableManualApproval() {
    const config = this.loadConfig();
    
    if (!config.alerts) config.alerts = {};
    if (!config.alerts.manualApproval) config.alerts.manualApproval = {};
    
    config.alerts.manualApproval.enabled = false;
    
    this.saveConfig(config);
    
    console.log('\n❌ Manual approval disabled!');
    console.log('🤖 The system will now trade automatically when conditions are met.');
  }

  setApprovalTimeout(minutes) {
    const config = this.loadConfig();
    
    if (!config.alerts) config.alerts = {};
    if (!config.alerts.manualApproval) config.alerts.manualApproval = {};
    
    config.alerts.manualApproval.timeoutMinutes = minutes;
    
    this.saveConfig(config);
    
    console.log(`\n⏱️ Approval timeout set to ${minutes} minutes`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'show';
  
  const manager = new ManualApprovalManager();
  
  switch (command) {
    case 'show':
    case 'status':
      manager.showCurrentSettings();
      break;
      
    case 'enable':
      const buyApproval = !args.includes('--no-buy');
      const sellApproval = !args.includes('--no-sell');
      manager.enableManualApproval(buyApproval, sellApproval);
      break;
      
    case 'disable':
      manager.disableManualApproval();
      break;
      
    case 'enable-buy-only':
      manager.enableManualApproval(true, false);
      break;
      
    case 'enable-sell-only':
      manager.enableManualApproval(false, true);
      break;
      
    case 'timeout':
      const minutes = parseInt(args[1]);
      if (minutes && minutes > 0) {
        manager.setApprovalTimeout(minutes);
      } else {
        console.log('Usage: node manage-manual-approval.js timeout <minutes>');
      }
      break;
      
    case 'help':
    default:
      console.log(`
📱 Manual Approval Management Tool

Usage: node manage-manual-approval.js [command] [options]

Commands:
  show                  Show current settings (default)
  enable               Enable manual approval for both buy and sell
  disable              Disable manual approval (automatic trading)
  enable-buy-only      Require approval only for buys
  enable-sell-only     Require approval only for sells
  timeout <minutes>    Set approval timeout in minutes

Options for 'enable':
  --no-buy            Don't require buy approval
  --no-sell           Don't require sell approval

Examples:
  node manage-manual-approval.js show
  node manage-manual-approval.js enable
  node manage-manual-approval.js enable --no-sell
  node manage-manual-approval.js enable-buy-only
  node manage-manual-approval.js disable
  node manage-manual-approval.js timeout 30

📋 Manual Approval Modes:
  🤖 Automatic: Trades execute immediately when conditions are met
  📱 Manual: Telegram messages request approval before executing trades
  🔀 Hybrid: Approval required for specific trade types only

💡 When manual approval is enabled, the system will:
  - Send Telegram messages when trade opportunities are detected
  - Wait for your /buy_yes, /buy_no, /sell_yes, or /sell_no response
  - Execute trades only after approval
  - Timeout after the specified minutes if no response
      `);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Error:', error.message);
    process.exit(1);
  });
}

module.exports = ManualApprovalManager;