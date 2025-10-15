const http = require('http');

const data = JSON.stringify({
  emailOrPhone: 'test@example.com',  // can use either email or phone number
  password: 'Test123!@#'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log('Testing login...');

const req = http.request(options, res => {
  console.log(`Status Code: ${res.statusCode}`);
  let responseData = '';

  res.on('data', chunk => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const parsedData = JSON.parse(responseData);
      console.log('Response:', JSON.stringify(parsedData, null, 2));
      
      if (parsedData.data && parsedData.data.token) {
        console.log('\nAuthentication token received ✅');
        console.log('You can use this token for authenticated requests');
      }
    } catch (e) {
      console.log('Raw Response:', responseData);
    }
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.write(data);
req.end();