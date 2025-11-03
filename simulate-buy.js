#!/usr/bin/env node

const PaymentTracker = require('./payment-tracker');
const https = require('https');

class SimulateBuy {
  constructor() {
    this.paymentTracker = new PaymentTracker();
  }

  /**
   * Get current BTC price from CoinGecko API
   */
  async getCurrentBTCPrice() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.coingecko.com',
        path: '/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp',
        method: 'GET',
        headers: {
          'User-Agent': 'Auto-Trading-App/1.0'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const price = response.bitcoin?.gbp;
            if (price) {
              resolve(price);
            } else {
              reject(new Error('Failed to get BTC price from API'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Simulate a BTC purchase
   */
  async simulatePurchase(gbpAmount, customPrice = null) {
    try {
      console.log(`💰 Simulating BTC purchase for £${gbpAmount}...\n`);

      // Get current price or use custom price
      let btcPrice;
      if (customPrice) {
        btcPrice = customPrice;
        console.log(`📊 Using custom BTC price: £${btcPrice.toLocaleString()}`);
      } else {
        console.log('🔍 Fetching current BTC price...');
        btcPrice = await this.getCurrentBTCPrice();
        console.log(`📊 Current BTC price: £${btcPrice?.toLocaleString?.() || btcPrice}`);
      }

      // Validate BTC price
      if (!btcPrice || isNaN(btcPrice) || btcPrice <= 0) {
        throw new Error('Invalid BTC price received. Aborting simulated buy.');
      }

      // Calculate BTC amount
      const btcAmount = gbpAmount / btcPrice;

      console.log(`\n📈 Purchase Details:`);
      console.log(`   💷 GBP Amount: £${gbpAmount.toFixed(2)}`);
      console.log(`   ₿ BTC Amount: ${btcAmount.toFixed(8)} BTC`);
      console.log(`   💱 Price per BTC: £${btcPrice.toLocaleString()}`);

      // Record the payment
      const payment = this.paymentTracker.recordPayment(
        gbpAmount,
        btcAmount,
        btcPrice,
        'simulated-buy'
      );

      if (!payment || typeof payment !== 'object' || !payment.id) {
        throw new Error('Payment record is malformed or missing. Aborting.');
      }

      console.log(`\n✅ Payment recorded successfully!`);
      console.log(`   🆔 Payment ID: ${payment.id}`);
      console.log(`   📅 Date: ${payment.date}`);
      console.log(`   📦 Type: ${payment.type}`);

      // Show profit analysis at current price
      const profitAnalysis = this.paymentTracker.calculatePaymentProfits(btcPrice, 10);
      const thisPayment = profitAnalysis.find(p => p.id === payment.id);

      if (
        thisPayment &&
        typeof thisPayment.currentValue === 'number' &&
        typeof thisPayment.profit === 'number' &&
        typeof thisPayment.profitPercent === 'number' &&
        thisPayment.profitAnalysis &&
        typeof thisPayment.profitAnalysis.netProfit === 'number' &&
        typeof thisPayment.profitAnalysis.priceNeeded === 'number'
      ) {
        console.log(`\n💹 Immediate Profit Analysis:`);
        console.log(`   📊 Current Value: £${thisPayment.currentValue.toFixed(2)}`);
        console.log(`   💰 Profit/Loss: ${thisPayment.profit >= 0 ? '+' : ''}£${thisPayment.profit.toFixed(2)} (${thisPayment.profitPercent.toFixed(1)}%)`);
        console.log(`   🎯 Net Profit After Fees: £${thisPayment.profitAnalysis.netProfit.toFixed(2)}`);
        console.log(`   📍 Price Needed for £10 Profit: £${thisPayment.profitAnalysis.priceNeeded.toLocaleString()}`);
      } else {
        console.warn('⚠️ Profit analysis for this payment is malformed or missing. Skipping detailed output.');
      }

      // Show summary
      const summary = this.paymentTracker.getPaymentSummary(btcPrice);
      if (
        summary &&
        typeof summary.totalPayments === 'number' &&
        typeof summary.totalGbpInvested === 'number' &&
        typeof summary.totalBtcPurchased === 'number' &&
        typeof summary.totalCurrentValue === 'number' &&
        typeof summary.totalProfit === 'number' &&
        typeof summary.totalProfitPercent === 'number'
      ) {
        console.log(`\n📊 Portfolio Summary:`);
        console.log(`   🧾 Total Payments: ${summary.totalPayments}`);
        console.log(`   💷 Total Invested: £${summary.totalGbpInvested.toFixed(2)}`);
        console.log(`   ₿ Total BTC: ${summary.totalBtcPurchased.toFixed(8)} BTC`);
        console.log(`   💰 Current Value: £${summary.totalCurrentValue.toFixed(2)}`);
        console.log(`   📈 Total Profit: £${summary.totalProfit.toFixed(2)} (${summary.totalProfitPercent.toFixed(1)}%)`);
      } else {
        console.warn('⚠️ Portfolio summary is malformed or missing. Skipping summary output.');
      }

      console.log(`\n💡 Next Steps:`);
      console.log(`   🌐 View in dashboard: npm run start-trading`);
      console.log(`   📊 Check profit status: npm run trade-analyze`);

    } catch (error) {
      console.error('❌ Error simulating purchase:', error.message);
      // Do not retry or record a payment if price fetch fails
      console.log('❌ Simulated buy failed. No payment was recorded.');
    }
  }

  /**
   * Show help information
   */
  static showHelp() {
    console.log(`
💰 BTC Purchase Simulator

Simulates buying Bitcoin and creates a new payment record for tracking.

Usage: node simulate-buy.js <amount> [price]

Arguments:
  amount    Amount in GBP to spend (required)
  price     Custom BTC price in GBP (optional, defaults to current market price)

Examples:
  node simulate-buy.js 50              # Buy £50 worth at current price
  node simulate-buy.js 100             # Buy £100 worth at current price
  node simulate-buy.js 25 79000        # Buy £25 worth at £79,000 per BTC
  node simulate-buy.js 75 85000        # Buy £75 worth at £85,000 per BTC

Features:
  ✅ Fetches real-time BTC prices
  ✅ Creates trackable payment records
  ✅ Shows immediate profit analysis
  ✅ Updates portfolio summary
  ✅ Works with the dashboard and alerts

Note: This creates actual payment records that will be tracked in your system.
`);
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    SimulateBuy.showHelp();
    return;
  }

  const gbpAmount = parseFloat(args[0]);
  const customPrice = args[1] ? parseFloat(args[1]) : null;

  if (!gbpAmount || gbpAmount <= 0) {
    console.error('❌ Error: Please provide a valid GBP amount');
    console.log('💡 Example: node simulate-buy.js 50');
    console.log('💡 Use --help for more information');
    return;
  }

  if (customPrice && customPrice <= 0) {
    console.error('❌ Error: Please provide a valid BTC price');
    return;
  }

  const simulator = new SimulateBuy();
  await simulator.simulatePurchase(gbpAmount, customPrice);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Failed to simulate purchase:', error.message);
    process.exit(1);
  });
}

module.exports = SimulateBuy;