#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

class SimulatedFundsAdder {
  constructor() {
    this.balanceFile = path.join(__dirname, 'data', 'balance-history.json');
  }

  async addSimulatedGBP(amount) {
    try {
      console.log(`💷 Adding £${amount} simulated GBP funds...\n`);
      
      // Read current balance history
      let balanceHistory = [];
      try {
        const data = await fs.readFile(this.balanceFile, 'utf8');
        balanceHistory = JSON.parse(data);
      } catch (error) {
        console.log('📂 Creating new balance history file');
      }
      
      // Get the latest balance record
      const latestBalance = balanceHistory[balanceHistory.length - 1];
      
      if (!latestBalance) {
        console.log('❌ No existing balance records found');
        console.log('💡 Please run "npm run auto-trade" first to initialize');
        return;
      }
      
      // Create new balance record with added GBP
      const newBalance = {
        ...latestBalance,
        timestamp: new Date().toISOString(),
        source: 'simulated_funds_addition',
        gbpBalance: (latestBalance.gbpBalance || 0) + amount,
        totalBalance: latestBalance.btcValueInGbp + (latestBalance.gbpBalance || 0) + amount,
        note: `Added £${amount} simulated GBP funds`
      };
      
      // Recalculate profit/loss
      newBalance.profitLoss = newBalance.totalBalance - 50; // Original £50 investment
      
      // Remove debug logging
      // console.log('🔍 Debug - Latest balance structure:');
      // console.log(JSON.stringify(latestBalance, null, 2));
      
      // Add to history
      balanceHistory.push(newBalance);
      
      // Save updated history
      await fs.writeFile(this.balanceFile, JSON.stringify(balanceHistory, null, 2));
      
      console.log('✅ Simulated funds added successfully!');
      console.log('📊 Updated Balance:');
      console.log(`   💷 GBP: £${newBalance.gbpBalance.toFixed(2)}`);
      console.log(`   🪙 BTC: ${newBalance.btcBalance} BTC (£${newBalance.btcValueInGbp.toFixed(2)})`);
      console.log(`   💰 Total Value: £${newBalance.totalBalance.toFixed(2)}`);
      console.log(`   📈 Profit/Loss: £${newBalance.profitLoss.toFixed(2)}`);
      console.log('\n💡 You can now use:');
      console.log('   • npm run emergency-buy-check');
      console.log('   • npm run manual-sell-check');
      console.log('   • npm run auto-trade');
      
    } catch (error) {
      console.error('❌ Error adding simulated funds:', error.message);
    }
  }
}

// Command line interface
async function main() {
  if (require.main === module) {
    const args = process.argv.slice(2);
    const amount = parseFloat(args[0]);
    
    if (!amount || amount <= 0) {
      console.log('💷 Simulated Funds Adder');
      console.log('');
      console.log('Usage: node add-simulated-funds.js <amount>');
      console.log('');
      console.log('Examples:');
      console.log('  node add-simulated-funds.js 100    # Add £100 GBP');
      console.log('  node add-simulated-funds.js 250    # Add £250 GBP');
      console.log('');
      console.log('⚠️  Note: This only works in simulation mode');
      return;
    }
    
    const adder = new SimulatedFundsAdder();
    await adder.addSimulatedGBP(amount);
  }
}

main().catch(console.error);

module.exports = SimulatedFundsAdder;