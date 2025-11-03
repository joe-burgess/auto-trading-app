// Profit Tracking System for Auto Trading
const fs = require('fs');

class ProfitTracker {
  constructor(config = {}) {
    this.config = {
      // Profit tracking settings
      profitThreshold: config.profitThreshold || 10, // £10 profit threshold
      trackingFile: config.trackingFile || 'data/profit-tracking.json',
      balanceFile: config.balanceFile || 'data/balance-history.json',
      
      // Alert settings
      alerts: {
        enabled: config.alerts?.enabled !== false,
        profitAlert: config.alerts?.profitAlert !== false,
        lossAlert: config.alerts?.lossAlert !== false,
        milestoneAlert: config.alerts?.milestoneAlert !== false
      },
      
      // Milestones for celebration
      profitMilestones: config.profitMilestones || [10, 25, 50, 100, 250, 500, 1000],
      
      // Milestone mode configuration
      milestoneMode: config.milestoneMode || 'progressive', // 'progressive', 'fixed', or 'static'
      fixedMilestoneIncrement: config.fixedMilestoneIncrement || 10,
      staticMilestoneAmount: config.staticMilestoneAmount || 10,
      
      // Starting balance tracking
      initialBalance: config.initialBalance || null,
      autoDetectInitialBalance: config.autoDetectInitialBalance !== false
    };
    
    this.profitHistory = [];
    this.balanceHistory = [];
    this.loadProfitData();
  }

  /**
   * Load existing profit tracking data
   */
  loadProfitData() {
    try {
      // Load profit history
      if (fs.existsSync(this.config.trackingFile)) {
        const data = fs.readFileSync(this.config.trackingFile, 'utf8');
        this.profitHistory = JSON.parse(data);
        console.log(`📂 Loaded ${this.profitHistory.length} profit records`);
      }
      
      // Load balance history
      if (fs.existsSync(this.config.balanceFile)) {
        const data = fs.readFileSync(this.config.balanceFile, 'utf8');
        this.balanceHistory = JSON.parse(data);
        console.log(`📂 Loaded ${this.balanceHistory.length} balance records`);
      }
      
      // Set initial balance if not configured
      if (!this.config.initialBalance && this.balanceHistory.length > 0) {
        this.config.initialBalance = this.balanceHistory[0].portfolioValue?.totalValue || this.balanceHistory[0].totalBalance;
        console.log(`💰 Auto-detected initial balance: £${this.config.initialBalance.toFixed(2)}`);
      }
      
    } catch (error) {
      console.log('⚠️ Could not load profit tracking data:', error.message);
      this.profitHistory = [];
      this.balanceHistory = [];
    }
  }

  /**
   * Save profit tracking data
   */
  saveProfitData() {
    try {
      fs.writeFileSync(this.config.trackingFile, JSON.stringify(this.profitHistory, null, 2));
      fs.writeFileSync(this.config.balanceFile, JSON.stringify(this.balanceHistory, null, 2));
    } catch (error) {
      console.error('❌ Failed to save profit tracking data:', error.message);
    }
  }

  /**
   * Record a trade and its impact on profit/loss
   */
  recordTrade(tradeData) {
    const {
      btcAmount,
      feeCalculation,
      timestamp,
      order
    } = tradeData;

    const profitRecord = {
      timestamp: timestamp || new Date().toISOString(),
      type: 'trade',
      btcAmount,
      grossValue: feeCalculation.grossGbpValue,
      netValue: feeCalculation.finalAmount,
      fees: feeCalculation.fees.total,
      profitLoss: feeCalculation.finalAmount - (btcAmount * this.getEstimatedBuyPrice(btcAmount)),
      orderId: order?.id || 'simulated',
      runningProfit: this.calculateRunningProfit() + (feeCalculation.finalAmount - (btcAmount * this.getEstimatedBuyPrice(btcAmount)))
    };

    this.profitHistory.push(profitRecord);
    this.checkProfitThreshold(profitRecord.runningProfit);
    this.saveProfitData();
    
    return profitRecord;
  }

