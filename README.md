# Auto Trading App - Complete BTC Trading System (GBP)

A comprehensive Bitcoin automated trading system with buy-low-sell-high strategy, profit tracking, and complete fee calculation for British Pounds.

## 🚀 Complete Features

### 🔄 **Price Monitoring**
- Real-time BTC-GBP price tracking from Coinbase Pro
- Smart alerts for price movements and thresholds
- Historical price data and analytics

### 🤖 **Automated Trading System**
- **Buy Low**: Automatically purchase BTC when price drops below £80,000 or falls 3%+
- **Sell High**: Automatically sell BTC when price rises above £90,000 or gains 5%+
- **Profit Tracking**: Alert when you've made £10+ profit (configurable)
- **Safety Controls**: Daily limits, cooldowns, and manual approval options

📱 **Enhanced Telegram Alerts (NEW!)**
- **Multi-threshold system**: Set multiple price levels (e.g., £82K, £81K, £80K)
- **Smart priority levels**: Medium, High, Urgent with different cooldowns
- **Percentage movement alerts**: ±5% significant price changes
- **Trade confirmations**: Get notified of all buy/sell executions
- **Easy management**: Add/remove thresholds with simple commands
- **Anti-spam cooldowns**: Prevent alert fatigue with intelligent timing

⚠️ **Smart Alerts**
- Price threshold alerts (e.g., £400 increase/decrease)
- Percentage change alerts (e.g., 2% up/down)
- Multiple alert severity levels
- Optional sound notifications

🤖 **Automated Trading System**
- **Complete fee calculation** including trading, spread, and withdrawal costs
- **Coinbase Pro integration** for live trading
- **Bank account automation** for GBP deposits
- **Safety controls** with configurable limits
- **Dry run mode** for testing without real trades

� **Comprehensive Fee Calculator**
- **Trading fees**: 0.5% (Coinbase Pro rates)
- **Spread costs**: ~0.25% (market spread estimation)
- **Withdrawal fees**: £0.15 fixed fee to bank account
- **Real-time calculation** of final deposit amount

�📊 **Price Analytics**
- Price change calculations
- Historical price statistics
- Price history tracking with JSON storage
- Trading history and audit trail

## Trading System Quick Start

### 1. Fee Calculation (No API needed)
```bash
npm run trade-calculate        # Calculate fees for 0.01 BTC
node btc-trader.js calculate 0.005  # Calculate for 0.005 BTC
```

### 2. Current Market Data
```bash
npm run trade-price           # Get live BTC-GBP prices
```

### 3. Trading Simulation
```bash
npm run trade-simulate        # Simulate 0.01 BTC trade
node btc-trader.js simulate 0.005   # Simulate 0.005 BTC trade
```

### 4. Account Management (Requires API)
```bash
npm run trade-balance         # Check account balances
npm run trade-stats          # Trading statistics
```

## Fee Breakdown Example

For **0.01 BTC** at **£83,775** per BTC:

```
💷 ====== FEE BREAKDOWN ======
🪙 BTC Amount: 0.01 BTC
📈 BTC Price: £83,775.00
💵 Gross Value: £837.75

📊 FEES:
   Trading Fee (0.5%): £4.19
   Spread Cost (~0.25%): £2.09
   Withdrawal Fee: £0.15
   Total Fees: £6.43

💰 FINAL AMOUNTS:
   Net After Trading: £831.41
   Final Bank Deposit: £831.26
   Effective Rate: £83,126 per BTC
   Total Fee %: 0.77%
================================
```

**Summary**: You'd receive **£831.26** in your bank account after all fees.

## API Setup (For Live Trading)

