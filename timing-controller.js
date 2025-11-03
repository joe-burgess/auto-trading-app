// Human-like Timing Controller
// Simulates realistic trading timing patterns to avoid detection

class TimingController {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      
      // Random delays
      randomDelayMin: config.randomDelayMin || 300000,    // 5 minutes
      randomDelayMax: config.randomDelayMax || 1800000,   // 30 minutes
      
      // Trading hours
      tradingHours: {
        enabled: config.tradingHours?.enabled !== false,
        start: config.tradingHours?.start || 7,           // 7 AM
        end: config.tradingHours?.end || 23,              // 11 PM
        timezone: config.tradingHours?.timezone || 'Europe/London'
      },
      
      // Weekend avoidance
      avoidWeekends: config.avoidWeekends !== false,
      
      // Emergency override for large price movements
      emergencyOverride: {
        enabled: config.emergencyOverride?.enabled !== false,
        priceJumpThreshold: config.emergencyOverride?.priceJumpThreshold || 0.15, // 15%
        allowSellOnly: config.emergencyOverride?.allowSellOnly !== false
      },
      
      // Hesitation simulation
      hesitation: {
        enabled: config.hesitation?.enabled !== false,
        chance: config.hesitation?.chance || 0.15,        // 15% chance
        delayMin: config.hesitation?.delayMin || 600000,  // 10 minutes
        delayMax: config.hesitation?.delayMax || 3600000  // 1 hour
      }
    };
    
    this.pendingActions = new Map();
    this.hesitationHistory = [];
  }

  /**
   * Check if current time is within trading hours
   */
  isWithinTradingHours() {
    if (!this.config.tradingHours.enabled) return true;
    
    const now = new Date();
    const hour = now.getHours();
    
    return hour >= this.config.tradingHours.start && 
           hour < this.config.tradingHours.end;
  }

  /**
   * Check if current day is a weekend
   */
  isWeekend() {
    if (!this.config.avoidWeekends) return false;
    
    const now = new Date();
    const day = now.getDay();
    
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Check if trading is allowed at current time
   */
  isTradingAllowed(priceData = null, actionType = null) {
    if (!this.config.enabled) return true;
    
    // Check for emergency override
    if (this.checkEmergencyOverride(priceData, actionType)) {
      return true;
    }
    
    if (this.isWeekend()) {
      console.log('⏸️ Weekend detected - trading paused until Monday');
      return false;
    }
    
    if (!this.isWithinTradingHours()) {
      const start = this.config.tradingHours.start;
      const end = this.config.tradingHours.end;
      console.log(`⏸️ Outside trading hours (${start}:00-${end}:00) - trading paused`);
      return false;
    }
    
    return true;
  }

  /**
   * Check if emergency override should allow trading
   */
  checkEmergencyOverride(priceData, actionType) {
    if (!this.config.emergencyOverride.enabled || !priceData) {
      return false;
    }
    
    // Only allow sells during emergency (not buys)
    if (this.config.emergencyOverride.allowSellOnly && actionType !== 'sell') {
      return false;
    }
    
    // Check if we have previous price to compare against
    if (!this.lastRecordedPrice) {
      this.lastRecordedPrice = priceData.price;
      return false;
    }
    
    // Calculate price change
    const priceChange = (priceData.price - this.lastRecordedPrice) / this.lastRecordedPrice;
    const threshold = this.config.emergencyOverride.priceJumpThreshold;
    
    if (priceChange >= threshold) {
      console.log(`🚨 EMERGENCY OVERRIDE: Price jumped ${(priceChange * 100).toFixed(1)}% (>${(threshold * 100)}%) - allowing emergency ${actionType}`);
      return true;
    }
    
    // Update last recorded price for next comparison
    this.lastRecordedPrice = priceData.price;
    return false;
  }

  /**
   * Check if trading would be allowed at a specific time
   */
  isTradingAllowedAt(futureTime) {
    if (!this.config.enabled) return true;
    
    const checkDate = new Date(futureTime);
    const dayOfWeek = checkDate.getDay();
    const hour = checkDate.getHours();
    
    // Check weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Check trading hours
    if (hour < this.config.tradingHours.start || hour >= this.config.tradingHours.end) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate random delay in milliseconds
   */
  getRandomDelay() {
    if (!this.config.enabled) return 0;
    
    const min = this.config.randomDelayMin;
    const max = this.config.randomDelayMax;
    const delay = Math.random() * (max - min) + min;
    
    return Math.round(delay);
  }

  /**
   * Check if should hesitate before making trade
   */
  shouldHesitate() {
    if (!this.config.hesitation.enabled) return false;
    
    return Math.random() < this.config.hesitation.chance;
  }

  /**
   * Get hesitation delay
   */
  getHesitationDelay() {
    const min = this.config.hesitation.delayMin;
    const max = this.config.hesitation.delayMax;
    const delay = Math.random() * (max - min) + min;
    
    return Math.round(delay);
  }

  /**
   * Schedule a trading action with human-like timing
   */
  async scheduleAction(actionId, action, type = 'trade', priceData = null) {
    if (!this.config.enabled) {
      console.log('🤖 Timing disabled - executing immediately');
      return await action();
    }

    // Check if trading is allowed right now (with emergency override check)
    if (!this.isTradingAllowed(priceData, type)) {
      console.log(`⏰ ${type} scheduled for next trading window`);
      return false;
    }

    // Generate delays
    const baseDelay = this.getRandomDelay();
    const hesitates = this.shouldHesitate();
    const hesitationDelay = hesitates ? this.getHesitationDelay() : 0;
    const totalDelay = baseDelay + hesitationDelay;

    console.log(`⏰ Scheduling ${type} with human-like timing:`);
    console.log(`   Base delay: ${Math.round(baseDelay / 60000)} minutes`);
    if (hesitates) {
      console.log(`   💭 Hesitation: ${Math.round(hesitationDelay / 60000)} minutes`);
    }
    console.log(`   📅 Total delay: ${Math.round(totalDelay / 60000)} minutes`);
    console.log(`   🕐 Execution time: ${new Date(Date.now() + totalDelay).toLocaleTimeString()}`);

    // Store pending action
    this.pendingActions.set(actionId, {
      action,
      type,
      priceData,  // Store price data for later emergency override check
      scheduledTime: Date.now() + totalDelay,
      hesitated: hesitates
    });

    // Schedule execution
    setTimeout(async () => {
      await this.executeScheduledAction(actionId);
    }, totalDelay);

    return true;
  }

  /**
   * Execute a scheduled action
   */
  async executeScheduledAction(actionId) {
    const pendingAction = this.pendingActions.get(actionId);
    if (!pendingAction) return;

    // Double-check trading is still allowed
    if (!this.isTradingAllowed(pendingAction.priceData, pendingAction.type)) {
      console.log(`⏸️ Trading no longer allowed - rescheduling ${pendingAction.type}`);
      this.pendingActions.delete(actionId);
      
      // Reschedule for next trading window
      setTimeout(() => {
        this.scheduleAction(actionId, pendingAction.action, pendingAction.type, pendingAction.priceData);
      }, 3600000); // Check again in 1 hour
      
      return;
    }

    console.log(`🎯 Executing scheduled ${pendingAction.type}...`);
    
    try {
      const result = await pendingAction.action();
      
      if (pendingAction.hesitated) {
        this.hesitationHistory.push({
          timestamp: new Date().toISOString(),
          type: pendingAction.type,
          executed: true
        });
      }
      
      this.pendingActions.delete(actionId);
      return result;
      
    } catch (error) {
      console.error(`❌ Scheduled ${pendingAction.type} failed:`, error.message);
      this.pendingActions.delete(actionId);
      throw error;
    }
  }

  /**
   * Get time until next trading window
   */
  getTimeUntilNextTradingWindow() {
    if (this.isTradingAllowed()) return 0;
    
    const now = new Date();
    let nextWindow = new Date(now);
    
    if (this.isWeekend()) {
      // Next Monday
      const daysUntilMonday = (8 - now.getDay()) % 7;
      nextWindow.setDate(now.getDate() + daysUntilMonday);
      nextWindow.setHours(this.config.tradingHours.start, 0, 0, 0);
    } else {
      // Next day or later today
      if (now.getHours() >= this.config.tradingHours.end) {
        nextWindow.setDate(now.getDate() + 1);
      }
      nextWindow.setHours(this.config.tradingHours.start, 0, 0, 0);
    }
    
    return nextWindow.getTime() - now.getTime();
  }

  /**
   * Display timing status
   */
  displayStatus() {
    console.log('\n⏰ ===== TIMING CONTROLLER STATUS =====');
    console.log(`🔧 Enabled: ${this.config.enabled ? '✅' : '❌'}`);
    console.log(`🕐 Current time: ${new Date().toLocaleTimeString()}`);
    console.log(`📅 Trading allowed: ${this.isTradingAllowed() ? '✅' : '❌'}`);
    
    if (this.config.tradingHours.enabled) {
      console.log(`⏰ Trading hours: ${this.config.tradingHours.start}:00-${this.config.tradingHours.end}:00`);
    }
    
    if (this.config.avoidWeekends) {
      console.log(`📅 Weekend trading: ❌ Disabled`);
    }
    
    console.log(`🎲 Delay range: ${Math.round(this.config.randomDelayMin/60000)}-${Math.round(this.config.randomDelayMax/60000)} minutes`);
    console.log(`💭 Hesitation chance: ${(this.config.hesitation.chance * 100).toFixed(1)}%`);
    
    if (this.pendingActions.size > 0) {
      console.log(`⏳ Pending actions: ${this.pendingActions.size}`);
      for (const [id, action] of this.pendingActions) {
        const timeLeft = Math.round((action.scheduledTime - Date.now()) / 60000);
        console.log(`   ${action.type}: ${timeLeft} minutes`);
      }
    }
    
    if (!this.isTradingAllowed()) {
      const timeUntilNext = this.getTimeUntilNextTradingWindow();
      const hoursUntil = Math.round(timeUntilNext / (1000 * 60 * 60));
      console.log(`⏳ Next trading window: ${hoursUntil} hours`);
    }
    
    console.log('====================================\n');
  }

  /**
   * Cancel all pending actions
   */
  cancelAllPending() {
    console.log(`🚫 Cancelling ${this.pendingActions.size} pending actions`);
    this.pendingActions.clear();
  }
}

module.exports = TimingController;