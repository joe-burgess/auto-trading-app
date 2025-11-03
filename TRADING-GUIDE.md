# 🤖 Auto Trading System - Complete Setup Guide

## Overview

Your Auto Trading App now includes a complete **BTC to GBP automated trading system** with comprehensive fee calculation and bank account integration.

## 📊 What It Does

### Fee Calculation Example (0.01 BTC at £83,775)
```
Gross Value:        £837.75
Trading Fee (0.5%): £4.19
Spread Cost:        £2.09
Withdrawal Fee:     £0.15
Total Fees:         £6.43
Final Bank Deposit: £831.26
Fee Percentage:     0.77%
```

### Complete Process
1. **Sells BTC** on Coinbase Pro at market price
2. **Converts to GBP** with automatic fee calculation  
3. **Withdraws to bank** account with £0.15 fee
4. **Logs everything** for audit trail

## 🚀 Quick Commands

### Price & Market Data
```bash
npm run trade-price          # Current BTC-GBP market data
npm run btc-price           # Simple price check
npm run btc-monitor         # Live price monitoring
```

### Fee Calculation (No API Required)
```bash
npm run trade-calculate      # Calculate fees for 0.01 BTC
node btc-trader.js calculate 0.005  # Custom amount
```

### Trading Simulation (Safe Testing)
```bash
npm run trade-simulate       # Simulate complete trade
node btc-trader.js simulate 0.02    # Custom amount
```

### Account Management (Requires API)
```bash
npm run trade-balance        # Check balances
npm run trade-stats         # Trading history
```

## 🛡️ Safety Features

- **DRY RUN MODE**: All trades simulated by default
- **SANDBOX TESTING**: Test with fake money first
- **TRADE LIMITS**: Max 0.01 BTC per trade (configurable)
- **MINIMUM VALUES**: £50 minimum trade size
- **CONFIRMATION**: Manual approval required for live trades
- **AUDIT LOGGING**: Complete trade history saved

## 💰 Fee Structure

| Fee Type | Rate | Example (0.01 BTC) |
|----------|------|-------------------|
| Trading Fee | 0.5% | £4.19 |
| Spread Cost | ~0.25% | £2.09 |
| Withdrawal | £0.15 fixed | £0.15 |
| **Total** | **~0.77%** | **£6.43** |

## 🔧 Configuration Files

- `trading-config.json` - Trading parameters and limits
- `.env.template` - API credentials template
- `monitor-config.json` - Price monitoring settings

## 📱 API Setup (For Live Trading)

### 1. Get Coinbase Pro API Key
- Visit: https://pro.coinbase.com/profile/api
- Create API key with View, Trade, Transfer permissions
- Save credentials securely

### 2. Configure Environment
```bash
cp .env.template .env
# Edit .env with your API credentials
```

### 3. Enable Live Trading
Edit `trading-config.json`:
```json
{
  "trading": {
    "dryRun": false,     // Enable live trading
    "sandbox": false,    // Use production API
    "maxTradeAmount": 0.01
  }
}
```

## ⚠️ Important Safety Notes

1. **Always start in DRY RUN mode** to test functionality
2. **Use SANDBOX environment** before live trading
3. **Never commit API credentials** to version control
4. **Start with small amounts** (0.001-0.01 BTC)
5. **Verify fee calculations** before executing trades
6. **Monitor trades closely** especially initial ones

## 📈 Example Usage Workflow

### Step 1: Test Fee Calculation
```bash
npm run trade-calculate
# Review fee breakdown
```

### Step 2: Check Market Conditions
```bash
npm run trade-price
# Check current BTC-GBP rates
```

### Step 3: Simulate Trade
```bash
npm run trade-simulate
# Full simulation without real money
```

### Step 4: Configure API (If Ready)
```bash
# Set up .env file with API credentials
# Test in sandbox mode first
```

### Step 5: Execute Live Trade (Advanced)
```javascript
const trader = new CoinbaseTrader({
  dryRun: false,
  sandbox: false
});

// Execute 0.005 BTC trade with bank withdrawal
await trader.autoTradeToBankAccount(0.005);
```

## 🔗 Related Files

- `btc-trader.js` - Main trading system
- `btc-monitor.js` - Price monitoring
- `btc-price.js` - Simple price checking
- `trading-log.json` - Trade history (auto-created)
- `README.md` - Complete documentation

## 📞 Support

The system includes comprehensive error handling and logging. Check:
- Console output for real-time status
- `trading-log.json` for trade history
- Error messages for troubleshooting

**Remember**: This handles real money - always test thoroughly before live trading! 🚨