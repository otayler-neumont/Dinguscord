const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  // Here we would typically check RabbitMQ connection as well
  res.status(200).json({ 
    status: 'UP', 
    service: 'notification-service',
    timestamp: new Date().toISOString()
  });
});

// Simple API routes - to be expanded
app.post('/notify', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// Socket.IO connection for real-time notifications
io.on('connection', (socket) => {
  console.log('Client connected to notification service:', socket.id);

  // Subscribe to notifications for a specific user
  socket.on('subscribe', (userId) => {
    console.log(`Client ${socket.id} subscribed to notifications for user ${userId}`);
    socket.join(`user:${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from notification service:', socket.id);
  });
});

// RabbitMQ consumer would be implemented here to process notifications

// Start server
server.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
});

module.exports = { app, server, io }; 