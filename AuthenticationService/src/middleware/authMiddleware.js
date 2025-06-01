const jwt = require('jsonwebtoken');
const config = require('../config/config');
const UserModel = require('../models/userModel');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }
    
    // Verify token
    jwt.verify(token, config.app.jwtSecret, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token',
          error: err.message
        });
      }
      
      // Check if user exists
      const user = await UserModel.getUserById(decoded.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Set user in request
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('Error authenticating token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  authenticateToken
}; 