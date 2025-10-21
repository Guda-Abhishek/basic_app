const fs = require('fs');
const path = require('path');
const http = require('http');

// First, register a user
const registerUser = async () => {
  return new Promise((resolve, reject) => {
    const randomNum = Math.floor(Math.random() * 10000);
    const data = JSON.stringify({
      fullName: `TestUser${randomNum}`,
      email: `test${randomNum}@example.com`,
      phoneNumber: `98765432${randomNum.toString().padStart(2, '0').slice(-2)}`,
      password: 'Test123!@#',
      confirmPassword: 'Test123!@#'
    });

    console.log('Registering with:', JSON.parse(data));

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
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        console.log('Registration raw response:', responseData);
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          console.log('Failed to parse JSON, returning raw response');
          resolve({ status: 'error', raw: responseData, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

// Login to get token
const loginUser = async (email) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      emailOrPhone: email,
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

    const req = http.request(options, res => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        console.log('Login raw response:', responseData);
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          console.log('Failed to parse JSON, returning raw response');
          resolve({ status: 'error', raw: responseData, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

// Test file upload
const testFileUpload = async (token) => {
  return new Promise((resolve, reject) => {
    // Create a simple test file
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    const testContent = 'This is a test file for upload functionality.\nLine 2\nLine 3';

    fs.writeFileSync(testFilePath, testContent);

    // Read file for upload
    const fileBuffer = fs.readFileSync(testFilePath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16);

    const postData = [
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="file"; filename="test-upload.txt"\r\n',
      'Content-Type: text/plain\r\n\r\n',
      fileBuffer,
      `\r\n--${boundary}--\r\n`
    ];

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/files/upload',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(Buffer.concat(postData.map(Buffer.from)))
      }
    };

    const req = http.request(options, res => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        // Clean up test file
        fs.unlinkSync(testFilePath);

        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);

    // Write multipart data
    postData.forEach(part => {
      if (Buffer.isBuffer(part)) {
        req.write(part);
      } else {
        req.write(Buffer.from(part));
      }
    });

    req.end();
  });
};

// Test guest upload
const testGuestUpload = async () => {
  return new Promise((resolve, reject) => {
    // Create a simple test CSV file
    const testFilePath = path.join(__dirname, 'test-guest-upload.csv');
    const testContent = 'name,age,city\nJohn,25,New York\nJane,30,London\nBob,35,Paris';

    fs.writeFileSync(testFilePath, testContent);

    // Read file for upload
    const fileBuffer = fs.readFileSync(testFilePath);
    const boundary = '----WebKitFormBoundary' + Math.random().toString(16);

    const postData = [
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="file"; filename="test-guest-upload.csv"\r\n',
      'Content-Type: text/csv\r\n\r\n',
      fileBuffer,
      `\r\n--${boundary}--\r\n`
    ];

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/files/upload-guest',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(Buffer.concat(postData.map(Buffer.from)))
      }
    };

    const req = http.request(options, res => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        // Clean up test file
        fs.unlinkSync(testFilePath);

        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);

    // Write multipart data
    postData.forEach(part => {
      if (Buffer.isBuffer(part)) {
        req.write(part);
      } else {
        req.write(Buffer.from(part));
      }
    });

    req.end();
  });
};

// Main test function
const runTests = async () => {
  try {
    console.log('🚀 Starting guest upload functionality tests...\n');

    // Test guest upload
    console.log('1. Testing guest file upload...');
    const uploadResult = await testGuestUpload();
    console.log('Upload Status Code:', uploadResult.status);
    console.log('Upload Response:', uploadResult.data);

    if (uploadResult.status === 201 && uploadResult.data.status === 'success') {
      console.log('✅ Guest file upload successful!');
      console.log('File details:', uploadResult.data.data.file);

      // Check if file exists on server
      console.log('\n2. Checking if file exists on server...');
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, 'uploads', 'guests', uploadResult.data.data.file.id + '.csv');
      if (fs.existsSync(filePath)) {
        console.log('✅ File exists on server at:', filePath);
      } else {
        console.log('❌ File not found on server');
      }

      // Check if file exists in database
      console.log('\n3. Checking database for uploaded files...');
      // This would require additional API call to list files

    } else {
      console.log('❌ Guest file upload failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

runTests();
