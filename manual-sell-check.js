#!/usr/bin/env node

const UnifiedTrader = require('./unified-trader');
const readline = require('readline');

class ManualSellChecker {
  constructor() {
    this.trader = new UnifiedTrader();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async checkSellOpportunity() {
    console.log('🔍 Manual Sell Opportunity Checker\n');
    
    try {
      // Get current market data
      const priceData = await this.trader.buyer.getCurrentPrice();
      const balances = await this.trader.buyer.displayBalance(); // Show balance once with proper display
      const currentProfit = await this.trader.profitTracker.getCurrentProfit();
      
      console.log('📊 Current Market Status:');
      console.log(`   💰 BTC Price: £${priceData.price.toLocaleString()}`);
      console.log(`   🪙 BTC Holdings: ${balances.BTC?.available || 0} BTC`);
      console.log(`   💷 GBP Balance: £${(balances.GBP?.available || 0).toFixed(2)}`);
      console.log(`   📈 Current Profit: £${currentProfit.toFixed(2)}\n`);
      
      // Check if we have BTC to sell
      if (!balances.BTC?.available || balances.BTC.available < 0.001) {
        console.log('❌ No BTC available to sell (minimum 0.001 BTC required)');
        return this.close();
      }
      
      // Run sell condition analysis
      const sellReasons = this.trader.checkSellConditions(priceData, balances, currentProfit);
      
      console.log('🧠 Sell Analysis:');
      if (sellReasons.length > 0) {
        console.log('✅ SELL RECOMMENDED');
        sellReasons.forEach(reason => {
          console.log(`   • ${reason}`);
        });
        
        // Calculate sell amount
        const sellAmount = this.trader.getRandomizedSellAmount(balances.BTC.available);
        const sellValue = sellAmount * priceData.price;
        
        console.log('\n💡 Proposed Trade:');
        console.log(`   📤 Sell Amount: ${sellAmount} BTC`);
        console.log(`   💰 Estimated Value: £${sellValue.toFixed(2)}`);
        console.log(`   🎯 After Fees (~0.5%): £${(sellValue * 0.995).toFixed(2)}`);
        
        // Check trading hours and emergency status
        const tradingAllowed = this.trader.timingController.isTradingAllowed(priceData, 'sell');
        const isEmergency = this.isEmergencyCondition(priceData);
        
        if (tradingAllowed) {
          console.log('\n🟢 Trading Status: ALLOWED (within trading hours)');
        } else if (isEmergency) {
          console.log('\n🚨 Trading Status: EMERGENCY OVERRIDE ACTIVE');
        } else {
          console.log('\n🟡 Trading Status: Outside trading hours (can still execute manually)');
        }
        
        return this.promptForConfirmation(sellAmount);
        
      } else {
        console.log('❌ SELL NOT RECOMMENDED');
        console.log('   Current conditions do not favor selling');
        console.log(`   • Price: £${priceData.price.toLocaleString()} (sell threshold: £${this.trader.config.selling.priceThreshold.toLocaleString()})`);
        console.log(`   • Profit: £${currentProfit.toFixed(2)} (target: £${this.trader.config.profitTracking.profitThreshold})`);
        return this.close();
      }
      
    } catch (error) {
      console.error('❌ Error checking sell opportunity:', error.message);
      return this.close();
    }
  }

  isEmergencyCondition(priceData) {
    if (!this.trader.timingController.lastRecordedPrice) return false;
    
    const priceChange = (priceData.price - this.trader.timingController.lastRecordedPrice) / this.trader.timingController.lastRecordedPrice;
    const threshold = this.trader.timingController.config.emergencyOverride.priceJumpThreshold;
    
    return priceChange >= threshold;
  }

  async promptForConfirmation(sellAmount) {
    return new Promise((resolve) => {
      this.rl.question('\n❓ Do you want to execute this sell? (yes/no): ', async (answer) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
          await this.executeSell(sellAmount);
        } else {
          console.log('✋ Sell cancelled by user');
        }
        resolve(this.close());
      });
    });
  }

  async executeSell(sellAmount) {
    try {
      console.log('\n🚀 Executing sell order...');
      
      const withdrawalOptions = {
        autoWithdraw: this.trader.config.selling.autoWithdrawToBank,
        withdrawToBank: this.trader.config.selling.autoWithdrawToBank,
        minWithdrawalAmount: this.trader.config.selling.minWithdrawalAmount,
        withdrawalDelay: this.trader.config.selling.withdrawalDelay,
        keepMinimumGbpBalance: this.trader.config.selling.keepMinimumGbpBalance
      };
      
      const result = await this.trader.seller.executeBTCtoGBP(sellAmount, withdrawalOptions);
      
      if (result.success) {
        console.log('✅ Sell order executed successfully!');
        console.log(`   📤 Sold: ${sellAmount} BTC`);
        console.log(`   💰 Value: £${result.totalValue?.toFixed(2) || 'N/A'}`);
        console.log(`   🏦 ${result.withdrawal ? 'Bank withdrawal initiated' : 'Funds in GBP balance'}`);
      } else {
        console.log('❌ Sell order failed:', result.error || 'Unknown error');
      }
      
    } catch (error) {
      console.log('❌ Error executing sell:', error.message);
    }
  }

  close() {
    this.rl.close();
    console.log('\n👋 Manual sell checker closed');
  }
}

// Run the manual sell checker
async function main() {
  if (require.main === module) {
    const checker = new ManualSellChecker();
    await checker.checkSellOpportunity();
  }
}

main().catch(console.error);

module.exports = ManualSellChecker;