const http = require('http');

// Use the token from the login response
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZWU5ZTlhMTI3ODJjN2Q3MDBlYThjYiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzYwNDY5MTc3LCJleHAiOjE3NjA0NzI3Nzd9.Y8A78JBL9xdiLlI_D7818Giw8N6p00t_JZKe8QLinBM';

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/me',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

console.log('Testing authenticated endpoint...');

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
    } catch (e) {
      console.log('Raw Response:', responseData);
    }
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.end();