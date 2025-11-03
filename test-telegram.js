#!/usr/bin/env node

const TelegramNotifier = require('./telegram-notifier');
const fs = require('fs');
const path = require('path');

async function testTelegram() {
  try {
    console.log('🧪 Testing Telegram connection...\n');
    
    // Load config
    const configPath = path.join(__dirname, 'config', 'telegram-config.json');
    if (!fs.existsSync(configPath)) {
      console.error('❌ Telegram config file not found');
      return;
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`🔑 Bot Token: ${config.botToken.substring(0, 10)}...`);
    console.log(`💬 Chat ID: ${config.chatId}\n`);
    
    // Create notifier
    const notifier = new TelegramNotifier(config.botToken, config.chatId);
    
    // Test connection
    console.log('📡 Testing bot info...');
    const botInfo = await notifier.getBotInfo();
    console.log(`✅ Bot: ${botInfo.result.first_name} (@${botInfo.result.username})\n`);
    
    console.log('📨 Sending test message...');
    await notifier.sendMessage('🧪 Test message from auto-trading bot');
    console.log('✅ Test message sent successfully!\n');
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.message.includes('HTML')) {
      console.error('\n💡 This suggests the bot token might be invalid or there\'s an API issue.');
      console.error('💡 Try regenerating the bot token with @BotFather on Telegram.');
    }
  }
}

// Run test
testTelegram();