  /**
   * Record current balance snapshot
   */
  recordBalance(balances, source = 'manual', currentBtcPrice = null) {
    const totalGbpBalance = balances.GBP?.available || 0;
    const btcPrice = currentBtcPrice || this.getCurrentBtcPrice();
    const totalBtcValue = (balances.BTC?.available || 0) * btcPrice;
    const totalBalance = totalGbpBalance + totalBtcValue;

    const balanceRecord = {
      timestamp: new Date().toISOString(),
      source,
      gbpBalance: totalGbpBalance,
      btcBalance: balances.BTC?.available || 0,
      btcPrice: btcPrice,
      btcValueInGbp: totalBtcValue,
      totalBalance,
      profitLoss: this.config.initialBalance ? totalBalance - this.config.initialBalance : 0
    };

    this.balanceHistory.push(balanceRecord);
    
    // Set initial balance if first record
    if (!this.config.initialBalance && this.balanceHistory.length === 1) {
      this.config.initialBalance = totalBalance;
      balanceRecord.profitLoss = 0;
      console.log(`💰 Set initial balance: £${this.config.initialBalance.toFixed(2)}`);
    }

    this.checkProfitThreshold(balanceRecord.profitLoss);
    this.saveProfitData();
    
    return balanceRecord;
  }

  /**
   * Check if profit threshold has been reached
   */
  checkProfitThreshold(currentProfit) {
    if (!this.config.alerts.enabled) return;

    const threshold = this.config.profitThreshold;
    
    // Check for profit threshold achievement
    if (currentProfit >= threshold && this.config.alerts.profitAlert) {
      this.displayProfitAlert(currentProfit, 'PROFIT_THRESHOLD_REACHED');
    }
    
    // Check for loss threshold
    if (currentProfit <= -threshold && this.config.alerts.lossAlert) {
      this.displayProfitAlert(currentProfit, 'LOSS_THRESHOLD_REACHED');
    }
    
    // Check for milestone achievements
    if (this.config.alerts.milestoneAlert) {
      if (this.config.milestoneMode === 'fixed') {
        // Fixed increment mode: check if we've reached a new increment level
        const increment = this.config.fixedMilestoneIncrement;
        if (currentProfit > 0) {
          const currentMilestone = Math.floor(currentProfit / increment) * increment;
          if (currentMilestone > 0 && !this.hasMilestoneBeenReached(currentMilestone)) {
            this.displayProfitAlert(currentProfit, 'MILESTONE_ACHIEVED', currentMilestone);
            this.recordMilestone(currentMilestone);
          }
        }
      } else if (this.config.milestoneMode === 'static') {
        // Static mode: celebrate every time we reach the static amount
        const staticAmount = this.config.staticMilestoneAmount;
        if (currentProfit >= staticAmount) {
          // Check if we should celebrate (every time we cross the threshold)
          const lastRecord = this.profitHistory[this.profitHistory.length - 1];
          const wasAboveThreshold = lastRecord && lastRecord.runningProfit >= staticAmount;
          
          if (!wasAboveThreshold) {
            this.displayProfitAlert(currentProfit, 'MILESTONE_ACHIEVED', staticAmount);
            this.recordMilestone(staticAmount);
          }
        }
      } else {
        // Progressive mode: use predefined milestone list
        for (const milestone of this.config.profitMilestones) {
          if (currentProfit >= milestone && !this.hasMilestoneBeenReached(milestone)) {
            this.displayProfitAlert(currentProfit, 'MILESTONE_ACHIEVED', milestone);
            this.recordMilestone(milestone);
          }
        }
      }
    }
  }

  /**
   * Display profit/loss alerts
   */
  displayProfitAlert(currentProfit, type, milestone = null) {
    console.log('\n🎉 ============================');
    
    switch (type) {
      case 'PROFIT_THRESHOLD_REACHED':
        console.log('🚀 PROFIT THRESHOLD REACHED! 🚀');
        console.log(`💰 You've made £${currentProfit.toFixed(2)} profit!`);
        console.log(`🎯 Target was £${this.config.profitThreshold}`);
        break;
        
      case 'LOSS_THRESHOLD_REACHED':
        console.log('⚠️ LOSS THRESHOLD REACHED ⚠️');
        console.log(`📉 Current loss: £${Math.abs(currentProfit).toFixed(2)}`);
        console.log(`🛑 Consider reviewing your strategy`);
        break;
        
      case 'MILESTONE_ACHIEVED':
        console.log(`🏆 MILESTONE ACHIEVED! 🏆`);
        console.log(`🎯 £${milestone} profit milestone reached!`);
        console.log(`💰 Current profit: £${currentProfit.toFixed(2)}`);
        console.log(`📊 Mode: ${this.config.milestoneMode === 'fixed' ? `Fixed £${this.config.fixedMilestoneIncrement} increments` : this.config.milestoneMode === 'static' ? `Static £${this.config.staticMilestoneAmount} target` : 'Progressive levels'}`);
        break;
    }
    
    console.log(`📊 Starting balance: £${this.config.initialBalance?.toFixed(2) || 'Not set'}`);
    console.log(`💷 Current profit/loss: £${currentProfit.toFixed(2)}`);
    console.log(`📈 Profit percentage: ${this.config.initialBalance ? ((currentProfit / this.config.initialBalance) * 100).toFixed(2) : 'N/A'}%`);
    console.log('============================\n');
    
    // Play sound alert if enabled
    if (this.config.alerts.sound) {
      process.stdout.write('\u0007'); // Terminal beep
    }
  }