### 1. Get Coinbase Pro API Credentials
1. Go to [Coinbase Pro API Settings](https://pro.coinbase.com/profile/api)
2. Create new API key with permissions:
   - ✅ View
   - ✅ Trade
   - ✅ Transfer (for withdrawals)

### 2. Configure Environment
```bash
cp .env.template .env
# Edit .env with your API credentials
```

### 3. Test with Sandbox
- Start with `sandbox: true` in config
- Test all functions before live trading
- Gradually increase trade amounts

## Safety Features

🛡️ **Built-in Safety Controls**:
- **Dry run mode**: All operations simulated by default
- **Sandbox environment**: Test with fake money first
- **Trade limits**: Maximum 0.01 BTC per trade (configurable)
- **Minimum values**: £50 minimum trade value
- **Confirmation prompts**: Manual approval for live trades
- **Comprehensive logging**: Full audit trail of all operations

⚠️ **Important Safety Notes**:
- System runs in **DRY RUN mode** by default
- Never commit API credentials to version control
- Start with small amounts in sandbox environment
- Always verify calculations before live trading

## Quick Start

### 1. Setup Telegram Alerts (5 minutes) 📱
```bash
# Get your chat ID (after messaging your bot)
npm run get-chat-id

# Quick setup with common thresholds
npm run setup-thresholds

# Test your setup
npm run test-telegram-alerts
```
**📖 Full Setup Guide**: See [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md) for complete instructions

### 2. Start Auto-Trading 🤖
```bash
npm run auto-trade
```
Includes automated buy/sell, profit tracking, and Telegram alerts!

### 3. Manual Trading Tools 🛠️
```bash
npm run emergency-buy-check    # Manual buy opportunities
npm run manual-sell-check      # Manual sell opportunities  
npm run show-balance          # Check current balance
```

### 4. Threshold Management 🎯
```bash
npm run show-thresholds       # View current alerts
npm run manage-thresholds     # Advanced management
```

### 5. Basic Price Monitoring 📊
```bash
npm run btc-price            # One-time price check
npm run btc-monitor          # Continuous monitoring
```

### 4. View Price History
```bash
npm run btc-history      # Last 10 records
node btc-monitor.js history 20 # Last 20 records
```

## Configuration

Edit `monitor-config.json` to customize:

```json
{
  "monitoring": {
    "interval": 30000    // Check every 30 seconds
  },
  "priceAlerts": {
    "enabled": true,
    "upThreshold": 400,     // Alert on £400+ increase
    "downThreshold": 400,   // Alert on £400+ decrease
    "percentageUp": 2,      // Alert on 2%+ increase
    "percentageDown": 2     // Alert on 2%+ decrease
  },
  "notifications": {
    "console": true,
    "sound": false          // Enable terminal beep alerts
  }
}
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run btc-price` | Get current BTC price once |
| `npm run btc-monitor` | Start continuous monitoring |
| `npm run btc-stats` | Show 60-minute price statistics |
| `npm run btc-history` | Show last 10 price records |
| `node btc-monitor.js stats 120` | Custom timeframe stats |
| `node btc-monitor.js history 50` | Custom history count |

## Example Output

### Price Monitoring
```
🚀 Starting BTC Price Monitor...
⏱️ Monitoring interval: 30 seconds
📊 Price alerts: Enabled
   - Price threshold: ±$500
   - Percentage threshold: ±2%
────────────────────────────────

[3:45:23 PM] 💰 BTC: £55,420.50
    🟢 ↗️ £125.30 (0.18%)
[3:45:53 PM] 💰 BTC: £55,890.75
    🟢 ↗️ £470.25 (0.68%)
```

### Price Alerts
```
🔔 ========================
⚠️  PRICE ALERTS
========================
🚨 BTC price increased by £520.25 to £55,890
📈 BTC price up 2.1% to £55,890
========================
```

### Price Statistics
```
📊 BTC Price Stats (60 minutes):
   High: £55,890
   Low:  £55,200
   Change: £425.50 (0.62%)
   Data points: 120
```

## 📋 Complete Command Reference

### 🤖 Auto-Trading
```bash
npm run auto-trade              # Start full automated trading system
npm run trade-analyze           # Analyze current trading opportunity
npm run trade-status            # View comprehensive trading status
```

### 📱 Telegram Alerts
```bash
npm run setup-thresholds        # Quick setup with common thresholds
npm run show-thresholds         # View current threshold configuration
npm run manage-thresholds       # Advanced threshold management
npm run test-telegram-alerts    # Test enhanced alert system
npm run get-chat-id            # Get your Telegram chat ID
npm run test-telegram          # Basic Telegram connection test
```

### 🛠️ Manual Trading Tools
```bash
npm run emergency-buy-check     # Manual buy opportunity checker
npm run manual-sell-check       # Manual sell opportunity checker
npm run show-balance           # Display current balance
npm run reset-balance          # Reset balance to £50 GBP + £200 BTC
npm run reset-balance-confirm   # Reset without confirmation
```

### 📊 Monitoring & Analytics
```bash
npm run btc-price              # One-time price check
npm run btc-monitor            # Continuous price monitoring
npm run btc-stats              # Price statistics and history
npm run profit-report          # Comprehensive profit analysis
```

### ⚙️ System Management  
```bash
npm run init-balances          # Initialize balance tracking
npm run add-simulated-funds    # Add simulated GBP funds
npm run reset-profit           # Reset profit tracking
```

### 🎯 Threshold Management Examples
```bash
# Add custom drop thresholds
node manage-thresholds.js add-drop 79000
node manage-thresholds.js add-drop 77000 --priority urgent --cooldown 15

# Add custom rise thresholds
node manage-thresholds.js add-rise 100000 --message "🚀 BTC hit £100K!"

# Remove thresholds
node manage-thresholds.js remove-drop 82000
node manage-thresholds.js remove-rise 95000

# Show help
node manage-thresholds.js --help
```

## Data Storage

- Price history is automatically saved to `btc-price-history.json`
- Configurable maximum history items (default: 1000)
- Data persists between monitoring sessions

## Error Handling

- Automatic retry on API failures
- Graceful shutdown on Ctrl+C
- Error logging with timestamps
- Fallback mechanisms for API endpoints

## API Information

Uses Coinbase Pro public API:
- Endpoint: `https://api.exchange.coinbase.com/products/BTC-GBP/ticker`
- No authentication required
- Rate limits: Generous for monitoring use
- Real-time market data in GBP

## Stopping the Monitor

Press `Ctrl+C` to gracefully stop monitoring. The system will:
- Save current price history
- Display shutdown message
- Clean up resources