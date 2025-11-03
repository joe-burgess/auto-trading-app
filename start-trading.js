#!/usr/bin/env node

/**
 * Combined Auto-Trading + Dashboard Launcher
 * Starts both the auto-trading system and web dashboard simultaneously
 */

const { spawn } = require('child_process');
const path = require('path');

class TradingSystemLauncher {
  constructor(options = {}) {
    this.processes = [];
    this.isShuttingDown = false;
    this.showDashboardOutput = options.showDashboardOutput || false;
  }

  /**
   * Terminate any existing trading processes
   */
  async terminateExistingProcesses() {
    try {
      const { execSync } = require('child_process');
      
      console.log('🔍 Checking for existing trading processes...');
      
      // Get current process ID to exclude it
      const currentPid = process.pid;
      
      // Find existing trading processes (excluding current process)
      const psCommand = `ps aux | grep -E "(unified-trader|web-dashboard)" | grep -v grep | grep -v ${currentPid} | awk '{print $2}'`;
      
      let existingPids;
      try {
        existingPids = execSync(psCommand, { encoding: 'utf8' }).trim();
      } catch (error) {
        // No processes found (grep returns exit code 1 when no matches)
        console.log('✅ No existing trading processes found');
        return;
      }
      
      if (existingPids) {
        const pids = existingPids.split('\n').filter(pid => pid.trim() && pid !== currentPid.toString());
        
        if (pids.length > 0) {
          console.log(`🛑 Found ${pids.length} existing trading process(es), terminating...`);
          
          // Terminate each process
          pids.forEach(pid => {
            try {
              console.log(`   ⏹️  Terminating process ${pid}...`);
              execSync(`kill -TERM ${pid}`, { stdio: 'ignore' });
            } catch (error) {
              // Process might already be dead, try force kill
              try {
                execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
              } catch (killError) {
                // Process is already dead
              }
            }
          });
          
          // Wait a moment for processes to terminate
          await this.delay(2000);
          
          // Force kill any remaining processes (excluding current process)
          try {
            const remainingPids = execSync(psCommand, { encoding: 'utf8' }).trim();
            if (remainingPids) {
              const stillRunning = remainingPids.split('\n').filter(pid => pid.trim() && pid !== currentPid.toString());
              if (stillRunning.length > 0) {
                console.log('🔥 Force killing remaining processes...');
                stillRunning.forEach(pid => {
                  try {
                    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
                  } catch (error) {
                    // Process already dead
                  }
                });
              }
            }
          } catch (error) {
            // No remaining processes found
          }
          
          console.log('✅ Existing processes terminated');
        } else {
          console.log('✅ No existing trading processes found');
        }
      } else {
        console.log('✅ No existing trading processes found');
      }
    } catch (error) {
      console.log('⚠️ Error checking for existing processes:', error.message);
      console.log('📝 Continuing with startup...');
    }
  }

  /**
   * Start both auto-trader and dashboard
   */
  async startSystem() {
    console.log('🚀 Starting Complete Trading System...\n');

    try {
      // First, terminate any existing trading processes
      await this.terminateExistingProcesses();
      
      console.log();

      // Start auto-trader
      console.log('🤖 Starting Auto-Trading System...');
      const autoTrader = this.startProcess('node', ['unified-trader.js', 'start'], {
        name: 'Auto-Trader',
        color: '\x1b[36m', // Cyan
        prefix: '[TRADER]'
      });

      // Wait a moment for auto-trader to initialize
      await this.delay(2000);

      // Start dashboard
      console.log('🌐 Starting Web Dashboard...');
      const dashboard = this.startProcess('node', ['web-dashboard.js'], {
        name: 'Dashboard',
        color: '\x1b[35m', // Magenta
        prefix: '[DASHBOARD]'
      });

      // Wait for both to start up
      await this.delay(3000);

      // Get network IP for display
      const networkIp = this.getNetworkIP();

      console.log('\n✅ Complete Trading System Started!');
      console.log('──────────────────────────────────────────────');
      console.log('🤖 Auto-Trader: Running (monitors and trades automatically)');
      console.log('🌐 Web Dashboard URLs:');
      console.log(`   💻 Local: http://localhost:3001`);
      console.log(`   📱 Network: http://${networkIp}:3001 (access from phone/other devices)`);
      if (!this.showDashboardOutput) {
        console.log('🔇 Dashboard output: Silenced (use --verbose to show)');
      }
      console.log('──────────────────────────────────────────────');
      console.log('💡 Press Ctrl+C to stop both systems\n');

      // Keep the process alive
      this.setupGracefulShutdown();
      
      // Keep process running
      process.stdin.resume();

    } catch (error) {
      console.error('❌ Failed to start trading system:', error.message);
      this.shutdown();
    }
  }

