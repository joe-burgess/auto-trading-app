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
      parse_mode: 'HTML',
      ...options
    };

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

  async sendBuyConfirmation(amount, price) {
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