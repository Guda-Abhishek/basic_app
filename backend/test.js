const fetch = require('node-fetch');

const testRegistration = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fullName: 'John Doe',
        email: 'john@example.com',
        phoneNumber: '+1234567890',
        password: 'Test123!@#',
        confirmPassword: 'Test123!@#'
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
};

testRegistration();