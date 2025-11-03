#!/usr/bin/env node

const UnifiedTrader = require('./unified-trader');
const readline = require('readline');

class EmergencyBuyChecker {
  constructor() {
    this.trader = new UnifiedTrader();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async checkBuyOpportunity() {
    console.log('🚨 Emergency Buy Opportunity Checker\n');
    
    try {
      // Get current market data
      const priceData = await this.trader.buyer.getCurrentPrice();
      const balances = await this.trader.buyer.displayBalance(); // Show balance once with proper display
      this.currentProfit = await this.trader.profitTracker.getCurrentProfit(); // Store for later use
      
      console.log('📊 Current Market Status:');
      console.log(`   💰 BTC Price: £${priceData.price.toLocaleString()}`);
      console.log(`   💷 Available GBP: £${(balances.GBP?.available || 0).toFixed(2)}`);
      console.log(`   🪙 Current BTC: ${balances.BTC?.available || 0} BTC`);
      console.log(`   📈 Current Profit: £${this.currentProfit.toFixed(2)}\n`);
      
      // Check if we have GBP to buy with
      if (!balances.GBP?.available || balances.GBP.available < 10) {
        console.log('❌ Insufficient GBP balance (minimum £10 required)');
        return this.close();
      }
      
      // Check for negative profit and warn user
      if (this.currentProfit < 0) {
        console.log('⚠️  NEGATIVE PROFIT WARNING');
        console.log(`   📉 Current Loss: £${Math.abs(this.currentProfit).toFixed(2)}`);
        console.log('   💡 Buying more while in loss can increase risk');
        console.log('   🎯 Consider waiting for recovery or price improvement\n');
        
        const shouldContinue = await this.promptNegativeProfitWarning(this.currentProfit);
        if (!shouldContinue) {
          console.log('✋ Emergency buy cancelled - smart decision to wait for better conditions');
          return this.close();
        }
        console.log('⚠️  Proceeding with caution - double-check your decision below\n');
      }
      
      // Analyze price drop situation
      const dropAnalysis = await this.analyzePriceDrop(priceData);
      this.displayDropAnalysis(dropAnalysis);
      
      // Run buy condition analysis
      const buyConditions = await this.trader.buyer.checkBuyingConditions(priceData);
      
      console.log('🧠 Buy Analysis:');
      if (buyConditions.shouldBuy) {
        console.log('✅ BUY RECOMMENDED');
        buyConditions.reasons.forEach(reason => {
          console.log(`   • ${reason}`);
        });
      } else {
        console.log('🟡 BUY NOT AUTOMATICALLY RECOMMENDED');
        console.log('   Normal conditions do not favor buying');
        console.log('   However, this is an emergency buy tool - you can override');
      }
      
      // Show available amounts
      const maxGbp = balances.GBP.available;
      const suggestedAmounts = this.getSuggestedBuyAmounts(maxGbp, dropAnalysis.isSignificantDrop);
      
      console.log('\n💰 Available Buying Power:');
      console.log(`   💷 Maximum Available: £${maxGbp.toFixed(2)}`);
      console.log('   🎯 Suggested Amounts:');
      suggestedAmounts.forEach(amount => {
        const btcAmount = (amount / priceData.price).toFixed(6);
        console.log(`     • £${amount} → ${btcAmount} BTC`);
      });
      
      // Check trading status
      const tradingAllowed = this.trader.timingController.isTradingAllowed(priceData, 'buy');
      const isEmergency = dropAnalysis.isEmergencyDrop;
      
      if (tradingAllowed) {
        console.log('\n🟢 Trading Status: ALLOWED (within trading hours)');
      } else if (isEmergency) {
        console.log('\n🚨 Trading Status: EMERGENCY DROP DETECTED - Manual override recommended');
      } else {
        console.log('\n🟡 Trading Status: Outside trading hours (manual override available)');
      }
      
      return this.promptForBuyAmount(maxGbp, priceData.price);
      
    } catch (error) {
      console.error('❌ Error checking buy opportunity:', error.message);
      return this.close();
    }
  }

  async promptNegativeProfitWarning(currentProfit) {
    return new Promise((resolve) => {
      console.log('⚠️  RISK ASSESSMENT REQUIRED');
      console.log('   📊 You are currently in negative profit');
      console.log('   💰 Buying more will:');
      console.log('     • Increase your total exposure to Bitcoin');
      console.log('     • Potentially increase losses if price continues falling');
      console.log('     • Lower your average buy price (dollar cost averaging)');
      console.log('     • Could be profitable if this is truly the bottom');
      console.log('');
      console.log('   🤔 Consider these alternatives:');
      console.log('     • Wait for current position to recover');
      console.log('     • Look for stronger price drop signals (>10-15%)');
      console.log('     • Ensure this is truly emergency buying, not FOMO');
      console.log('');
      
      this.rl.question('❓ Are you sure you want to buy more while in loss? (yes/no): ', (answer) => {
        const confirmed = answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y';
        resolve(confirmed);
      });
    });
  }

  async analyzePriceDrop(currentPriceData) {
    try {
      // Get recent price history to analyze the drop
      const recentPrices = await this.getRecentPriceHistory();
      
      if (recentPrices.length === 0) {
        return {
          isSignificantDrop: false,
          isEmergencyDrop: false,
          dropPercentage: 0,
          timeframe: 'Unknown',
          highPrice: currentPriceData.price,
          analysis: 'No historical data available'
        };
      }
      
      // Find the highest price in recent history
      const highPrice = Math.max(...recentPrices.map(p => p.price));
      const currentPrice = currentPriceData.price;
      
      // Calculate drop percentage
      const dropPercentage = ((highPrice - currentPrice) / highPrice) * 100;
      
      // Determine significance
      const isSignificantDrop = dropPercentage >= 5; // 5% or more
      const isEmergencyDrop = dropPercentage >= 10; // 10% or more
      
      // Find when the high occurred
      const highPriceEntry = recentPrices.find(p => p.price === highPrice);
      const timeframe = highPriceEntry ? this.getTimeframeSince(highPriceEntry.timestamp) : 'Unknown';
      
      let analysis = '';
      if (isEmergencyDrop) {
        analysis = 'MAJOR DROP - Strong buy opportunity!';
      } else if (isSignificantDrop) {
        analysis = 'Notable drop - Good buying opportunity';
      } else {
        analysis = 'Minor price movement';
      }
      
      return {
        isSignificantDrop,
        isEmergencyDrop,
        dropPercentage,
        timeframe,
        highPrice,
        currentPrice,
        analysis
      };
      
    } catch (error) {
      console.log('⚠️ Could not analyze price history:', error.message);
      return {
        isSignificantDrop: false,
        isEmergencyDrop: false,
        dropPercentage: 0,
        timeframe: 'Unknown',
        highPrice: currentPriceData.price,
        analysis: 'Analysis unavailable'
      };
    }
  }

  async getRecentPriceHistory() {
    // Try to get recent price data from the trading history
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      // Check if we have recent price history files
      const historyFile = path.join(__dirname, 'data', 'btc-price-history.json');
      
      try {
        const data = await fs.readFile(historyFile, 'utf8');
        const history = JSON.parse(data);
        
        // Get prices from last 24 hours
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        return history.filter(entry => entry.timestamp > oneDayAgo);
      } catch {
        // If no history file, return empty array
        return [];
      }
    } catch {
      return [];
    }
  }

