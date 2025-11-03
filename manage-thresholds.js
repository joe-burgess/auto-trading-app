#!/usr/bin/env node

/**
 * Telegram Alert Threshold Manager
 * Easy configuration tool for multi-threshold price alerts
 */

const fs = require('fs');
const path = require('path');

class ThresholdManager {
  constructor() {
    this.configPath = path.join(__dirname, 'config', 'telegram-config.json');
  }

  /**
   * Load current configuration
   */
  loadConfig() {
    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (error) {
      console.error('❌ Failed to load Telegram config:', error.message);
      return null;
    }
  }

  /**
   * Save configuration
   */
  saveConfig(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('✅ Configuration saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to save config:', error.message);
      return false;
    }
  }

  /**
   * Show current threshold configuration
   */
  showCurrentConfig() {
    const config = this.loadConfig();
    if (!config) return;

    const thresholds = config.alerts?.priceThresholds;
    
    console.log('📊 Current Telegram Alert Configuration\n');
    
    if (!thresholds?.enabled) {
      console.log('⚠️ Multi-threshold alerts are DISABLED');
      console.log('   Using basic single-threshold system\n');
      return;
    }

    console.log('✅ Multi-threshold alerts are ENABLED\n');
    
    if (thresholds.dropThresholds?.length > 0) {
      console.log('📉 DROP THRESHOLDS:');
      thresholds.dropThresholds
        .sort((a, b) => b.price - a.price)
        .forEach((threshold, index) => {
          const cooldownMin = Math.round(threshold.cooldown / 60000);
          console.log(`   ${index + 1}. £${threshold.price.toLocaleString()} - ${threshold.priority?.toUpperCase() || 'MEDIUM'} (${cooldownMin}min cooldown)`);
          console.log(`      Message: "${threshold.message}"`);
        });
      console.log('');
    }
    
    if (thresholds.riseThresholds?.length > 0) {
      console.log('📈 RISE THRESHOLDS:');
      thresholds.riseThresholds
        .sort((a, b) => a.price - b.price)
        .forEach((threshold, index) => {
          const cooldownMin = Math.round(threshold.cooldown / 60000);
          console.log(`   ${index + 1}. £${threshold.price.toLocaleString()} - ${threshold.priority?.toUpperCase() || 'MEDIUM'} (${cooldownMin}min cooldown)`);
          console.log(`      Message: "${threshold.message}"`);
        });
      console.log('');
    }
    
    if (thresholds.percentageAlerts?.enabled) {
      const pct = thresholds.percentageAlerts;
      const cooldownMin = Math.round(pct.cooldown / 60000);
      console.log('📊 PERCENTAGE ALERTS:');
      console.log(`   Drop: ${pct.significantDrop}% | Rise: ${pct.significantRise}% (${cooldownMin}min cooldown)\n`);
    }
  }

  /**
   * Add a new drop threshold
   */
  addDropThreshold(price, message, priority = 'medium', cooldownMinutes = 60) {
    const config = this.loadConfig();
    if (!config) return false;

    if (!config.alerts.priceThresholds) {
      config.alerts.priceThresholds = { enabled: true, dropThresholds: [], riseThresholds: [] };
    }

    if (!config.alerts.priceThresholds.dropThresholds) {
      config.alerts.priceThresholds.dropThresholds = [];
    }

    // Check if threshold already exists
    const exists = config.alerts.priceThresholds.dropThresholds.find(t => t.price === price);
    if (exists) {
      console.log(`⚠️ Drop threshold for £${price.toLocaleString()} already exists`);
      return false;
    }

    const threshold = {
      price: price,
      message: message || `🔻 BTC Alert: Price dropped to £${price.toLocaleString()}`,
      priority: priority,
      cooldown: cooldownMinutes * 60 * 1000
    };

    config.alerts.priceThresholds.dropThresholds.push(threshold);
    config.alerts.priceThresholds.enabled = true;

    if (this.saveConfig(config)) {
      console.log(`✅ Added drop threshold: £${price.toLocaleString()} (${priority})`);
      return true;
    }
    return false;
  }

  /**
   * Add a new rise threshold
   */
  addRiseThreshold(price, message, priority = 'medium', cooldownMinutes = 60) {
    const config = this.loadConfig();
    if (!config) return false;

    if (!config.alerts.priceThresholds) {
      config.alerts.priceThresholds = { enabled: true, dropThresholds: [], riseThresholds: [] };
    }

    if (!config.alerts.priceThresholds.riseThresholds) {
      config.alerts.priceThresholds.riseThresholds = [];
    }

    // Check if threshold already exists
    const exists = config.alerts.priceThresholds.riseThresholds.find(t => t.price === price);
    if (exists) {
      console.log(`⚠️ Rise threshold for £${price.toLocaleString()} already exists`);
      return false;
    }

    const threshold = {
      price: price,
      message: message || `🚀 BTC Alert: Price rose to £${price.toLocaleString()}`,
      priority: priority,
      cooldown: cooldownMinutes * 60 * 1000
    };

    config.alerts.priceThresholds.riseThresholds.push(threshold);
    config.alerts.priceThresholds.enabled = true;

    if (this.saveConfig(config)) {
      console.log(`✅ Added rise threshold: £${price.toLocaleString()} (${priority})`);
      return true;
    }
    return false;
  }

  /**
   * Remove a threshold
   */
  removeThreshold(type, price) {
    const config = this.loadConfig();
    if (!config || !config.alerts.priceThresholds) return false;

    const thresholds = config.alerts.priceThresholds[`${type}Thresholds`];
    if (!thresholds) return false;

    const index = thresholds.findIndex(t => t.price === price);
    if (index === -1) {
      console.log(`⚠️ ${type} threshold for £${price.toLocaleString()} not found`);
      return false;
    }

    thresholds.splice(index, 1);

    if (this.saveConfig(config)) {
      console.log(`✅ Removed ${type} threshold: £${price.toLocaleString()}`);
      return true;
    }
    return false;
  }

  /**
   * Enable/disable multi-threshold alerts
   */
  toggleThresholds(enabled) {
    const config = this.loadConfig();
    if (!config) return false;

    if (!config.alerts.priceThresholds) {
      config.alerts.priceThresholds = { enabled: enabled, dropThresholds: [], riseThresholds: [] };
    } else {
      config.alerts.priceThresholds.enabled = enabled;
    }

    if (this.saveConfig(config)) {
      console.log(`✅ Multi-threshold alerts ${enabled ? 'ENABLED' : 'DISABLED'}`);
      return true;
    }
    return false;
  }

  /**
   * Quick setup with common thresholds
   */
  quickSetup() {
    console.log('🚀 Setting up common BTC price thresholds...\n');
    
    // Clear existing and set up new
    const config = this.loadConfig();
    if (!config) return false;

    config.alerts.priceThresholds = {
      enabled: true,
      dropThresholds: [
        {
          price: 82000,
          message: "🟡 BTC Alert: Price dropped to £82,000",
          priority: "medium",
          cooldown: 3600000
        },
        {
          price: 81000,
          message: "🟠 BTC Alert: Price dropped to £81,000 - Consider buying opportunity",
          priority: "high",
          cooldown: 3600000
        },
        {
          price: 80000,
          message: "🔴 BTC URGENT: Price dropped to £80,000 - Major buying opportunity!",
          priority: "urgent",
          cooldown: 1800000
        },
        {
          price: 75000,
          message: "🚨 BTC CRASH: Price dropped to £75,000 - CRITICAL LEVEL",
          priority: "urgent",
          cooldown: 900000
        }
      ],
      riseThresholds: [
        {
          price: 85000,
          message: "🟢 BTC Alert: Price rose to £85,000",
          priority: "medium",
          cooldown: 3600000
        },
        {
          price: 90000,
          message: "🚀 BTC Alert: Price rose to £90,000 - Consider selling",
          priority: "high",
          cooldown: 3600000
        },
        {
          price: 95000,
          message: "💰 BTC SURGE: Price rose to £95,000 - Take profits?",
          priority: "urgent",
          cooldown: 1800000
        }
      ],
      percentageAlerts: {
        enabled: true,
        significantDrop: 5,
        significantRise: 5,
        cooldown: 1800000
      }
    };

    if (this.saveConfig(config)) {
      console.log('✅ Quick setup completed! Your alert thresholds:');
      console.log('   📉 Drops: £82K, £81K, £80K, £75K');
      console.log('   📈 Rises: £85K, £90K, £95K');
      console.log('   📊 Percentage: ±5%\n');
      this.showCurrentConfig();
      return true;
    }
    return false;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const manager = new ThresholdManager();
  
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
📱 Telegram Alert Threshold Manager

Usage: node manage-thresholds.js [command] [options]

Commands:
  show                    Show current threshold configuration
  quick-setup            Set up common BTC price thresholds
  add-drop <price>        Add a new drop threshold
  add-rise <price>        Add a new rise threshold  
  remove-drop <price>     Remove a drop threshold
  remove-rise <price>     Remove a rise threshold
  enable                  Enable multi-threshold alerts
  disable                 Disable multi-threshold alerts (use basic alerts)

Examples:
  node manage-thresholds.js show
  node manage-thresholds.js quick-setup
  node manage-thresholds.js add-drop 79000
  node manage-thresholds.js add-rise 100000
  node manage-thresholds.js remove-drop 82000

Options for add commands:
  --message "Custom message"     Custom alert message
  --priority medium|high|urgent  Alert priority level
  --cooldown 60                  Cooldown in minutes (default: 60)

Current thresholds you requested:
  📉 £82,000 - Medium priority alert
  📉 £81,000 - High priority alert  
  📉 £80,000 - Urgent priority alert
`);
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'show':
      manager.showCurrentConfig();
      break;
      
    case 'quick-setup':
      manager.quickSetup();
      break;
      
    case 'add-drop':
      const dropPrice = parseInt(args[1]);
      if (!dropPrice) {
        console.log('❌ Please specify a price: add-drop <price>');
        return;
      }
      const dropMessage = args.find(arg => arg.startsWith('--message'))?.split('=')[1];
      const dropPriority = args.find(arg => arg.startsWith('--priority'))?.split('=')[1] || 'medium';
      const dropCooldown = parseInt(args.find(arg => arg.startsWith('--cooldown'))?.split('=')[1]) || 60;
      manager.addDropThreshold(dropPrice, dropMessage, dropPriority, dropCooldown);
      break;
      
    case 'add-rise':
      const risePrice = parseInt(args[1]);
      if (!risePrice) {
        console.log('❌ Please specify a price: add-rise <price>');
        return;
      }
      const riseMessage = args.find(arg => arg.startsWith('--message'))?.split('=')[1];
      const risePriority = args.find(arg => arg.startsWith('--priority'))?.split('=')[1] || 'medium';
      const riseCooldown = parseInt(args.find(arg => arg.startsWith('--cooldown'))?.split('=')[1]) || 60;
      manager.addRiseThreshold(risePrice, riseMessage, risePriority, riseCooldown);
      break;
      
    case 'remove-drop':
      const removeDropPrice = parseInt(args[1]);
      if (!removeDropPrice) {
        console.log('❌ Please specify a price: remove-drop <price>');
        return;
      }
      manager.removeThreshold('drop', removeDropPrice);
      break;
      
    case 'remove-rise':
      const removeRisePrice = parseInt(args[1]);
      if (!removeRisePrice) {
        console.log('❌ Please specify a price: remove-rise <price>');
        return;
      }
      manager.removeThreshold('rise', removeRisePrice);
      break;
      
    case 'enable':
      manager.toggleThresholds(true);
      break;
      
    case 'disable':
      manager.toggleThresholds(false);
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log('Use --help to see available commands');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = ThresholdManager;