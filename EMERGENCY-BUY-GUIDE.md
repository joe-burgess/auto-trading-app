# Emergency Buy Checker

A standalone tool for manually buying Bitcoin during major price drops and emergency situations.

## 🚨 Purpose

This tool is **completely separate** from the automated trading system and allows you to:
- Analyze significant price drops based on recent history
- Check your available GBP balance for buying
- Specify exact GBP amount to spend on BTC
- Get intelligent drop analysis and recommendations
- Manually execute emergency buys during market crashes

## 🚀 How to Use

### Quick Emergency Check
```bash
npm run emergency-buy-check
```

### Or Direct Command
```bash
node emergency-buy-check.js
```

## 📊 What It Does

1. **📉 Price Drop Analysis**
   - Analyzes recent price history (24 hours)
   - Calculates drop percentage from recent highs
   - Identifies significant drops (5%+) and emergency drops (10%+)
   - Shows timing of recent high prices

2. **💷 GBP Balance Check**
   - Shows available GBP for purchasing
   - Suggests intelligent buy amounts based on drop severity
   - Calculates how much BTC you'd receive

3. **🧠 Buy Recommendation**
   - Runs same logic as automated system
   - Shows reasons for/against buying
   - Considers current market conditions

4. **⏰ Trading Status**
   - Checks if within normal trading hours
   - Allows manual override for emergency situations
   - Highlights when emergency action is recommended

5. **💰 Custom Amount Entry**
   - You specify exact GBP amount to spend
   - Shows BTC amount you'll receive
   - Estimates fees and net purchase

6. **✋ Manual Confirmation**
   - Always requires your explicit confirmation
   - No automatic execution
   - Complete control over emergency decisions

## 🔍 Example Output

```
🚨 Emergency Buy Opportunity Checker

📊 Current Market Status:
   💰 BTC Price: £75,432
   💷 Available GBP: £234.56
   🪙 Current BTC: 0.00059556 BTC
   📈 Current Profit: £-15.23

📉 Price Drop Analysis:
   🚨 Drop: 12.3% from recent high
   📈 Recent High: £86,450 (3h 25m ago)
   💰 Current Price: £75,432
   🎯 Analysis: MAJOR DROP - Strong buy opportunity!

🧠 Buy Analysis:
✅ BUY RECOMMENDED
   • Price below buy threshold (£80,000)
   • Significant price drop detected
   • Good accumulation opportunity

💰 Available Buying Power:
   💷 Maximum Available: £234.56
   🎯 Suggested Amounts:
     • £23 → 0.000305 BTC
     • £58 → 0.000769 BTC
     • £117 → 0.001551 BTC
     • £175 → 0.002321 BTC
     • £234 → 0.003103 BTC

🚨 Trading Status: EMERGENCY DROP DETECTED - Manual override recommended

💷 Enter GBP amount to spend (£10 - £234.56) or 'cancel': 100

📊 Purchase Preview:
   💷 Spend: £100.00
   🪙 Receive: ~0.001326 BTC
   🎯 After Fees (~0.5%): ~0.001319 BTC

❓ Confirm this emergency buy? (yes/no):
```

## 📉 Drop Analysis Features

**Significance Levels:**
- **🚨 Emergency Drop**: 10%+ from recent high
- **📉 Significant Drop**: 5-10% from recent high  
- **📊 Minor Movement**: Less than 5%

**Smart Suggestions:**
- **Normal Conditions**: Conservative amounts (10-25% of balance)
- **Significant Drops**: More aggressive options (up to 75% of balance)
- **Emergency Drops**: Maximum buying power suggestions

## ⚡ When to Use

- **Market Crashes**: When Bitcoin drops significantly
- **News Events**: Negative news causing price drops
- **Weekend Dips**: Emergency buying outside trading hours
- **Dollar Cost Averaging**: Adding to positions during dips
- **Opportunity Recognition**: When you spot a good entry point

## 🛡️ Safety Features

- **Historical Analysis**: Uses real price data to assess drops
- **Balance Verification**: Only suggests what you can afford
- **Fee Calculations**: Shows estimated costs before buying
- **Manual Confirmation**: Always requires explicit approval
- **Flexible Amounts**: You choose exact spend amount
- **Override Capable**: Can buy outside normal trading hours

## 🎯 Perfect For

- Catching major market dips
- Emergency accumulation during crashes
- Weekend buying opportunities
- Reacting to negative news events
- Manual portfolio rebalancing
- Learning about market opportunities

## 💡 Tips

- **Watch for 10%+ drops** - These often present excellent buying opportunities
- **Don't spend everything** - Keep some GBP for further drops
- **Check recent highs** - Understand where the price dropped from
- **Consider timing** - Recent drops may continue falling
- **Use suggested amounts** - Based on drop severity analysis