  /**
   * Check if milestone has been reached before
   */
  hasMilestoneBeenReached(milestone) {
    return this.profitHistory.some(record => 
      record.type === 'milestone' && record.milestone === milestone
    );
  }

  /**
   * Record milestone achievement
   */
  recordMilestone(milestone) {
    const milestoneRecord = {
      timestamp: new Date().toISOString(),
      type: 'milestone',
      milestone,
      currentProfit: this.getCurrentProfit(),
      description: `£${milestone} profit milestone achieved`
    };
    
    this.profitHistory.push(milestoneRecord);
    this.saveProfitData();
  }

  /**
   * Calculate current running profit
   */
  calculateRunningProfit() {
    if (!this.config.initialBalance) return 0;
    
    const latestBalance = this.balanceHistory.length > 0 
      ? (this.balanceHistory[this.balanceHistory.length - 1].portfolioValue?.totalValue || this.balanceHistory[this.balanceHistory.length - 1].totalBalance)
      : this.config.initialBalance;
      
    return latestBalance - this.config.initialBalance;
  }

  /**
   * Get current profit/loss
   */
  getCurrentProfit() {
    return this.calculateRunningProfit();
  }

  /**
   * Get profit statistics
   */
  getProfitStats() {
    const currentProfit = this.getCurrentProfit();
    const totalTrades = this.profitHistory.filter(r => r.type === 'trade').length;
    const totalFees = this.profitHistory
      .filter(r => r.type === 'trade')
      .reduce((sum, r) => sum + (r.fees || 0), 0);
    
    const profitableTrades = this.profitHistory
      .filter(r => r.type === 'trade' && r.profitLoss > 0).length;
    
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
    
    const milestonesReached = this.profitHistory
      .filter(r => r.type === 'milestone').length;

    return {
      currentProfit,
      profitPercentage: this.config.initialBalance ? (currentProfit / this.config.initialBalance) * 100 : 0,
      totalTrades,
      profitableTrades,
      winRate,
      totalFees,
      milestonesReached,
      nextMilestone: this.getNextMilestone(),
      initialBalance: this.config.initialBalance,
      thresholdReached: Math.abs(currentProfit) >= this.config.profitThreshold,
      thresholdProgress: (Math.abs(currentProfit) / this.config.profitThreshold) * 100
    };
  }

  /**
   * Get next profit milestone
   */
  getNextMilestone() {
    const currentProfit = this.getCurrentProfit();
    
    if (this.config.milestoneMode === 'fixed') {
      // Fixed increment mode: next milestone is current profit rounded up to next increment
      const increment = this.config.fixedMilestoneIncrement;
      
      if (currentProfit <= 0) {
        return increment; // First milestone is always the increment amount
      }
      
      const nextMilestone = Math.ceil(currentProfit / increment) * increment;
      
      // If we're exactly at a milestone, go to the next one
      return currentProfit % increment === 0 ? 
        currentProfit + increment : nextMilestone;
    } else if (this.config.milestoneMode === 'static') {
      // Static mode: always shows the same milestone amount
      return this.config.staticMilestoneAmount;
    } else {
      // Progressive mode: use predefined milestone list
      return this.config.profitMilestones.find(milestone => 
        milestone > currentProfit && !this.hasMilestoneBeenReached(milestone)
      );
    }
  }

