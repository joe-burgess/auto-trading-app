#!/usr/bin/env node

// Simple test to demonstrate balance change detection
const PaymentTracker = require('./payment-tracker');

console.log('🧪 Testing Payment Tracker Balance Detection\n');

// Create payment tracker instance
const paymentTracker = new PaymentTracker();

// Show current state
console.log('📊 Current payment state:');
const allPayments = paymentTracker.getAllPayments();
const activePayments = paymentTracker.getActivePayments();

console.log(`   Total payments: ${allPayments.length}`);
console.log(`   Active payments: ${activePayments.length}`);

allPayments.forEach(payment => {
  console.log(`   - ${payment.id.substring(0, 20)}... (${payment.status}): ${payment.btcAmount.toFixed(8)} BTC`);
});

// Calculate expected BTC balance from active payments
const expectedBalance = activePayments.reduce((sum, payment) => sum + payment.btcAmount, 0);
console.log(`\n📊 Expected BTC balance from active payments: ${expectedBalance.toFixed(8)} BTC`);

// Test cleanup with the expected balance
console.log('\n🔄 Testing cleanup with current balance...');
paymentTracker.cleanupPaymentsAfterSale(expectedBalance);

// Show final state
console.log('\n📊 Final payment state:');
const finalActivePayments = paymentTracker.getActivePayments();
console.log(`   Active payments: ${finalActivePayments.length}`);
finalActivePayments.forEach(payment => {
  console.log(`   - ${payment.id.substring(0, 20)}... (${payment.status}): ${payment.btcAmount.toFixed(8)} BTC`);
});

console.log('\n✅ Test completed!');