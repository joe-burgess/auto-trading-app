# 📱 Multi-Threshold Telegram Alerts - Quick Reference

## 🚀 Quick Setup (5 minutes)
```bash
# 1. Get your Telegram chat ID (after messaging your bot)
npm run get-chat-id

# 2. Setup default thresholds (£82K, £81K, £80K drops + £85K, £90K, £95K rises)
npm run setup-thresholds

# 3. Test the system
npm run test-telegram-alerts
```

## 📊 Current Threshold Commands
```bash
# View what's configured
npm run show-thresholds

# Full management interface
npm run manage-thresholds

# Start auto-trading with alerts
npm run auto-trade
```

## 🎯 Add Your Own Thresholds

### Drop Alerts (Buying Opportunities)
```bash
# Basic drop threshold
node manage-thresholds.js add-drop 79000

# Urgent alert with custom message and short cooldown
node manage-thresholds.js add-drop 78000 \
  --message="🚨 MAJOR DIP: £78K opportunity!" \
  --priority=urgent \
  --cooldown=15
```

### Rise Alerts (Selling Opportunities)  
```bash
# Basic rise threshold
node manage-thresholds.js add-rise 88000

# Profit-taking alert
node manage-thresholds.js add-rise 100000 \
  --message="💰 BTC hit £100K - Consider profits!" \
  --priority=high \
  --cooldown=30
```

### Remove Thresholds
```bash
node manage-thresholds.js remove-drop 82000
node manage-thresholds.js remove-rise 95000
```

## ⚙️ Options
- **--message**: Custom alert text
- **--priority**: `medium`, `high`, or `urgent`  
- **--cooldown**: Minutes between repeat alerts

## 🎯 Priority Levels
- **Medium** 🟡: 60min cooldown - Regular monitoring
- **High** 🟠: 60min cooldown - Important levels
- **Urgent** 🔴: 30min cooldown - Critical action needed

## 📱 Sample Alert Messages

**Drop Alert:**
```
🟠 BTC Alert: Price dropped to £81,000 - Consider buying opportunity

📊 Current: £80,950
🎯 Threshold: £81,000
⏰ 03/11/2025, 14:30:00
🔄 High Priority Alert
```

**Rise Alert:**
```
💰 BTC SURGE: Price rose to £95,000 - Take profits?

📊 Current: £95,120
🎯 Threshold: £95,000
⏰ 03/11/2025, 16:45:00
🚨 Urgent Priority Alert
```

**Percentage Movement:**
```
📉 BTC dropped 5.2% to £79,840

📊 From: £84,200 → £79,840
📉 Change: -5.2% (-£4,360)
⚡ Significant movement detected!
```

## 🔧 Configuration File
Your thresholds are stored in `config/telegram-config.json`

## 📖 Full Documentation
- **Setup Guide**: [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)
- **Main README**: [README.md](README.md)
- **Trading Guide**: [TRADING-GUIDE.md](TRADING-GUIDE.md)

## 🚀 Pro Tips
1. Start with `npm run setup-thresholds` for common levels
2. Use urgent priority sparingly for truly critical levels
3. Test changes with `npm run test-telegram-alerts`
4. Monitor cooldowns to prevent alert fatigue
5. Customize messages to match your trading strategy

**Ready to catch every important BTC movement! 📈📉💰**