# 📱 Telegram Multi-Threshold Price Alerts Setup Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Your Telegram Bot
1. Open Telegram and message `@BotFather`
2. Type `/newbot`
3. Choose a name: `Your Trading Bot`
4. Choose a username: `your_trading_bot` (must end in 'bot')
5. **Copy the bot token** (looks like: `123456789:ABCdefGHI...`)

### Step 2: Get Your Chat ID
**Option A: Use our helper tool** (Recommended)
1. **Message your bot once** (any message like "hello")
2. Run: `npm run get-chat-id`
3. Your chat ID will be displayed automatically!

**Option B: Manual method**
1. **Message your bot once** (any message like "hello")
2. Visit this URL in your browser:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. **Replace `<YOUR_BOT_TOKEN>`** with your actual token
4. Find your `chat_id` in the response (it's a number)

### Step 3: Configure the System
1. Edit `config/telegram-config.json`
2. Replace `YOUR_BOT_TOKEN_HERE` with your bot token
3. Replace `YOUR_CHAT_ID_HERE` with your chat ID

Example:
```json
{
  "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
  "chatId": "987654321"
}
```

## 🎯 Multi-Threshold Alert System (NEW!)

Your system now supports **multiple price thresholds** instead of just single alerts. This means you can get different alerts as BTC crosses different price levels!

### Default Configuration
After setup, you'll have these thresholds configured:

**📉 Drop Alerts:**
- £82,000 - Medium priority (1hr cooldown)
- £81,000 - High priority (1hr cooldown)  
- £80,000 - Urgent priority (30min cooldown)

**📈 Rise Alerts:**
- £85,000 - Medium priority (1hr cooldown)
- £90,000 - High priority (1hr cooldown)
- £95,000 - Urgent priority (30min cooldown)

**📊 Percentage Alerts:**
- ±5% movements (30min cooldown)

## 🛠️ Easy Threshold Management

### Quick Commands
```bash
# View current thresholds
npm run show-thresholds

# Set up default thresholds
npm run setup-thresholds

# Manage individual thresholds
npm run manage-thresholds
```

### Add Your Own Thresholds
```bash
# Add drop alerts
node manage-thresholds.js add-drop 79000
node manage-thresholds.js add-drop 77000 --priority urgent --cooldown 15

# Add rise alerts  
node manage-thresholds.js add-rise 100000
node manage-thresholds.js add-rise 88000 --message "💰 Consider profits at £88K"

# Remove thresholds
node manage-thresholds.js remove-drop 82000
node manage-thresholds.js remove-rise 95000
```

### Custom Options
- **--message**: Custom alert text
- **--priority**: `medium`, `high`, or `urgent`
- **--cooldown**: Minutes between repeat alerts

### Examples
```bash
# Urgent £78K alert with 15min cooldown
node manage-thresholds.js add-drop 78000 \
  --message="🚨 MAJOR DIP: £78K opportunity!" \
  --priority=urgent \
  --cooldown=15

# Profit-taking alert
node manage-thresholds.js add-rise 88000 \
  --message="💰 Consider taking profits" \
  --priority=high
```

## 🧪 Test Your Setup

```bash
# Test basic connection
npm run test-telegram

# Test enhanced multi-threshold system
npm run test-telegram-alerts
```

You should receive test messages on Telegram confirming your setup!

## 🚨 Start Auto-Trading with Alerts

```bash
npm run auto-trade
```

This will:
- ✅ Monitor BTC price with smart 15-45 minute intervals
- ✅ Send multi-threshold alerts as configured
- ✅ Execute automated buy/sell orders (simulation mode)
- ✅ Track profit and send milestone alerts
- ✅ Human-like behavior to avoid detection

## 📊 Available Commands

```bash
# Trading
npm run auto-trade              # Start full auto-trading system
npm run emergency-buy-check     # Manual buy opportunities  
npm run manual-sell-check       # Manual sell opportunities

# Alerts & Monitoring
npm run test-telegram-alerts    # Test enhanced alert system
npm run price-alerts           # Basic price monitoring
npm run show-thresholds        # View current thresholds
npm run setup-thresholds       # Quick threshold setup
npm run manage-thresholds      # Advanced threshold management

# Configuration
npm run get-chat-id            # Get your Telegram chat ID
npm run test-telegram          # Basic connection test
```

## 🎯 Sample Alert Messages

### Threshold Alerts
When BTC crosses your configured thresholds:

```
� BTC Alert: Price dropped to £81,000 - Consider buying opportunity

� Current: £80,950
🎯 Threshold: £81,000  
⏰ 03/11/2025, 14:30:00
🔄 High Priority Alert

💡 This is your £81K buying signal!
```

### Percentage Movement Alerts
```
📉 BTC dropped 5.2% to £79,840

📊 From: £84,200 → £79,840
📉 Change: -5.2% (-£4,360)
⏰ 03/11/2025, 14:30:00

⚡ Significant movement detected!
```

### Trade Confirmation Alerts
```
✅ BTC Purchase Executed

💷 Spent: £50.00
🪙 Received: 0.000625 BTC  
💰 Price: £80,000
📊 Total BTC: 0.002625 BTC
💼 Portfolio: £200 GBP + £210 BTC

🤖 Automated buy executed
```

## 🛑 Stop Monitoring

Press `Ctrl+C` in the terminal to stop the auto-trader or price monitor.

## 🔧 Advanced Configuration

### Cooldown System
Each threshold has its own cooldown to prevent spam:
- **Medium Priority**: 60 minutes
- **High Priority**: 60 minutes  
- **Urgent Priority**: 30 minutes
- **Percentage Alerts**: 30 minutes

### Priority Levels
- **Medium** 🟡: Regular price movements
- **High** 🟠: Important levels that may trigger action
- **Urgent** 🔴: Critical levels requiring immediate attention

### Configuration File
Your thresholds are stored in `config/telegram-config.json`:

```json
{
  "alerts": {
    "priceThresholds": {
      "enabled": true,
      "dropThresholds": [
        {
          "price": 81000,
          "message": "🟠 BTC Alert: Price dropped to £81,000",
          "priority": "high",
          "cooldown": 3600000
        }
      ],
      "riseThresholds": [...],
      "percentageAlerts": {
        "enabled": true,
        "significantDrop": 5,
        "significantRise": 5
      }
    }
  }
}
```

## 🎯 Your Custom Setup

Current active thresholds as configured:
- **📉 £82,000** - Medium priority buying signal
- **📉 £81,000** - High priority buying opportunity  
- **📉 £80,000** - Urgent buying opportunity
- **📈 £85,000** - Medium priority selling signal
- **📈 £90,000** - High priority selling opportunity
- **📈 £95,000** - Urgent profit-taking signal

## 🚀 Pro Tips

1. **Start with defaults**: Use `npm run setup-thresholds` for common levels
2. **Customize gradually**: Add specific thresholds as you learn the market
3. **Use priority levels**: Urgent alerts = immediate action needed
4. **Monitor cooldowns**: Prevent alert fatigue with appropriate cooldowns
5. **Test first**: Always use `npm run test-telegram-alerts` after changes

Ready to catch every important BTC price movement! 📈📉💰

## 📞 Troubleshooting

**No alerts received?**
- Check `npm run test-telegram-alerts`
- Verify bot token and chat ID in config
- Ensure thresholds are enabled with `npm run show-thresholds`

**Too many alerts?**
- Increase cooldown times
- Use higher priority levels only
- Disable percentage alerts if needed

**Want different thresholds?**
- Use `npm run manage-thresholds --help` for all options
- Easily add/remove with simple commands
- Customize messages for each threshold