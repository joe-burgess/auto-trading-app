#!/usr/bin/env node

const https = require('https');

class TelegramNotifier {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
    
    // Validate bot token format
    if (!botToken || !this.isValidBotToken(botToken)) {
      console.warn('⚠️ Invalid Telegram bot token format');
    }
    
    // Validate chat ID format
    if (!chatId || !this.isValidChatId(chatId)) {
      console.warn('⚠️ Invalid Telegram chat ID format');
    }
  }
  
  isValidBotToken(token) {
    // Telegram bot token format: numbers:letters/numbers/characters
    return /^\d+:[A-Za-z0-9_-]+$/.test(token);
  }
  
  isValidChatId(chatId) {
    // Chat ID should be a number (can be negative)
    return /^-?\d+$/.test(chatId.toString());
  }

  async sendMessage(text, options = {}) {
    const payload = {
      chat_id: this.chatId,
      text: text,
      ...options
    };
    
    // Only add parse_mode if not explicitly disabled and not already set
    if (options.parse_mode !== false && !options.hasOwnProperty('parse_mode')) {
      payload.parse_mode = 'HTML';
    }
    
    // Remove parse_mode if it's explicitly set to false
    if (options.parse_mode === false) {
      delete payload.parse_mode;
    }

    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      
      const requestOptions = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${this.botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      const req = https.request(requestOptions, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            // Log the raw response for debugging
            if (!responseData.startsWith('{')) {
              console.error('❌ Telegram API returned non-JSON response:');
              console.error('Status Code:', res.statusCode);
              console.error('Headers:', res.headers);
              console.error('Response:', responseData.substring(0, 500) + (responseData.length > 500 ? '...' : ''));
              reject(new Error(`Telegram API returned HTML instead of JSON. Status: ${res.statusCode}`));
              return;
            }
            
            const result = JSON.parse(responseData);
            if (result.ok) {
              resolve(result);
            } else {
              console.error('❌ Telegram API error response:', result);
              reject(new Error(`Telegram API error: ${result.description || 'Unknown error'}`));
            }
          } catch (error) {
            console.error('❌ Failed to parse Telegram response:', error.message);
            console.error('Raw response:', responseData.substring(0, 500) + (responseData.length > 500 ? '...' : ''));
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async sendPriceAlert(alertData) {
    // Handle both old format (price, threshold, type) and new format (alertData object)
    let price, threshold, type, message;
    
    if (typeof alertData === 'object' && alertData !== null) {
      price = alertData.price;
      threshold = alertData.threshold;
      type = alertData.type || 'drop';
      message = alertData.message;
    } else {
      // Fallback to old format for backward compatibility
      price = arguments[0];
      threshold = arguments[1];
      type = arguments[2] || 'drop';
    }
    
    // Validate inputs
    if (typeof price !== 'number' || isNaN(price)) {
      console.error('❌ Invalid price for Telegram alert:', price);
      return;
    }
    
    if (typeof threshold !== 'number' || isNaN(threshold)) {
      console.error('❌ Invalid threshold for Telegram alert:', threshold);
      return;
    }
    
    const emoji = type.includes('drop') ? '📉' : '📈';
    const direction = type.includes('drop') ? 'below' : 'above';
    
    // Use custom message if provided, otherwise create default
    const alertMessage = message || `
🚨 <b>BTC PRICE ALERT</b> 🚨

${emoji} <b>Price ${direction} threshold!</b>
💰 Current Price: £${price.toLocaleString()}
🎯 Alert Threshold: £${threshold.toLocaleString()}
⏰ Time: ${new Date().toLocaleString('en-GB')}

${type.includes('drop') ? '💡 This might be a buying opportunity!' : '💡 Consider taking profits!'}
    `.trim();

    return this.sendMessage(alertMessage);
  }

  async sendBuyConfirmation(amount, price, autoApproval = false) {
    if (autoApproval) {
      return this.sendBuyNotification(amount, price, 'executed');
    }
    
    // Validate inputs
    if (typeof price !== 'number' || isNaN(price)) {
      console.error('❌ Invalid price for buy confirmation:', price);
      return;
    }
    
    const message = `
🚨 <b>BUY OPPORTUNITY DETECTED</b> 🚨

💰 Suggested Amount: £${amount}
📈 Current Price: £${price.toLocaleString()}
📊 Your Balance: Available for purchase

<b>Would you like to proceed?</b>
Reply with /buy_yes or /buy_no
    `.trim();

    return this.sendMessage(message);
  }

  async sendBuyNotification(amount, price, status = 'executed') {
    // Validate inputs
    if (typeof price !== 'number' || isNaN(price)) {
      console.error('❌ Invalid price for buy notification:', price);
      return;
    }
    
    const emoji = status === 'executed' ? '✅' : '⏳';
    const statusText = status === 'executed' ? 'EXECUTED' : 'PENDING';
    
    const message = `
${emoji} <b>BUY ORDER ${statusText}</b> ${emoji}

💰 Amount: £${amount}
📈 Price: £${price.toLocaleString()}
🪙 BTC Acquired: ${(amount / price).toFixed(8)} BTC
⏰ Time: ${new Date().toLocaleString('en-GB')}
📊 Trade Type: ${status === 'executed' ? 'Automatic' : 'Manual Approval Required'}
    `.trim();

    return this.sendMessage(message);
  }

  async sendSellConfirmation(amount, price, profit, autoApproval = false) {
    if (autoApproval) {
      return this.sendSellNotification(amount, price, profit, 'executed');
    }
    
    // Validate inputs
    if (typeof price !== 'number' || isNaN(price)) {
      console.error('❌ Invalid price for sell confirmation:', price);
      return;
    }
    
    const message = `
🚨 <b>SELL OPPORTUNITY DETECTED</b> 🚨

🪙 BTC Amount: ${amount} BTC
📈 Current Price: £${price.toLocaleString()}
💰 Estimated Value: £${(amount * price).toFixed(2)}
💹 Profit: £${profit.toFixed(2)}

<b>Would you like to proceed?</b>
Reply with /sell_yes or /sell_no
    `.trim();

    return this.sendMessage(message);
  }

  async sendSellNotification(amount, price, profit, status = 'executed') {
    // Validate inputs
    if (typeof price !== 'number' || isNaN(price)) {
      console.error('❌ Invalid price for sell notification:', price);
      return;
    }
    
    const emoji = status === 'executed' ? '✅' : '⏳';
    const statusText = status === 'executed' ? 'EXECUTED' : 'PENDING';
    
    const message = `
${emoji} <b>SELL ORDER ${statusText}</b> ${emoji}

🪙 BTC Amount: ${amount} BTC
📈 Price: £${price.toLocaleString()}
💰 GBP Received: £${(amount * price).toFixed(2)}
💹 Profit: £${profit.toFixed(2)}
⏰ Time: ${new Date().toLocaleString('en-GB')}
📊 Trade Type: ${status === 'executed' ? 'Automatic' : 'Manual Approval Required'}
    `.trim();

    return this.sendMessage(message);
  }

  async testConnection() {
    try {
      // First try to get bot info to validate token
      const botInfo = await this.getBotInfo();
      console.log(`✅ Bot info: ${botInfo.result.first_name} (@${botInfo.result.username})`);
      
      // Then try to send a test message
      const result = await this.sendMessage('🤖 Telegram bot connected successfully!\n\n✅ Ready to send trading alerts');
      console.log('✅ Telegram connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Telegram connection test failed:', error.message);
      return false;
    }
  }
  
  async getBotInfo() {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${this.botToken}/getMe`,
        method: 'GET',
      };

      const req = https.request(requestOptions, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            if (!responseData.startsWith('{')) {
              console.error('❌ Telegram getMe API returned non-JSON response:');
              console.error('Status Code:', res.statusCode);
              console.error('Response:', responseData.substring(0, 300) + '...');
              reject(new Error(`Telegram API returned HTML instead of JSON. Status: ${res.statusCode}`));
              return;
            }
            
            const result = JSON.parse(responseData);
            if (result.ok) {
              resolve(result);
            } else {
              reject(new Error(`Telegram API error: ${result.description || 'Unknown error'}`));
            }
          } catch (error) {
            console.error('❌ Failed to parse Telegram getMe response:', error.message);
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

module.exports = TelegramNotifier;