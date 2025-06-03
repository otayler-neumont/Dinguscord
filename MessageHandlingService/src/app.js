const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const winston = require('winston');
const messageRoutes = require('./routes/messageRoutes');
const socketService = require('./services/socketService');
const config = require('./config/config');
const redisService = require('./services/redisService');

// Load environment variables
require('dotenv').config();

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
socketService.initialize(server);

// Set up logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON requests

// Request logging middleware
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  next();
});

// API routes
app.use('/messages', messageRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    service: 'message-handling-service',
    timestamp: new Date().toISOString()
  });
});

// Heartbeat endpoint for presence tracking
app.post('/presence/heartbeat', async (req, res) => {
  try {
    // Extract user ID from JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const token = authHeader.substring(7);
    
    // For development, extract user ID from token payload (in production, verify the token)
    let userId;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userId = payload.sub || payload.id || payload.userId;
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in token'
      });
    }

    // Update user's last seen timestamp in Redis
    try {
      await redisService.updateUserHeartbeat(userId);
      
      res.status(200).json({
        success: true,
        message: 'Heartbeat recorded',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating user heartbeat:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record heartbeat'
      });
    }
  } catch (error) {
    console.error('Error in heartbeat endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Logout endpoint to immediately mark user as offline
app.post('/presence/logout', async (req, res) => {
  try {
    // Extract user ID from JWT token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const token = authHeader.substring(7);
    
    // For development, extract user ID from token payload (in production, verify the token)
    let userId;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      userId = payload.sub || payload.id || payload.userId;
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in token'
      });
    }

    // Immediately mark user as offline in Redis
    try {
      await redisService.markUserOfflineImmediately(userId);
      
      res.status(200).json({
        success: true,
        message: 'User marked as offline',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking user offline:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark user offline'
      });
    }
  } catch (error) {
    console.error('Error in logout endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get online status for multiple users (for friends list)
app.post('/presence/users', async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: 'userIds array is required'
      });
    }
    
    const onlineStatus = {};
    
    // Check online status for each user based on heartbeat timestamps
    for (const userId of userIds) {
      try {
        const isOnline = await redisService.isUserOnlineByHeartbeat(userId);
        onlineStatus[userId] = isOnline;
      } catch (error) {
        console.error(`Error checking online status for user ${userId}:`, error);
        onlineStatus[userId] = false;
      }
    }
    
    res.status(200).json({
      success: true,
      onlineStatus
    });
  } catch (error) {
    console.error('Error getting user presence:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Handle 404 - Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

module.exports = { app, server }; 