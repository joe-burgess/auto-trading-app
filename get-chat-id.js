#!/usr/bin/env node

/**
 * Telegram Chat ID Helper
 * Helps you find your Telegram chat ID for bot configuration
 */

const https = require('https');

class TelegramChatIdHelper {
  constructor() {
    this.botToken = "8449588768:AAElq5DGe5us9gOJTy7sxaJLhbVnKWhYIqA";
  }

  /**
   * Get updates from Telegram to find chat ID
   */
  async getUpdates() {
    return new Promise((resolve, reject) => {
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates`;
      
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Extract chat IDs from updates
   */
  extractChatIds(updates) {
    const chatIds = new Set();
    
    if (updates.ok && updates.result) {
      updates.result.forEach(update => {
        if (update.message && update.message.chat) {
          chatIds.add({
            id: update.message.chat.id,
            type: update.message.chat.type,
            title: update.message.chat.title || `${update.message.chat.first_name || ''} ${update.message.chat.last_name || ''}`.trim(),
            username: update.message.chat.username
          });
        }
      });
    }
    
    return Array.from(chatIds);
  }

  /**
   * Main function to find and display chat IDs
   */
  async findChatIds() {
    console.log('🔍 Looking for your Telegram chat ID...\n');
    
    try {
      console.log('📡 Fetching recent messages from Telegram bot...');
      const updates = await this.getUpdates();
      
      if (!updates.ok) {
        console.error('❌ Telegram API error:', updates.description);
        return;
      }
      
      const chatIds = this.extractChatIds(updates);
      
      if (chatIds.length === 0) {
        console.log('📭 No recent messages found.');
        console.log('\n📱 To get your chat ID:');
        console.log('1. Open Telegram and search for your bot');
        console.log('2. Send any message to your bot (like "hello" or "/start")');
        console.log('3. Run this script again to see your chat ID');
        console.log('\n💡 Your bot username should be visible in @BotFather');
        return;
      }
      
      console.log(`\n✅ Found ${chatIds.length} chat(s):\n`);
      
      chatIds.forEach((chat, index) => {
        console.log(`Chat ${index + 1}:`);
        console.log(`   🆔 Chat ID: ${chat.id}`);
        console.log(`   👤 Name: ${chat.title || 'Private chat'}`);
        console.log(`   📱 Type: ${chat.type}`);
        if (chat.username) {
          console.log(`   🔗 Username: @${chat.username}`);
        }
        console.log('');
      });
      
      if (chatIds.length === 1) {
        const chatId = chatIds[0].id;
        console.log(`\n🎯 Use this chat ID: ${chatId}`);
        console.log('\n🔧 Would you like me to update the config automatically? (y/n)');
        
        // For now, just show the instruction
        console.log('\n📝 To update manually:');
        console.log(`   Edit config/telegram-config.json`);
        console.log(`   Change "chatId": "YOUR_CHAT_ID_HERE"`);
        console.log(`   To "chatId": "${chatId}"`);
      } else {
        console.log('📋 Multiple chats found. Choose the appropriate chat ID from above.');
        console.log('💡 Usually you want the private chat (type: "private") with your personal account.');
      }
      
    } catch (error) {
      console.error('❌ Error fetching chat ID:', error.message);
      
      if (error.message.includes('getaddrinfo')) {
        console.log('\n🌐 Network error. Please check your internet connection.');
      } else if (error.message.includes('401')) {
        console.log('\n🔑 Bot token appears to be invalid.');
      } else {
        console.log('\n💡 Make sure you have:');
        console.log('1. Created the bot with @BotFather');
        console.log('2. Sent at least one message to your bot');
        console.log('3. Have a working internet connection');
      }
    }
  }
}

// CLI Interface
async function main() {
  const helper = new TelegramChatIdHelper();
  await helper.findChatIds();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = TelegramChatIdHelper;