  /**
   * Display comprehensive profit report
   */
  displayProfitReport() {
    const stats = this.getProfitStats();
    
    console.log('\n💰 ======= PROFIT REPORT =======');
    console.log(`📊 Initial Balance: £${stats.initialBalance?.toFixed(2) || 'Not set'}`);
    console.log(`💷 Current Profit/Loss: £${stats.currentProfit.toFixed(2)}`);
    console.log(`📈 Profit Percentage: ${stats.profitPercentage.toFixed(2)}%`);
    console.log('\n📋 TRADING STATISTICS:');
    console.log(`   Total Trades: ${stats.totalTrades}`);
    console.log(`   Profitable Trades: ${stats.profitableTrades}`);
    console.log(`   Win Rate: ${stats.winRate.toFixed(1)}%`);
    console.log(`   Total Fees Paid: £${stats.totalFees.toFixed(2)}`);
    console.log('\n🎯 PROGRESS TRACKING:');
    console.log(`   Milestone Mode: ${this.config.milestoneMode === 'fixed' ? `🔢 Fixed (£${this.config.fixedMilestoneIncrement} increments)` : this.config.milestoneMode === 'static' ? `🎯 Static (£${this.config.staticMilestoneAmount} target)` : '📈 Progressive (predefined levels)'}`);
    console.log(`   Profit Threshold (£${this.config.profitThreshold}): ${stats.thresholdReached ? '✅ REACHED' : `${stats.thresholdProgress.toFixed(1)}%`}`);
    console.log(`   Milestones Achieved: ${stats.milestonesReached}`);
    console.log(`   Next Milestone: £${stats.nextMilestone || 'None remaining'}`);
    console.log('===============================\n');
    
    return stats;
  }

  /**
   * Estimate buy price for profit calculation (simplified)
   */
  getEstimatedBuyPrice(btcAmount) {
    // This would ideally track actual buy prices
    // For now, use a simple estimate
    return this.getCurrentBtcPrice() * 0.95; // Assume 5% lower buy price
  }

  /**
   * Get current BTC price (placeholder - would integrate with price monitor)
   */
  getCurrentBtcPrice() {
    // This would integrate with your price monitoring system
    return 83775; // Placeholder - replace with actual price fetch
  }

  /**
   * Set initial balance manually
   */
  setInitialBalance(amount) {
    this.config.initialBalance = amount;
    console.log(`💰 Initial balance set to £${amount.toFixed(2)}`);
    
    // Update any existing balance records
    this.balanceHistory.forEach(record => {
      record.profitLoss = record.totalBalance - amount;
    });
    
    this.saveProfitData();
  }

  /**
   * Reset profit tracking
   */
  resetProfitTracking() {
    this.profitHistory = [];
    this.balanceHistory = [];
    this.config.initialBalance = null;
    this.saveProfitData();
    console.log('🔄 Profit tracking reset');
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'report';

  // Load configuration from unified config
  let config = {
    profitThreshold: 10,
    alerts: {
      enabled: true,
      profitAlert: true,
      lossAlert: true,
      milestoneAlert: true
    }
  };

  try {
    const unifiedConfig = JSON.parse(require('fs').readFileSync('./config/unified-config.json', 'utf8'));
    config = unifiedConfig.profitTracking || config;
  } catch (error) {
    console.log('⚠️ Using default config (config/unified-config.json not found)');
  }

  const tracker = new ProfitTracker(config);

  switch (command) {
    case 'report':
      tracker.displayProfitReport();
      break;

    case 'set-balance':
      const amount = parseFloat(args[1]);
      if (amount) {
        tracker.setInitialBalance(amount);
      } else {
        console.log('Usage: node profit-tracker.js set-balance 1000');
      }
      break;

    case 'test-alert':
      const testProfit = parseFloat(args[1]) || 15;
      tracker.checkProfitThreshold(testProfit);
      break;

    case 'reset':
      tracker.resetProfitTracking();
      break;

    case 'simulate':
      // Simulate some trades for testing
      console.log('🧪 Simulating profit tracking...');
      tracker.setInitialBalance(1000);
      
      // Simulate balance updates
      const balances1 = { GBP: { available: 1005 }, BTC: { available: 0 } };
      tracker.recordBalance(balances1, 'simulation');
      
      const balances2 = { GBP: { available: 1012 }, BTC: { available: 0 } };
      tracker.recordBalance(balances2, 'simulation');
      
      tracker.displayProfitReport();
      break;

    default:
      console.log(`
💰 Profit Tracker Commands:

  report              Show comprehensive profit report
  set-balance [amt]   Set initial balance (e.g., 1000)
  test-alert [profit] Test profit alert with amount
  simulate           Simulate profit tracking
  reset              Reset all profit tracking data

Examples:
  node profit-tracker.js report
  node profit-tracker.js set-balance 1000
  node profit-tracker.js test-alert 15
      `);
  }
}

module.exports = ProfitTracker;