const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

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
    service: 'chatroom-service',
    timestamp: new Date().toISOString()
  });
});

// Simple API routes - to be expanded
app.post('/rooms', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.delete('/rooms/:roomId', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.post('/rooms/:roomId/add/:userId', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.get('/rooms/:id', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Chat Room Service running on port ${PORT}`);
});

module.exports = app; 