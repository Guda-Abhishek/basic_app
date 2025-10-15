const http = require('http');

// Function to make HTTP requests
const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n${options.method} ${options.path}`);
        console.log(`Status Code: ${res.statusCode}`);
        try {
          const parsedData = JSON.parse(responseData);
          console.log('Response:', JSON.stringify(parsedData, null, 2));
          if (parsedData.redirect) {
            console.log('Redirect URL:', parsedData.redirect);
          }
          resolve(parsedData);
        } catch (e) {
          console.log('Raw Response:', responseData);
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error:', error);
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

// Test registration redirection
const testRegistration = async () => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  const data = {
    fullName: 'Redirect Test User',
    email: 'redirect@example.com',
    phoneNumber: '+12345678901',
    password: 'Test123!@#',
    confirmPassword: 'Test123!@#'
  };

  console.log('\nTesting Registration Redirect...');
  await makeRequest(options, data);
};

// Test login redirection
const testLogin = async () => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  const data = {
    emailOrPhone: 'redirect@example.com',
    password: 'Test123!@#'
  };

  console.log('\nTesting Login Redirect...');
  await makeRequest(options, data);
};

// Test unauthorized access redirection
const testUnauthorized = async () => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/me',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };

  console.log('\nTesting Unauthorized Redirect...');
  await makeRequest(options);
};

// Run all tests
const runTests = async () => {
  try {
    await testRegistration();
    await testLogin();
    await testUnauthorized();
  } catch (error) {
    console.error('Test failed:', error);
  }
};

runTests();