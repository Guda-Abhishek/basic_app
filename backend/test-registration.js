const http = require('http');

const data = JSON.stringify({
  fullName: 'Test User',
  email: 'test@example.com',
  phoneNumber: '+12345678900',  // Updated to match E.164 format (+[country code][number])
  password: 'Test123!@#',
  confirmPassword: 'Test123!@#'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, res => {
  console.log(`Status Code: ${res.statusCode}`);
  let responseData = '';

  res.on('data', chunk => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.write(data);
req.end();