const http = require('http');

// Function to make a POST request
function makePostRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data))
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`Response Status: ${res.statusCode}`);
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Request error: ${error.message}`);
      reject(error);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

// Test registration
async function testRegistration() {
  console.log('Testing registration...');
  try {
    const userData = {
      username: `testuser_${Math.floor(Math.random() * 10000)}`,
      email: `test_${Math.floor(Math.random() * 10000)}@example.com`,
      password: 'password123',
      display_name: 'Test User'
    };

    console.log('User data:', userData);
    
    const response = await makePostRequest('/auth/register', userData);
    console.log('Registration response:', response);
    
    return response;
  } catch (error) {
    console.error('Registration test failed:', error);
  }
}

// Test login
async function testLogin(email, password) {
  console.log('Testing login...');
  try {
    const loginData = {
      email: email || 'test@example.com',
      password: password || 'password123'
    };

    console.log('Login data:', loginData);
    
    const response = await makePostRequest('/auth/login', loginData);
    console.log('Login response:', response);
    
    return response;
  } catch (error) {
    console.error('Login test failed:', error);
  }
}

// Run tests
async function runTests() {
  try {
    // Test registration
    const regResponse = await testRegistration();
    
    if (regResponse && regResponse.success) {
      // Test login with the registered user
      await testLogin(regResponse.user.email, 'password123');
    } else {
      // Test login with default credentials
      await testLogin();
    }
  } catch (error) {
    console.error('Tests failed:', error);
  }
}

// Run the tests
runTests(); 