const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Import controllers and middleware
const authController = require('./controllers/authController');
const authMiddleware = require('./middleware/authMiddleware');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  // Here we would typically check database connection as well
  res.status(200).json({ 
    status: 'UP', 
    service: 'authentication-service',
    timestamp: new Date().toISOString()
  });
});

// Auth routes
app.post('/auth/register', authController.register);
app.post('/auth/login', authController.login);
app.get('/auth/verify', authMiddleware.authenticateToken, authController.verifyToken);

// User routes (protected)
app.get('/auth/profile', authMiddleware.authenticateToken, authController.getProfile);
app.put('/auth/profile', authMiddleware.authenticateToken, authController.updateProfile);
app.post('/auth/password', authMiddleware.authenticateToken, authController.changePassword);

// Search users (protected)
app.get('/auth/users/search', authMiddleware.authenticateToken, authController.searchUsers);

// Get user info by ID (internal service endpoint)
app.get('/auth/users/:userId', authController.getUserById);

// Password reset (public)
app.post('/auth/password-reset', (req, res) => {
  // To be implemented
  res.status(501).json({ message: 'Not implemented yet' });
});

// Get user by ID (can be used by other services)
app.get('/auth/user/:id', (req, res) => {
  // To be implemented
  res.status(501).json({ message: 'Not implemented yet' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Authentication Service running on port ${PORT}`);
});

module.exports = app; 