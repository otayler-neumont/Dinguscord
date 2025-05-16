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
  // Here we would typically check database and queue connections as well
  res.status(200).json({ 
    status: 'UP', 
    service: 'message-handling-service',
    timestamp: new Date().toISOString()
  });
});

// Simple API routes - to be expanded
app.post('/messages', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.get('/messages/:roomId', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.put('/messages', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.delete('/messages/:messageId', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Message Handling Service running on port ${PORT}`);
});

module.exports = { app, server, io }; 