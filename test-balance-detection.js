#!/usr/bin/env node

// Test script to verify balance change detection
const UnifiedTrader = require('./unified-trader');

async function testBalanceDetection() {
  console.log('🧪 Testing balance change detection...\n');
  
  try {
    // Create trader instance
    const trader = new UnifiedTrader();
    
    console.log('📊 Current payment status:');
    const payments = trader.paymentTracker.getActivePayments();
    console.log(`   Active payments: ${payments.length}`);
    payments.forEach(payment => {
      console.log(`   - ${payment.id}: ${payment.btcAmount.toFixed(8)} BTC (£${payment.gbpAmount})`);
    });
    
    // Run first analysis to establish baseline
    console.log('\n🔍 Running first analysis to establish BTC balance baseline...');
    const analysis1 = await trader.analyzeTradingOpportunity();
    
    if (analysis1) {
      console.log(`   BTC Balance: ${analysis1.balances.BTC?.available.toFixed(8) || '0.00000000'} BTC`);
      console.log(`   Tracked Balance: ${trader.lastKnownBtcBalance.toFixed(8)} BTC`);
    }
    
    console.log('\n⏳ Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run second analysis - should detect if balance changed due to UI sales
    console.log('\n🔍 Running second analysis to check for balance changes...');
    const analysis2 = await trader.analyzeTradingOpportunity();
    
    if (analysis2) {
      console.log(`   BTC Balance: ${analysis2.balances.BTC?.available.toFixed(8) || '0.00000000'} BTC`);
      console.log(`   Tracked Balance: ${trader.lastKnownBtcBalance.toFixed(8)} BTC`);
    }
    
    console.log('\n📊 Final payment status:');
    const finalPayments = trader.paymentTracker.getActivePayments();
    console.log(`   Active payments: ${finalPayments.length}`);
    finalPayments.forEach(payment => {
      console.log(`   - ${payment.id}: ${payment.btcAmount.toFixed(8)} BTC (£${payment.gbpAmount}) - Status: ${payment.status}`);
    });
    
    console.log('\n✅ Balance detection test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testBalanceDetection();