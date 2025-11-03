# Configuration Files

This folder contains all configuration files for the automated trading system.

## 📁 Config Files:

### 🎯 `unified-config.json`
**Main configuration file** - Controls all trading system settings
- **Trading thresholds** (buy/sell prices)
- **Position sizes** (how much to buy/sell)  
- **Withdrawal settings** (auto-withdraw to bank)
- **Profit tracking** (milestones, alerts)
- **Safety limits** (daily limits, cooldowns)

### 📊 `monitor-config.json` 
**Price monitoring settings**
- **Update intervals** (how often to check prices)
- **Price alerts** (threshold changes)
- **Notification settings** (console, sound)

### 💹 `trading-config.json`
**Advanced trading parameters**
- **Fee calculations**
- **API settings**
- **Risk management**

## 🔧 Usage:

All JavaScript files now automatically load configuration from this folder:
- `./config/unified-config.json` - Main settings
- `./config/monitor-config.json` - Monitoring settings  
- `./config/trading-config.json` - Trading parameters

## 🚀 Benefits:

✅ **Organized** - All configs in one place
✅ **Easy to find** - Clear file structure
✅ **Version control** - Easier to track changes
✅ **Backup friendly** - Simple to backup/restore settings