const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Service routes
const services = {
  '/auth': process.env.AUTH_SERVICE_URL || 'http://authentication-service:3000',
  '/rooms': process.env.CHATROOM_SERVICE_URL || 'http://chat-room-service:3000',
  '/messages': process.env.MESSAGE_SERVICE_URL || 'http://message-handling-service:3000',
  '/presence': process.env.PRESENCE_SERVICE_URL || 'http://user-presence-service:3000',
  '/notify': process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3000'
};

// Setup proxy routes
Object.entries(services).forEach(([path, target]) => {
  app.use(path, createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: {
      [`^${path}`]: ''
    }
  }));
});

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

module.exports = app; 