  /**
   * Start a child process with colored output
   */
  startProcess(command, args, options) {
    const proc = spawn(command, args, {
      cwd: __dirname,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    this.processes.push({
      process: proc,
      name: options.name,
      prefix: options.prefix
    });

    // Handle stdout with colored prefix
    proc.stdout.on('data', (data) => {
      // Silent dashboard output unless explicitly enabled
      if (options.name === 'Dashboard' && !this.showDashboardOutput) {
        return;
      }
      
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        console.log(`${options.color}${options.prefix}\x1b[0m ${line}`);
      });
    });

    // Handle stderr with colored prefix (always show errors)
    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        console.log(`${options.color}${options.prefix}\x1b[0m \x1b[31m${line}\x1b[0m`);
      });
    });

    // Handle process exit
    proc.on('exit', (code, signal) => {
      if (!this.isShuttingDown) {
        console.log(`\n⚠️ ${options.name} exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
        console.log('🔄 Shutting down other processes...');
        this.shutdown();
      }
    });

    proc.on('error', (error) => {
      console.error(`❌ ${options.name} error:`, error.message);
      this.shutdown();
    });

    return proc;
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        console.log(`\n🛑 Received ${signal}, shutting down trading system...`);
        this.shutdown();
      });
    });

    process.on('uncaughtException', (error) => {
      console.error('\n💥 Uncaught Exception:', error.message);
      this.shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('\n💥 Unhandled Rejection:', reason);
      this.shutdown();
    });
  }

  /**
   * Gracefully shut down all processes
   */
  shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('\n🛑 Shutting down Complete Trading System...');

    this.processes.forEach(({ process, name }) => {
      if (process && !process.killed) {
        console.log(`   ⏹️  Stopping ${name}...`);
        process.kill('SIGTERM');
        
        // Force kill after 5 seconds if not stopped
        setTimeout(() => {
          if (!process.killed) {
            console.log(`   🔥 Force killing ${name}...`);
            process.kill('SIGKILL');
          }
        }, 5000);
      }
    });

    // Exit after cleanup
    setTimeout(() => {
      console.log('✅ Trading system shutdown complete');
      process.exit(0);
    }, 2000);
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get local network IP address
   */
  getNetworkIP() {
    try {
      const { execSync } = require('child_process');
      const localIp = execSync('ipconfig getifaddr en0', { encoding: 'utf8' }).trim();
      if (localIp && localIp !== '127.0.0.1') {
        return localIp;
      }
    } catch (error) {
      // Fallback to localhost if we can't get network IP
    }
    return 'localhost';
  }

  /**
   * Display help information
   */
  static showHelp() {
    console.log(`
🚀 Complete Trading System Launcher

Usage: node start-trading.js [options]

Options:
  --help, -h      Show this help message
  --verbose, -v   Show dashboard output (default: silenced)

This script starts both:
  🤖 Auto-Trading System (unified-trader.js)
  🌐 Web Dashboard (web-dashboard.js)

The auto-trader monitors prices and executes trades automatically.
The dashboard provides a web interface at:
  💻 http://localhost:3001 (local access)
  📱 http://[your-ip]:3001 (network access)

Press Ctrl+C to stop both systems gracefully.

Examples:
  node start-trading.js              # Start with silent dashboard
  node start-trading.js --verbose    # Start with dashboard output
  npm run start-trading              # Start with silent dashboard
`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    TradingSystemLauncher.showHelp();
    return;
  }

  const options = {
    showDashboardOutput: args.includes('--verbose') || args.includes('-v')
  };

  const launcher = new TradingSystemLauncher(options);
  await launcher.startSystem();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Failed to start trading system:', error.message);
    process.exit(1);
  });
}

module.exports = TradingSystemLauncher;