#!/usr/bin/env node

const UnifiedTrader = require('./unified-trader');
const TelegramNotifier = require('./telegram-notifier');

class PriceAlertMonitor {
  constructor() {
    this.trader = new UnifiedTrader();
    this.telegram = null;
    this.alerts = [];
    this.lastPrice = null;
    this.isRunning = false;
    
    // Load Telegram config if available
    this.loadTelegramConfig();
  }

  loadTelegramConfig() {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, 'config', 'telegram-config.json');
      
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.botToken && config.chatId) {
          this.telegram = new TelegramNotifier(config.botToken, config.chatId);
          console.log('✅ Telegram configuration loaded');
        }
      } else {
        console.log('⚠️ No Telegram config found. Create config/telegram-config.json to enable alerts');
      }
    } catch (error) {
      console.log('⚠️ Could not load Telegram config:', error.message);
    }
  }

  addPriceAlert(threshold, type = 'drop', message = '') {
    const alert = {
      id: Date.now(),
      threshold,
      type, // 'drop' or 'rise'
      message,
      triggered: false,
      created: new Date().toISOString()
    };
    
    this.alerts.push(alert);
    console.log(`📊 Price alert added: ${type} ${type === 'drop' ? 'below' : 'above'} £${threshold.toLocaleString()}`);
    return alert;
  }

  async checkAlerts(currentPrice) {
    if (!this.telegram) return;

    for (const alert of this.alerts) {
      if (alert.triggered) continue;

      let shouldTrigger = false;

      if (alert.type === 'drop' && currentPrice <= alert.threshold) {
        shouldTrigger = true;
      } else if (alert.type === 'rise' && currentPrice >= alert.threshold) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredPrice = currentPrice;

        try {
          await this.telegram.sendPriceAlert(currentPrice, alert.threshold, alert.type);
          console.log(`🚨 Alert triggered: ${alert.type} alert at £${currentPrice.toLocaleString()}`);
        } catch (error) {
          console.error('❌ Failed to send Telegram alert:', error.message);
        }
      }
    }
  }

  async checkPrice() {
    try {
      const priceData = await this.trader.buyer.getCurrentPrice();
      const currentPrice = priceData.price;

      if (this.lastPrice && currentPrice !== this.lastPrice) {
        console.log(`📊 BTC Price: £${currentPrice.toLocaleString()} (${currentPrice > this.lastPrice ? '📈' : '📉'} ${((currentPrice - this.lastPrice) / this.lastPrice * 100).toFixed(2)}%)`);
      }

      await this.checkAlerts(currentPrice);
      this.lastPrice = currentPrice;

    } catch (error) {
      console.error('❌ Error checking price:', error.message);
    }
  }

  start(intervalMinutes = 1) {
    if (this.isRunning) {
      console.log('⚠️ Price monitor is already running');
      return;
    }

    console.log('🚀 Starting price alert monitor...');
    console.log(`📊 Active alerts: ${this.alerts.length}`);
    
    if (this.telegram) {
      console.log('📱 Telegram alerts enabled');
    } else {
      console.log('⚠️ Telegram alerts disabled (no config)');
    }

    this.isRunning = true;

    // Initial price check
    this.checkPrice();

    // Set up regular monitoring
    this.interval = setInterval(() => {
      this.checkPrice();
    }, intervalMinutes * 60 * 1000);

    console.log(`⏰ Monitoring every ${intervalMinutes} minute(s)`);
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Price monitor is not running');
      return;
    }

    clearInterval(this.interval);
    this.isRunning = false;
    console.log('🛑 Price alert monitor stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeAlerts: this.alerts.filter(a => !a.triggered).length,
      triggeredAlerts: this.alerts.filter(a => a.triggered).length,
      lastPrice: this.lastPrice,
      telegramEnabled: !!this.telegram
    };
  }

  listAlerts() {
    console.log('\n📊 Price Alerts:');
    if (this.alerts.length === 0) {
      console.log('   No alerts configured');
      return;
    }

    this.alerts.forEach((alert, index) => {
      const status = alert.triggered ? '✅ TRIGGERED' : '⏳ ACTIVE';
      const type = alert.type === 'drop' ? '📉 Drop below' : '📈 Rise above';
      console.log(`   ${index + 1}. ${status} - ${type} £${alert.threshold.toLocaleString()}`);
      if (alert.triggered) {
        console.log(`      Triggered at £${alert.triggeredPrice.toLocaleString()} on ${new Date(alert.triggeredAt).toLocaleString()}`);
      }
    });
  }
}

// CLI interface
async function main() {
  const monitor = new PriceAlertMonitor();

  if (process.argv.includes('--test-telegram')) {
    if (monitor.telegram) {
      console.log('🧪 Testing Telegram connection...');
      await monitor.telegram.testConnection();
    } else {
      console.log('❌ No Telegram configuration found');
    }
    return;
  }

  // Add the £81,000 drop alert
  monitor.addPriceAlert(81000, 'drop', 'BTC dropped to £81,000 - buying opportunity!');

  // Add some other useful alerts
  monitor.addPriceAlert(85000, 'rise', 'BTC rising - consider profit taking');

  // Start monitoring
  monitor.start(1); // Check every minute

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🔄 Received shutdown signal...');
    monitor.stop();
    process.exit(0);
  });

  // Show status every 5 minutes
  setInterval(() => {
    const status = monitor.getStatus();
    console.log(`\n📈 Status: ${status.activeAlerts} active alerts | Last price: £${status.lastPrice?.toLocaleString() || 'N/A'}`);
  }, 5 * 60 * 1000);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PriceAlertMonitor;