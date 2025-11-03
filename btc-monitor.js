// BTC Price Monitor with Alerts
const https = require('https');
const fs = require('fs');
const path = require('path');

class BTCPriceMonitor {
  constructor(config = {}) {
    this.config = {
      interval: config.interval || 30000, // 30 seconds default
      priceAlerts: {
        enabled: config.priceAlerts?.enabled || true,
        upThreshold: config.priceAlerts?.upThreshold || 500, // £500 increase
        downThreshold: config.priceAlerts?.downThreshold || 500, // £500 decrease
        percentageUp: config.priceAlerts?.percentageUp || 5, // 5% increase
        percentageDown: config.priceAlerts?.percentageDown || 5, // 5% decrease
      },
      logging: {
        enabled: config.logging?.enabled || true,
        logFile: config.logging?.logFile || 'data/btc-price-history.json',
        maxHistoryItems: config.logging?.maxHistoryItems || 1000
      },
      notifications: {
        console: config.notifications?.console !== false, // enabled by default
        sound: config.notifications?.sound || false
      }
    };
    
    this.priceHistory = [];
    this.lastPrice = null;
    this.monitoring = false;
    this.intervalId = null;
    
    // Load existing price history if available
    this.loadPriceHistory();
  }

  /**
   * Fetch current BTC price from Coinbase Pro API
   */
  async fetchBTCPrice() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.exchange.coinbase.com',
        port: 443,
        path: '/products/BTC-GBP/ticker',
        method: 'GET',
        headers: {
          'User-Agent': 'auto-trading-app-monitor/1.0.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.price) {
              const priceData = {
                price: parseFloat(response.price),
                bid: parseFloat(response.bid),
                ask: parseFloat(response.ask),
                volume: parseFloat(response.volume),
                timestamp: new Date().toISOString(),
                source: 'Coinbase Pro API'
              };
              resolve(priceData);
            } else {
              reject(new Error('Invalid response format from Coinbase Pro API'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Load price history from file
   */
  loadPriceHistory() {
    try {
      if (fs.existsSync(this.config.logging.logFile)) {
        const data = fs.readFileSync(this.config.logging.logFile, 'utf8');
        this.priceHistory = JSON.parse(data);
        if (this.priceHistory.length > 0) {
          this.lastPrice = this.priceHistory[this.priceHistory.length - 1];
        }
        console.log(`📂 Loaded ${this.priceHistory.length} price records from history`);
      }
    } catch (error) {
      console.log('⚠️ Could not load price history:', error.message);
      this.priceHistory = [];
    }
  }

  /**
   * Save price history to file
   */
  savePriceHistory() {
    if (!this.config.logging.enabled) return;

    try {
      // Keep only the most recent items
      if (this.priceHistory.length > this.config.logging.maxHistoryItems) {
        this.priceHistory = this.priceHistory.slice(-this.config.logging.maxHistoryItems);
      }
      
      fs.writeFileSync(this.config.logging.logFile, JSON.stringify(this.priceHistory, null, 2));
    } catch (error) {
      console.error('❌ Failed to save price history:', error.message);
    }
  }

  /**
   * Calculate price change statistics
   */
  calculatePriceChange(currentPrice) {
    if (!this.lastPrice) return null;

    const priceDiff = currentPrice - this.lastPrice.price;
    const percentageChange = ((priceDiff / this.lastPrice.price) * 100);
    const timeDiff = new Date() - new Date(this.lastPrice.timestamp);

    return {
      priceDiff,
      percentageChange,
      timeDiff,
      direction: priceDiff > 0 ? 'up' : priceDiff < 0 ? 'down' : 'stable'
    };
  }

  /**
   * Check if price change triggers an alert
   */
  checkAlerts(priceData, priceChange) {
    if (!this.config.priceAlerts.enabled || !priceChange) return [];

    const alerts = [];
    const { priceDiff, percentageChange } = priceChange;

    // Price threshold alerts
    if (Math.abs(priceDiff) >= this.config.priceAlerts.upThreshold && priceDiff > 0) {
      alerts.push({
        type: 'PRICE_INCREASE',
        message: `🚨 BTC price increased by £${priceDiff.toFixed(2)} to £${priceData.price.toLocaleString('en-GB')}`,
        severity: 'high'
      });
    }

    if (Math.abs(priceDiff) >= this.config.priceAlerts.downThreshold && priceDiff < 0) {
      alerts.push({
        type: 'PRICE_DECREASE',
        message: `🚨 BTC price decreased by £${Math.abs(priceDiff).toFixed(2)} to £${priceData.price.toLocaleString('en-GB')}`,
        severity: 'high'
      });
    }

    // Percentage change alerts
    if (percentageChange >= this.config.priceAlerts.percentageUp) {
      alerts.push({
        type: 'PERCENTAGE_INCREASE',
        message: `📈 BTC price up ${percentageChange.toFixed(2)}% to £${priceData.price.toLocaleString('en-GB')}`,
        severity: 'medium'
      });
    }

    if (percentageChange <= -this.config.priceAlerts.percentageDown) {
      alerts.push({
        type: 'PERCENTAGE_DECREASE',
        message: `📉 BTC price down ${Math.abs(percentageChange).toFixed(2)}% to £${priceData.price.toLocaleString('en-GB')}`,
        severity: 'medium'
      });
    }

    return alerts;
  }

  /**
   * Display alert notifications
   */
  displayAlerts(alerts) {
    if (alerts.length === 0) return;

    console.log('\n🔔 ========================');
    console.log('⚠️  PRICE ALERTS');
    console.log('========================');
    
    alerts.forEach(alert => {
      const emoji = alert.severity === 'high' ? '🚨' : '⚠️';
      console.log(`${emoji} ${alert.message}`);
      
      if (this.config.notifications.sound) {
        // Beep sound (works on most terminals)
        process.stdout.write('\u0007');
      }
    });
    
    console.log('========================\n');
  }

  /**
   * Display current price with monitoring info
   */
  displayPriceUpdate(priceData, priceChange) {
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`[${timestamp}] 💰 BTC: £${priceData.price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
    if (priceChange) {
      const { priceDiff, percentageChange, direction } = priceChange;
      const arrow = direction === 'up' ? '↗️' : direction === 'down' ? '↘️' : '➡️';
      const color = direction === 'up' ? '🟢' : direction === 'down' ? '🔴' : '🟡';
      
      console.log(`    ${color} ${arrow} £${Math.abs(priceDiff).toFixed(2)} (${percentageChange.toFixed(2)}%)`);
    }
  }

  /**
   * Process a price update
   */
  async processPriceUpdate() {
    try {
      const priceData = await this.fetchBTCPrice();
      const priceChange = this.calculatePriceChange(priceData.price);
      
      // Add to history
      this.priceHistory.push(priceData);
      
      // Display price update
      if (this.config.notifications.console) {
        this.displayPriceUpdate(priceData, priceChange);
      }
      
      // Check for alerts
      const alerts = this.checkAlerts(priceData, priceChange);
      if (alerts.length > 0) {
        this.displayAlerts(alerts);
      }
      
      // Update last price
      this.lastPrice = priceData;
      
      // Save history
      this.savePriceHistory();
      
    } catch (error) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Error fetching price:`, error.message);
    }
  }

  /**
   * Start price monitoring
   */
  startMonitoring() {
    if (this.monitoring) {
      console.log('⚠️ Monitoring is already running');
      return;
    }

    console.log('🚀 Starting BTC Price Monitor...');
    console.log(`⏱️ Monitoring interval: ${this.config.interval / 1000} seconds`);
    console.log(`📊 Price alerts: ${this.config.priceAlerts.enabled ? 'Enabled' : 'Disabled'}`);
    
    if (this.config.priceAlerts.enabled) {
      console.log(`   - Price threshold: ±£${this.config.priceAlerts.upThreshold}`);
      console.log(`   - Percentage threshold: ±${this.config.priceAlerts.percentageUp}%`);
    }
    
    console.log('────────────────────────────────\n');

    this.monitoring = true;
    
    // Initial price fetch
    this.processPriceUpdate();
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.processPriceUpdate();
    }, this.config.interval);
  }

  /**
   * Stop price monitoring
   */
  stopMonitoring() {
    if (!this.monitoring) {
      console.log('⚠️ Monitoring is not running');
      return;
    }

    console.log('\n🛑 Stopping BTC Price Monitor...');
    this.monitoring = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Save final history
    this.savePriceHistory();
    console.log('✅ Monitor stopped and history saved');
  }

  /**
   * Get price statistics from history
   */
  getPriceStats(minutes = 60) {
    if (this.priceHistory.length < 2) return null;

    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    const recentPrices = this.priceHistory.filter(item => 
      new Date(item.timestamp) >= cutoffTime
    );

    if (recentPrices.length < 2) return null;

    const prices = recentPrices.map(item => item.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const change = last - first;
    const changePercent = (change / first) * 100;

    return {
      timeframe: `${minutes} minutes`,
      min,
      max,
      first,
      last,
      change,
      changePercent,
      dataPoints: prices.length
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'monitor';

  // Default configuration
  let config = {
    interval: 30000, // 30 seconds
    priceAlerts: {
      enabled: true,
      upThreshold: 500,   // Alert on $500 increase
      downThreshold: 500, // Alert on $500 decrease
      percentageUp: 2,    // Alert on 2% increase
      percentageDown: 2,  // Alert on 2% decrease
    },
    notifications: {
      console: true,
      sound: false
    }
  };

  // Try to load from config file
  try {
    const fs = require('fs');
    const configData = fs.readFileSync('./config/monitor-config.json', 'utf8');
    config = { ...config, ...JSON.parse(configData) };
  } catch (error) {
    console.log('⚠️ Using default config (config/monitor-config.json not found)');
  }

  const monitor = new BTCPriceMonitor(config);

  switch (command) {
    case 'monitor':
    case 'start':
      monitor.startMonitoring();
      
      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🔄 Received shutdown signal...');
        monitor.stopMonitoring();
        process.exit(0);
      });
      break;

    case 'stats':
      const minutes = parseInt(args[1]) || 60;
      const stats = monitor.getPriceStats(minutes);
      if (stats) {
        console.log(`\n📊 BTC Price Stats (${stats.timeframe}):`);
        console.log(`   High: £${stats.max.toLocaleString('en-GB')}`);
        console.log(`   Low:  £${stats.min.toLocaleString('en-GB')}`);
        console.log(`   Change: $${stats.change.toFixed(2)} (${stats.changePercent.toFixed(2)}%)`);
        console.log(`   Data points: ${stats.dataPoints}\n`);
      } else {
        console.log('⚠️ Not enough price data for statistics');
      }
      break;

    case 'history':
      const count = parseInt(args[1]) || 10;
      const recent = monitor.priceHistory.slice(-count);
      console.log(`\n📈 Last ${recent.length} price records:`);
      recent.forEach(item => {
        const time = new Date(item.timestamp).toLocaleString();
        console.log(`   ${time}: £${item.price.toLocaleString('en-GB')}`);
      });
      console.log();
      break;

    default:
      console.log(`
🚀 BTC Price Monitor Commands:

  monitor, start    Start price monitoring (default)
  stats [minutes]   Show price statistics (default: 60 minutes)
  history [count]   Show recent price history (default: 10 items)

Examples:
  node btc-monitor.js monitor
  node btc-monitor.js stats 30
  node btc-monitor.js history 20
      `);
  }
}

module.exports = BTCPriceMonitor;