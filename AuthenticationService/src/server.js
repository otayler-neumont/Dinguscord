const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

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

// Simple API routes - to be expanded
app.post('/auth/login', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.post('/auth/register', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.post('/auth/password-reset', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

app.get('/auth/user/:id', (req, res) => {
  res.status(501).json({ message: 'Not implemented yet' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Authentication Service running on port ${PORT}`);
});

module.exports = app; 