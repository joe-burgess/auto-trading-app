#!/usr/bin/env node

const http = require('http');

// Test data
const paymentId = 'pay_1762190103612_ryqrjjb9i';
const postData = JSON.stringify({ paymentId });

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/sell-payment',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing sell payment API...');
console.log('📤 Selling payment:', paymentId);

const req = http.request(options, (res) => {
  console.log('📥 Response status:', res.statusCode);
  console.log('📥 Response headers:', res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📥 Response body:');
    try {
      const response = JSON.parse(data);
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(postData);
req.end();