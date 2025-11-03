// BTC Price Fetcher from Coinbase API
const https = require('https');

/**
 * Fetches current BTC price from Coinbase API
 */
async function getBTCPrice() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.coinbase.com',
      port: 443,
      path: '/v2/exchange-rates?currency=BTC',
      method: 'GET',
      headers: {
        'User-Agent': 'auto-trading-app/1.0.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.data && response.data.rates && response.data.rates.GBP) {
            resolve({
              price: parseFloat(response.data.rates.GBP),
              currency: 'GBP',
              timestamp: new Date().toISOString(),
              source: 'Coinbase API'
            });
          } else {
            reject(new Error('Invalid response format from Coinbase API'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

/**
 * Alternative method using Coinbase Pro API for more detailed price info
 */
async function getBTCPriceDetailed() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.exchange.coinbase.com',
      port: 443,
      path: '/products/BTC-GBP/ticker',
      method: 'GET',
      headers: {
        'User-Agent': 'auto-trading-app/1.0.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.price) {
            resolve({
              price: parseFloat(response.price),
              bid: parseFloat(response.bid),
              ask: parseFloat(response.ask),
              volume: parseFloat(response.volume),
              timestamp: new Date().toISOString(),
              source: 'Coinbase Pro API'
            });
          } else {
            reject(new Error('Invalid response format from Coinbase Pro API'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

/**
 * Display BTC price with formatting
 */
function displayPrice(priceData) {
  console.log('\n🚀 ========================');
  console.log('📈 BTC PRICE UPDATE');
  console.log('========================');
  console.log(`💰 Current Price: £${priceData.price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  
  if (priceData.bid && priceData.ask) {
    console.log(`📊 Bid: £${priceData.bid.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`📊 Ask: £${priceData.ask.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`📊 Spread: £${(priceData.ask - priceData.bid).toFixed(2)}`);
  }
  
  if (priceData.volume) {
    console.log(`📈 24h Volume: ${priceData.volume.toLocaleString('en-US', { maximumFractionDigits: 2 })} BTC`);
  }
  
  console.log(`🕐 Timestamp: ${priceData.timestamp}`);
  console.log(`🔗 Source: ${priceData.source}`);
  console.log('========================\n');
}

/**
 * Main function to fetch and display BTC price
 */
async function main() {
  try {
    console.log('🔄 Fetching BTC price from Coinbase...');
    
    // Try detailed API first, fallback to simple API
    try {
      const priceData = await getBTCPriceDetailed();
      displayPrice(priceData);
    } catch (detailedError) {
      console.log('ℹ️ Detailed API unavailable, trying simple API...');
      const priceData = await getBTCPrice();
      displayPrice(priceData);
    }
    
  } catch (error) {
    console.error('❌ Error fetching BTC price:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

// Export functions for use in other modules
module.exports = {
  getBTCPrice,
  getBTCPriceDetailed,
  displayPrice
};