  getTimeframeSince(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    } else {
      return `${minutes}m ago`;
    }
  }

  displayDropAnalysis(analysis) {
    console.log('📉 Price Drop Analysis:');
    
    if (analysis.dropPercentage > 0) {
      const emoji = analysis.isEmergencyDrop ? '🚨' : analysis.isSignificantDrop ? '📉' : '📊';
      console.log(`   ${emoji} Drop: ${analysis.dropPercentage.toFixed(1)}% from recent high`);
      console.log(`   📈 Recent High: £${analysis.highPrice.toLocaleString()} (${analysis.timeframe})`);
      console.log(`   💰 Current Price: £${analysis.currentPrice.toLocaleString()}`);
      console.log(`   🎯 Analysis: ${analysis.analysis}`);
    } else {
      console.log(`   📊 ${analysis.analysis}`);
    }
    console.log('');
  }

  getSuggestedBuyAmounts(maxGbp, isSignificantDrop) {
    const amounts = [];
    
    // Conservative amounts
    amounts.push(Math.min(20, maxGbp * 0.1)); // 10% or £20
    amounts.push(Math.min(50, maxGbp * 0.25)); // 25% or £50
    
    if (isSignificantDrop) {
      // More aggressive amounts for significant drops
      amounts.push(Math.min(100, maxGbp * 0.5)); // 50% or £100
      amounts.push(Math.min(200, maxGbp * 0.75)); // 75% or £200
    }
    
    // Always include max available (but cap suggestion at £500)
    const maxSuggestion = Math.min(500, maxGbp);
    if (!amounts.includes(maxSuggestion)) {
      amounts.push(maxSuggestion);
    }
    
    return amounts.filter(amount => amount >= 10).sort((a, b) => a - b);
  }

  async promptForBuyAmount(maxGbp, currentPrice) {
    return new Promise((resolve) => {
      this.rl.question(`\n💷 Enter GBP amount to spend (£10 - £${maxGbp.toFixed(2)}) or 'cancel': `, async (answer) => {
        if (answer.toLowerCase() === 'cancel' || answer.toLowerCase() === 'c') {
          console.log('✋ Buy cancelled by user');
          return resolve(this.close());
        }
        
        const amount = parseFloat(answer);
        
        if (isNaN(amount) || amount < 10 || amount > maxGbp) {
          console.log(`❌ Invalid amount. Please enter between £10 and £${maxGbp.toFixed(2)}`);
          return resolve(this.promptForBuyAmount(maxGbp, currentPrice));
        }
        
        const btcAmount = (amount / currentPrice).toFixed(6);
        console.log(`\n📊 Purchase Preview:`);
        console.log(`   💷 Spend: £${amount.toFixed(2)}`);
        console.log(`   🪙 Receive: ~${btcAmount} BTC`);
        console.log(`   🎯 After Fees (~0.5%): ~${(btcAmount * 0.995).toFixed(6)} BTC`);
        
        return resolve(this.promptForFinalConfirmation(amount));
      });
    });
  }

  async promptForFinalConfirmation(amount) {
    return new Promise((resolve) => {
      // Show additional warning if in negative profit
      if (this.currentProfit < 0) {
        console.log('\n🚨 FINAL WARNING - NEGATIVE PROFIT PURCHASE');
        console.log(`   📉 You are buying while £${Math.abs(this.currentProfit).toFixed(2)} in loss`);
        console.log('   ⚠️  This increases your risk exposure');
        console.log('   💡 Only proceed if you believe this is the bottom');
      }
      
      this.rl.question('\n❓ Confirm this emergency buy? (yes/no): ', async (answer) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
          await this.executeBuy(amount);
        } else {
          console.log('✋ Buy cancelled by user');
        }
        resolve(this.close());
      });
    });
  }

  async executeBuy(amount) {
    try {
      console.log('\n🚀 Executing emergency buy order...');
      
      const purchase = await this.trader.buyer.executeBTCPurchase(
        amount,
        'emergency manual buy: price drop opportunity',
        true  // Emergency flag to bypass limits
      );
      
      // If we get here, the purchase was successful (would have thrown on error)
      if (purchase && purchase.status === 'completed') {
        console.log('✅ Emergency buy completed successfully!');
        console.log(`   💷 Spent: £${purchase.gbpAmount.toFixed(2)}`);
        console.log(`   🪙 Received: ${purchase.feeCalculation?.actualBtcReceived?.toFixed(8) || 'N/A'} BTC`);
        console.log(`   💰 At Price: £${purchase.priceData?.price?.toLocaleString() || 'N/A'}`);
        
        // Show updated balances
        console.log('\n📊 Updated Balances:');
        try {
          const updatedBalances = await this.trader.buyer.getAccountBalances();
          const btcValue = (updatedBalances.BTC.available * purchase.priceData.price).toFixed(2);
          const totalValue = updatedBalances.GBP.available + (updatedBalances.BTC.available * purchase.priceData.price);
          
          console.log(`   💷 GBP: £${updatedBalances.GBP.available.toFixed(2)}`);
          console.log(`   🪙 BTC: ${updatedBalances.BTC.available.toFixed(8)} BTC (£${btcValue})`);
          console.log(`   💰 Total Value: £${totalValue.toFixed(2)}`);
        } catch (error) {
          console.log('   ⚠️ Could not retrieve updated balances');
        }
      } else {
        console.log('⚠️ Purchase completed but status unclear');
      }
      
    } catch (error) {
      console.log('❌ Error executing buy:', error.message);
    }
  }

  close() {
    this.rl.close();
    console.log('\n👋 Emergency buy checker closed');
  }
}

// Run the emergency buy checker
async function main() {
  if (require.main === module) {
    const checker = new EmergencyBuyChecker();
    await checker.checkBuyOpportunity();
  }
}

main().catch(console.error);

module.exports = EmergencyBuyChecker;