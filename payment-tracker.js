#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class PaymentTracker {
  constructor() {
    this.dataPath = path.join(__dirname, 'data', 'payment-history.json');
    this.payments = [];
    this.loadPayments();
  }

  /**
   * Load existing payment data from file
   */
  loadPayments() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf8');
        this.payments = JSON.parse(data);
        console.log(`📦 Loaded ${this.payments.length} payment records`);
      } else {
        this.payments = [];
        console.log('📦 No payment history found - starting fresh');
      }
    } catch (error) {
      console.error('⚠️ Error loading payment history:', error.message);
      this.payments = [];
    }
  }

  /**
   * Save payment data to file
   */
  savePayments() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dataPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(this.dataPath, JSON.stringify(this.payments, null, 2));
      console.log(`💾 Saved ${this.payments.length} payment records`);
    } catch (error) {
      console.error('⚠️ Error saving payment history:', error.message);
    }
  }

  /**
   * Record a new BTC purchase payment
   * @param {number} gbpAmount - Amount spent in GBP
   * @param {number} btcAmount - Amount of BTC purchased
   * @param {number} btcPrice - BTC price at time of purchase
   * @param {string} type - Type of purchase (e.g., 'auto-buy', 'manual', 'simulation')
   */
  recordPayment(gbpAmount, btcAmount, btcPrice, type = 'auto-buy') {
    const payment = {
      id: this.generatePaymentId(),
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('en-GB'),
      gbpAmount: gbpAmount,
      btcAmount: btcAmount,
      btcPrice: btcPrice,
      type: type,
      status: 'active' // active, partial, consumed
    };

    this.payments.push(payment);
    this.savePayments();
    
    console.log(`💰 Recorded new payment: £${gbpAmount} for ${btcAmount.toFixed(8)} BTC at £${btcPrice.toLocaleString()}`);
    return payment;
  }

  /**
   * Calculate profit/loss for each payment based on current BTC price
   * @param {number} currentBtcPrice - Current BTC price
   * @param {number} profitTarget - Target profit amount (default: 10)
   * @returns {Array} Array of payments with profit calculations
   */
  calculatePaymentProfits(currentBtcPrice, profitTarget = 10) {
    return this.payments
      .filter(payment => payment.status === 'active')
      .map(payment => {
        const currentValue = payment.btcAmount * currentBtcPrice;
        const profit = currentValue - payment.gbpAmount;
        const profitPercent = (profit / payment.gbpAmount) * 100;
        const priceChange = currentBtcPrice - payment.btcPrice;
        const priceChangePercent = (priceChange / payment.btcPrice) * 100;

        // Detailed profit analysis (similar to trader analysis)
        const neededProfit = Math.max(0, profitTarget - profit);
        const neededProfitPercent = profitTarget > 0 ? (neededProfit / profitTarget) * 100 : 0;
        
        // Calculate price needed for profit target
        const targetValue = payment.gbpAmount + profitTarget;
        const priceNeeded = targetValue / payment.btcAmount;
        const priceNeededPercent = currentBtcPrice > 0 ? ((priceNeeded - currentBtcPrice) / currentBtcPrice) * 100 : 0;
        
        // Estimate selling fees (0.83% on Coinbase)
        const sellingFees = currentValue * 0.0083;
        const sellingFeesPercent = 0.83;
        const netProfit = profit - sellingFees;
        const saleNeeded = payment.gbpAmount + profitTarget + sellingFees;

        return {
          ...payment,
          currentBtcPrice: currentBtcPrice,
          currentValue: currentValue,
          profit: profit,
          profitPercent: profitPercent,
          priceChange: priceChange,
          priceChangePercent: priceChangePercent,
          isProfit: profit > 0,
          daysHeld: this.calculateDaysHeld(payment.timestamp),
          // Enhanced profit analysis
          profitAnalysis: {
            currentProfit: profit,
            neededProfit: neededProfit,
            neededProfitPercent: neededProfitPercent,
            priceNeeded: priceNeeded,
            priceNeededPercent: priceNeededPercent,
            saleNeeded: saleNeeded,
            sellingFees: sellingFees,
            sellingFeesPercent: sellingFeesPercent,
            netProfit: netProfit,
            profitTarget: profitTarget
          }
        };
    });
  }

  /**
   * Clean up payments when BTC is sold - remove payments that exceed remaining balance
   * Uses FIFO (First In, First Out) principle
   * @param {number} remainingBtcBalance - Current BTC balance after sale
   */
  cleanupPaymentsAfterSale(remainingBtcBalance) {
    if (remainingBtcBalance <= 0) {
      // All BTC sold - mark all payments as consumed
      this.payments.forEach(payment => {
        if (payment.status === 'active') {
          payment.status = 'consumed';
          payment.consumedDate = new Date().toISOString();
        }
      });
      console.log('🔄 All payments marked as consumed - BTC balance is zero');
    } else {
      // Some BTC remains - keep payments that fit within remaining balance
      let runningTotal = 0;
      const activePayments = this.payments.filter(p => p.status === 'active');
      
      // Sort by timestamp (FIFO - oldest first)
      activePayments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      for (const payment of activePayments) {
        if (runningTotal + payment.btcAmount <= remainingBtcBalance) {
          runningTotal += payment.btcAmount;
        } else {
          // This payment exceeds remaining balance
          const partialAmount = remainingBtcBalance - runningTotal;
          
          if (partialAmount > 0.00000001) { // Keep if significant amount remains
            payment.btcAmount = partialAmount;
            payment.status = 'partial';
            payment.lastModified = new Date().toISOString();
            runningTotal = remainingBtcBalance;
          } else {
            payment.status = 'consumed';
            payment.consumedDate = new Date().toISOString();
          }
          
          // Mark all subsequent payments as consumed
          const remainingPayments = activePayments.slice(activePayments.indexOf(payment) + 1);
          remainingPayments.forEach(p => {
            p.status = 'consumed';
            p.consumedDate = new Date().toISOString();
          });
          break;
        }
      }
      
      console.log(`🔄 Payment cleanup complete - ${runningTotal.toFixed(8)} BTC accounted for`);
    }
    
    this.savePayments();
  }

  /**
   * Get summary statistics for all payments
   * @param {number} currentBtcPrice - Current BTC price
   * @returns {Object} Summary statistics
   */
  getPaymentSummary(currentBtcPrice) {
    const activePayments = this.payments.filter(p => p.status === 'active');
    const paymentsWithProfits = this.calculatePaymentProfits(currentBtcPrice);
    
    if (activePayments.length === 0) {
      return {
        totalPayments: 0,
        totalGbpInvested: 0,
        totalBtcPurchased: 0,
        totalCurrentValue: 0,
        totalProfit: 0,
        totalProfitPercent: 0,
        averageBuyPrice: 0,
        profitablePayments: 0,
        lossPayments: 0
      };
    }

    const totalGbpInvested = activePayments.reduce((sum, p) => sum + p.gbpAmount, 0);
    const totalBtcPurchased = activePayments.reduce((sum, p) => sum + p.btcAmount, 0);
    const totalCurrentValue = paymentsWithProfits.reduce((sum, p) => sum + p.currentValue, 0);
    const totalProfit = totalCurrentValue - totalGbpInvested;
    const averageBuyPrice = totalGbpInvested / totalBtcPurchased;
    const profitablePayments = paymentsWithProfits.filter(p => p.isProfit).length;

    return {
      totalPayments: activePayments.length,
      totalGbpInvested: totalGbpInvested,
      totalBtcPurchased: totalBtcPurchased,
      totalCurrentValue: totalCurrentValue,
      totalProfit: totalProfit,
      totalProfitPercent: (totalProfit / totalGbpInvested) * 100,
      averageBuyPrice: averageBuyPrice,
      profitablePayments: profitablePayments,
      lossPayments: activePayments.length - profitablePayments,
      paymentsWithProfits: paymentsWithProfits
    };
  }

  /**
   * Generate a unique payment ID
   */
  generatePaymentId() {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate days held for a payment
   */
  calculateDaysHeld(timestamp) {
    const purchaseDate = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - purchaseDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get all payments (for debugging/admin)
   */
  getAllPayments() {
    return this.payments;
  }

  /**
   * Get active payments only
   */
  getActivePayments() {
    return this.payments.filter(p => p.status === 'active');
  }

  /**
   * Sell an individual payment
   * @param {string} paymentId - ID of the payment to sell
   * @param {number} currentBtcPrice - Current BTC price
   * @returns {Object} Sale result with profit details
   */
  sellIndividualPayment(paymentId, currentBtcPrice) {
    const payment = this.payments.find(p => p.id === paymentId && p.status === 'active');
    
    if (!payment) {
      throw new Error(`Payment not found or already sold: ${paymentId}`);
    }

    // Calculate sale details
    const currentValue = payment.btcAmount * currentBtcPrice;
    const profit = currentValue - payment.gbpAmount;
    const profitPercent = (profit / payment.gbpAmount) * 100;
    const sellingFees = currentValue * 0.0083; // 0.83% Coinbase fee
    const netProfit = profit - sellingFees;

    // Mark payment as sold
    payment.status = 'sold';
    payment.soldDate = new Date().toISOString();
    payment.soldPrice = currentBtcPrice;
    payment.soldValue = currentValue;
    payment.profit = profit;
    payment.netProfit = netProfit;
    payment.sellingFees = sellingFees;

    this.savePayments();

    const saleResult = {
      paymentId: paymentId,
      btcAmount: payment.btcAmount,
      originalCost: payment.gbpAmount,
      saleValue: currentValue,
      sellingFees: sellingFees,
      grossProfit: profit,
      netProfit: netProfit,
      profitPercent: profitPercent,
      originalPrice: payment.btcPrice,
      salePrice: currentBtcPrice,
      daysHeld: this.calculateDaysHeld(payment.timestamp)
    };

    console.log(`💸 Sold payment ${paymentId}: ${payment.btcAmount.toFixed(8)} BTC for £${currentValue.toFixed(2)} (profit: £${netProfit.toFixed(2)})`);
    
    return saleResult;
  }

  /**
   * Check for payments that have become profitable and ready to sell
   * @param {number} currentBtcPrice - Current BTC price
   * @param {number} profitTarget - Target profit amount (default: 10)
   * @param {Object} lastAlerts - Object to track last alert times to prevent spam
   * @returns {Array} Array of payments ready to sell
   */
  checkProfitablePayments(currentBtcPrice, profitTarget = 10, lastAlerts = {}) {
    const paymentsWithProfits = this.calculatePaymentProfits(currentBtcPrice, profitTarget);
    const profitablePayments = [];
    
    paymentsWithProfits.forEach(payment => {
      const netProfit = payment.profitAnalysis.netProfit;
      const isReadyToSell = netProfit >= profitTarget;
      
      if (isReadyToSell) {
        // Check if we've already alerted for this payment recently (within last hour)
        const alertKey = `payment_${payment.id}`;
        const lastAlertTime = lastAlerts[alertKey] || 0;
        const hourAgo = Date.now() - (60 * 60 * 1000); // 1 hour ago
        
        const shouldAlert = lastAlertTime < hourAgo;
        
        profitablePayments.push({
          ...payment,
          readyToSell: true,
          shouldAlert: shouldAlert,
          netProfit: netProfit,
          profitTarget: profitTarget,
          profitExcess: netProfit - profitTarget
        });
        
        // Update last alert time if we should alert
        if (shouldAlert) {
          lastAlerts[alertKey] = Date.now();
        }
      }
    });
    
    return profitablePayments;
  }

  /**
   * Get visual status for each payment (for UI display)
   * @param {number} currentBtcPrice - Current BTC price
   * @param {number} profitTarget - Target profit amount (default: 10)
   * @returns {Array} Array of payments with status indicators
   */
  getPaymentStatuses(currentBtcPrice, profitTarget = 10) {
    const paymentsWithProfits = this.calculatePaymentProfits(currentBtcPrice, profitTarget);
    
    return paymentsWithProfits.map(payment => {
      const netProfit = payment.profitAnalysis.netProfit;
      const profitPercent = payment.profitAnalysis.neededProfitPercent;
      
      let status, statusColor, statusText, badge;
      
      if (netProfit >= profitTarget) {
        status = 'ready-to-sell';
        statusColor = '#28a745'; // Green
        statusText = '✅ Ready to Sell';
        badge = 'PROFIT';
      } else if (netProfit > 0) {
        status = 'profitable';
        statusColor = '#ffc107'; // Yellow/Orange
        statusText = '📈 Profitable';
        badge = 'GAIN';
      } else if (netProfit > -5) {
        status = 'break-even';
        statusColor = '#6c757d'; // Gray
        statusText = '📊 Break Even';
        badge = 'EVEN';
      } else {
        status = 'loss';
        statusColor = '#dc3545'; // Red
        statusText = '📉 At Loss';
        badge = 'LOSS';
      }
      
      return {
        ...payment,
        status: status,
        statusColor: statusColor,
        statusText: statusText,
        badge: badge,
        readyToSell: status === 'ready-to-sell',
        netProfit: netProfit,
        profitTarget: profitTarget
      };
    });
  }

  /**
   * Clear all payment history (use with caution)
   */
  clearAllPayments() {
    this.payments = [];
    this.savePayments();
    console.log('🗑️ All payment history cleared');
  }
}

module.exports = PaymentTracker;