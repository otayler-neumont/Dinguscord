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
  // Here we would typically check Redis connection as well
  res.status(200).json({ 
    status: 'UP', 
    service: 'user-presence-service',
    timestamp: new Date().toISOString()
  });
});

// Simple API routes - to be expanded
app.post('/presence', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.get('/presence/:userId', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// Socket.IO connection for real-time presence
io.on('connection', (socket) => {
  console.log('User connected to presence service:', socket.id);
  
  // Set user as online
  socket.on('user_online', (userId) => {
    console.log(`User ${userId} is online`);
    // Here we would update Redis with user's online status
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from presence service:', socket.id);
    // Here we would update Redis with user's offline status
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`User Presence Service running on port ${PORT}`);
});

module.exports = { app, server, io }; 