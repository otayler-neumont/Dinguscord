const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const Redis = require('ioredis');

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
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const redis = new Redis(REDIS_URL);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    res.status(200).json({ 
      status: 'UP', 
      service: 'user-presence-service',
      redis: 'UP',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'DOWN', 
      service: 'user-presence-service',
      redis: 'DOWN',
      timestamp: new Date().toISOString()
    });
  }
});

// Set user presence via API
app.post('/presence', async (req, res) => {
  const { userId, status } = req.body;
  if (!userId || !status) {
    return res.status(400).json({ message: 'userId and status required' });
  }
  await redis.set(`presence:${userId}`, status);
  res.status(200).json({ userId, status });
});

// Get user presence via API
app.get('/presence/:userId', async (req, res) => {
  const { userId } = req.params;
  const status = await redis.get(`presence:${userId}`);
  if (status === null) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.status(200).json({ userId, status });
});

// Socket.IO connection for real-time presence
io.on('connection', (socket) => {
  console.log('User connected to presence service:', socket.id);
  let currentUserId = null;

  // Set user as online
  socket.on('user_online', async (userId) => {
    currentUserId = userId;
    console.log(`User ${userId} is online`);
    await redis.set(`presence:${userId}`, 'online');
    io.emit('presence_update', { userId, status: 'online' });
  });

  socket.on('user_offline', async (userId) => {
    console.log(`User ${userId} is offline`);
    await redis.set(`presence:${userId}`, 'offline');
    io.emit('presence_update', { userId, status: 'offline' });
  });

  socket.on('disconnect', async () => {
    if (currentUserId) {
      console.log('User disconnected from presence service:', socket.id);
      await redis.set(`presence:${currentUserId}`, 'offline');
      io.emit('presence_update', { userId: currentUserId, status: 'offline' });
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`User Presence Service running on port ${PORT}`);
});

module.exports = { app, server, io };