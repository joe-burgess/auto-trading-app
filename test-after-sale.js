#!/usr/bin/env node

// Test balance detection after UI sale
const UnifiedTrader = require('./unified-trader');

async function testAfterSale() {
  console.log('🧪 Testing balance detection after UI sale...\n');
  
  try {
    const trader = new UnifiedTrader();
    
    // Check current payments
    console.log('📊 Current payment status:');
    const payments = trader.paymentTracker.getAllPayments();
    const activePayments = payments.filter(p => p.status === 'active');
    const soldPayments = payments.filter(p => p.status === 'sold');
    
    console.log(`   Total payments: ${payments.length}`);
    console.log(`   Active payments: ${activePayments.length}`);
    console.log(`   Sold payments: ${soldPayments.length}`);
    
    activePayments.forEach(payment => {
      console.log(`   - Active: ${payment.id}: ${payment.btcAmount.toFixed(8)} BTC`);
    });
    
    soldPayments.forEach(payment => {
      console.log(`   - Sold: ${payment.id}: ${payment.btcAmount.toFixed(8)} BTC`);
    });
    
    // Run analysis to trigger balance detection
    console.log('\n🔍 Running analysis to check balance detection...');
    const analysis = await trader.analyzeTradingOpportunity();
    
    if (analysis) {
      console.log(`\n📊 Analysis results:`);
      console.log(`   Current BTC Balance: ${analysis.balances.BTC?.available.toFixed(8) || '0.00000000'} BTC`);
      console.log(`   Tracked Balance: ${trader.lastKnownBtcBalance.toFixed(8)} BTC`);
    }
    
    // Check payments after analysis
    console.log('\n📊 Payment status after analysis:');
    const finalActivePayments = trader.paymentTracker.getActivePayments();
    console.log(`   Active payments: ${finalActivePayments.length}`);
    finalActivePayments.forEach(payment => {
      console.log(`   - ${payment.id}: ${payment.btcAmount.toFixed(8)} BTC (Status: ${payment.status})`);
    });
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAfterSale();