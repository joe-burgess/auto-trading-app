#!/usr/bin/env node

const express = require('express');
const path = require('path');
const fs = require('fs');

// Import the UnifiedTrader to get trading analysis
const UnifiedTrader = require('./unified-trader');

const app = express();
const port = 3001;

// Serve static files from public directory
app.use(express.static('public'));

// Parse JSON bodies
app.use(express.json());

// Create a trader instance for getting analysis
let trader = null;

async function initializeTrader() {
  try {
    // Create trader instance with disabled telegram for dashboard
    trader = new UnifiedTrader();
    
    // Disable telegram notifications for dashboard instance to avoid conflicts
    trader.telegramNotifier = null;
    trader.telegramConfig = null;
    
    console.log('📊 Trader initialized for web dashboard (Telegram disabled)');
  } catch (error) {
    console.error('⚠️ Error initializing trader for dashboard:', error.message);
  }
}

// API endpoint to get current trading analysis
app.get('/api/trading-analysis', async (req, res) => {
  try {
    if (!trader) {
      return res.status(503).json({ 
        error: 'Trading system not initialized',
        message: 'Please start the auto-trading system first'
      });
    }

    // Get trading analysis
    const analysis = await trader.analyzeTradingOpportunity();
    
    // Get configuration
    const config = trader.config;
    
    // Extract data from analysis
    const btcBalance = analysis.balances?.BTC?.balance || 0;
    const gbpBalance = analysis.balances?.GBP?.balance || 0;
  const currentPrice = analysis.price;
  const currentAsk = analysis.priceData?.ask || null;
    
    // Validate current price
    if (typeof currentPrice !== 'number' || isNaN(currentPrice)) {
      console.error('❌ Invalid price data in analysis:', currentPrice);
      return res.status(500).json({
        error: 'Invalid price data',
        message: 'Unable to get valid BTC price data'
      });
    }
    
    const btcValue = btcBalance * currentPrice;
    
    // Calculate profit metrics
    const currentProfit = analysis.currentProfit || 0;
    const profitTarget = config.selling.profitTarget;
    const neededProfit = Math.max(0, profitTarget - currentProfit);
    const neededProfitPercent = profitTarget > 0 ? (neededProfit / profitTarget) * 100 : 0;
    
    // Calculate price needed for profit target
    const targetValue = btcValue + neededProfit;
    const priceNeeded = btcBalance > 0 ? targetValue / btcBalance : 0;
    const priceNeededPercent = currentPrice > 0 ? ((priceNeeded - currentPrice) / currentPrice) * 100 : 0;
    
    // Estimate selling fees (0.83% on Coinbase)
    const sellingFees = btcValue * 0.0083;
    const sellingFeesPercent = 0.83;
    const sellingResult = currentProfit - sellingFees;
    
    // Get payment tracking data
    const paymentSummary = trader.paymentTracker.getPaymentSummary(currentPrice);
    const individualPayments = trader.paymentTracker.getPaymentStatuses(currentPrice);
    
    // Format response data matching the dashboard expectations
    const responseData = {
      currentPrice: currentPrice,
      currentAsk: currentAsk,
      tradingStatus: 'Active Trading',
      btcAmount: btcBalance,
      btcValue: btcValue,
      appreciation: 0, // Could be calculated from initial investment
      gbpCash: gbpBalance,
      valueChange: currentProfit,
      currentProfit: currentProfit,
      neededProfit: neededProfit,
      neededProfitPercent: neededProfitPercent,
      priceNeeded: priceNeeded,
      priceNeededPercent: priceNeededPercent,
      saleNeeded: btcValue + sellingFees + profitTarget,
      sellingFees: sellingFees,
      sellingFeesPercent: sellingFeesPercent,
      sellingResult: sellingResult,
      shouldBuy: analysis.decisions.shouldBuy,
      shouldSell: analysis.decisions.shouldSell,
      nextEvaluation: 'Check auto-trader logs',
      config: {
        buyThreshold: config.buying.priceThreshold,
        sellThreshold: config.selling.priceThreshold,
        profitTarget: config.selling.profitTarget,
        maxBuy: config.buying.maxBuyAmount,
        maxSell: config.selling.maxSellAmount
      },
      paymentTracking: {
        summary: paymentSummary,
        individualPayments: individualPayments
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(responseData);
    
  } catch (error) {
    console.error('⚠️ Error getting trading analysis:', error.message);
    res.status(500).json({ 
      error: 'Failed to get trading analysis',
      message: error.message 
    });
  }
});

// API endpoint to sell an individual payment
app.post('/api/sell-payment', async (req, res) => {
  try {
    if (!trader) {
      return res.status(503).json({ 
        error: 'Trading system not initialized',
        message: 'Please start the auto-trading system first'
      });
    }

    const { paymentId } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({ 
        error: 'Payment ID required',
        message: 'Please provide a paymentId in the request body'
      });
    }

    // Get current BTC price for the sale
    const analysis = await trader.analyzeTradingOpportunity();
    const currentPrice = analysis.price;

    if (!currentPrice || currentPrice <= 0) {
      return res.status(500).json({ 
        error: 'Unable to get current BTC price',
        message: 'Cannot process sale without current market price'
      });
    }

    // Process the individual payment sale
    const saleResult = trader.paymentTracker.sellIndividualPayment(paymentId, currentPrice);
    
    // Return sale details
    res.json({
      success: true,
      message: 'Payment sold successfully',
      sale: saleResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('⚠️ Error selling payment:', error.message);
    res.status(400).json({ 
      error: 'Failed to sell payment',
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    traderInitialized: trader !== null
  });
});

// Serve the dashboard as the default page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Initialize and start server
async function startServer() {
  await initializeTrader();
  
  // Get local network IP for display
  let networkIp = 'localhost';
  try {
    const { execSync } = require('child_process');
    const localIp = execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
    if (localIp && localIp !== '127.0.0.1') {
      networkIp = localIp;
    }
  } catch (error) {
    // Fallback to localhost if we can't get network IP
  }
  
  app.listen(port, '0.0.0.0', () => {
    console.log(`🌐 BTC Trading Dashboard running at:`);
    console.log(`   📱 Network: http://${networkIp}:${port} (access from phone/other devices)`);
    console.log(`   💻 Local: http://localhost:${port}`);
    console.log('📊 Visit the dashboard to view current trading analysis');
    console.log('🔄 Data refreshes automatically every 30 seconds');
    console.log('⚠️ Make sure the auto-trading system is running for live data');
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down web dashboard...');
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start dashboard server:', error.message);
  process.exit(1);
});

module.exports = app;