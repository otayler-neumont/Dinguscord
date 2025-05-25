const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Set user info in request
    req.user = decoded;
    
    // Continue to next middleware
    next();
  } catch (error) {
    console.error('JWT verification error:', error);
    
    return res.status(403).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Middleware to handle optional authentication
// If token is present, verify it, but don't require it
const optionalAuth = (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    // No token, but that's ok for this route
    req.user = null;
    return next();
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Set user info in request
    req.user = decoded;
  } catch (error) {
    // Token is invalid, but we don't require it
    req.user = null;
  }
  
  // Continue to next middleware
  next();
};

module.exports = { authenticateToken, optionalAuth }; 