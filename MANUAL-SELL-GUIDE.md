# Manual Sell Checker

A standalone tool for manually checking sell opportunities when you spot a price spike.

## 🎯 Purpose

This tool is **completely separate** from the automated trading system and allows you to:
- Check if current conditions favor selling
- Get detailed analysis of the market situation
- Manually confirm trades before execution
- Override trading hours when needed

## 🚀 How to Use

### Quick Check
```bash
npm run manual-sell-check
```

### Or Direct Command
```bash
node manual-sell-check.js
```

## 📊 What It Does

1. **📈 Market Analysis**
   - Fetches current BTC price
   - Shows your holdings and balances
   - Calculates current profit/loss

2. **🧠 Sell Decision Logic**
   - Runs same analysis as automated system
   - Checks price thresholds and profit targets
   - Lists specific reasons for recommendation

3. **⏰ Trading Status Check**
   - Shows if within normal trading hours
   - Detects emergency conditions (>15% price spikes)
   - Allows manual override of time restrictions

4. **💰 Trade Preview**
   - Shows exact amount that would be sold
   - Estimates value and fees
   - Previews withdrawal options

5. **✋ Manual Confirmation**
   - Always asks for your confirmation
   - No automatic execution
   - You stay in complete control

## 🔍 Example Output

```
🔍 Manual Sell Opportunity Checker

📊 Current Market Status:
   💰 BTC Price: £95,432
   🪙 BTC Holdings: 0.00059556 BTC
   💷 GBP Balance: £0.00
   📈 Current Profit: £15.23

🧠 Sell Analysis:
✅ SELL RECOMMENDED
   • Price above sell threshold (£90,000)
   • Profit target reached (£10)
   • Good market conditions

💡 Proposed Trade:
   📤 Sell Amount: 0.002456 BTC
   💰 Estimated Value: £234.56
   🎯 After Fees (~0.5%): £233.39

🟢 Trading Status: ALLOWED (within trading hours)

❓ Do you want to execute this sell? (yes/no):
```

## ⚡ When to Use

- **Price Spike Alert**: When you notice Bitcoin price jumping
- **Profit Check**: Want to see if conditions favor selling
- **Emergency Situations**: During weekends or outside trading hours
- **Manual Override**: When you want to sell regardless of automation
- **Peace of Mind**: Double-check before major trades

## 🛡️ Safety Features

- **No Auto-Execution**: Always requires manual confirmation
- **Complete Analysis**: Shows all relevant market data
- **Fee Calculation**: Estimates costs before execution
- **Status Awareness**: Shows trading hours and emergency conditions
- **Separate from Auto-System**: Won't interfere with automated trading

## 🎯 Perfect For

- Reacting to news events
- Weekend price spikes
- Manual profit-taking
- Emergency situations
- Learning about market conditions