#!/usr/bin/env node

const https = require('https');

class TelegramNotifier {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
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
            const result = JSON.parse(responseData);
            if (result.ok) {
              resolve(result);
            } else {
              reject(new Error(`Telegram API error: ${result.description}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async sendPriceAlert(price, threshold, type = 'drop') {
    const emoji = type === 'drop' ? '📉' : '📈';
    const direction = type === 'drop' ? 'below' : 'above';
    
    const message = `
🚨 <b>BTC PRICE ALERT</b> 🚨

${emoji} <b>Price ${direction} threshold!</b>
💰 Current Price: £${price.toLocaleString()}
🎯 Alert Threshold: £${threshold.toLocaleString()}
⏰ Time: ${new Date().toLocaleString('en-GB')}

${type === 'drop' ? '💡 This might be a buying opportunity!' : '💡 Consider taking profits!'}
    `.trim();

    return this.sendMessage(message);
  }

  async sendBuyConfirmation(amount, price, autoApproval = false) {
    if (autoApproval) {
      return this.sendBuyNotification(amount, price, 'executed');
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
      const result = await this.sendMessage('🤖 Telegram bot connected successfully!\n\n✅ Ready to send trading alerts');
      console.log('✅ Telegram connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Telegram connection test failed:', error.message);
      return false;
    }
  }
}

module.exports = TelegramNotifier;