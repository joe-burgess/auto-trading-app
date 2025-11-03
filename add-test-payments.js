#!/usr/bin/env node

// Test script to add sample payments for testing the payment tracking system
const PaymentTracker = require('./payment-tracker');

const tracker = new PaymentTracker();

// Add some sample payments for testing
console.log('🧪 Adding sample payments for testing...');

// Sample payment 1: Recent purchase
tracker.recordPayment(50, 0.000617, 81000, 'test-payment');

// Sample payment 2: Older purchase at lower price
tracker.recordPayment(25, 0.000315, 79500, 'test-payment');

// Sample payment 3: Even older purchase
tracker.recordPayment(30, 0.000384, 78000, 'test-payment');

console.log('✅ Sample payments added successfully!');
console.log('🌐 Start the dashboard to see payment tracking in action');
console.log('💡 Run: npm run dashboard');

// Show current summary
const summary = tracker.getPaymentSummary(81000);
console.log('\n📊 Payment Summary:');
console.log(`   Total Payments: ${summary.totalPayments}`);
console.log(`   Total Invested: £${summary.totalGbpInvested.toFixed(2)}`);
console.log(`   Average Buy Price: £${summary.averageBuyPrice.toLocaleString()}`);
console.log(`   Total Profit: £${summary.totalProfit.toFixed(2)} (${summary.totalProfitPercent.toFixed(1)}%)`);
console.log(`   Profitable Payments: ${summary.profitablePayments} / ${summary.totalPayments}`);