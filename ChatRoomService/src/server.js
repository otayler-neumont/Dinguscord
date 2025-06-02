const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store for demo purposes
const rooms = {}; // { roomId: { id, name, users: [userId, ...] } }
const userRooms = {}; // { userId: Set(roomId, ...) }

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    service: 'chatroom-service',
    timestamp: new Date().toISOString()
  });
});

// Create a new room
app.post('/rooms', (req, res) => {
  const { name, userId } = req.body;
  if (!name || !userId) {
    return res.status(400).json({ message: 'name and userId required' });
  }
  const roomId = Math.random().toString(36).substr(2, 9);
  rooms[roomId] = { id: roomId, name, users: [userId] };
  if (!userRooms[userId]) userRooms[userId] = new Set();
  userRooms[userId].add(roomId);
  res.status(201).json(rooms[roomId]);
});

// Get all rooms for a user
app.get('/users/:userId/rooms', (req, res) => {
  const { userId } = req.params;
  const roomIds = userRooms[userId] ? Array.from(userRooms[userId]) : [];
  const userRoomList = roomIds.map(id => rooms[id]).filter(Boolean);
  res.json(userRoomList);
});

// Get a specific room
app.get('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: 'Room not found' });
  res.json(room);
});

// Add a user to a room
app.post('/rooms/:roomId/add/:userId', (req, res) => {
  const { roomId, userId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: 'Room not found' });
  if (!room.users.includes(userId)) {
    room.users.push(userId);
    if (!userRooms[userId]) userRooms[userId] = new Set();
    userRooms[userId].add(roomId);
  }
  res.json(room);
});

// Remove a user from a room (leave room)
app.post('/rooms/:roomId/leave/:userId', (req, res) => {
  const { roomId, userId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: 'Room not found' });
  room.users = room.users.filter(u => u !== userId);
  if (userRooms[userId]) userRooms[userId].delete(roomId);
  res.json({ message: 'Left room', room });
});

// Delete a room
app.delete('/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: 'Room not found' });
  // Remove room from all users' userRooms
  room.users.forEach(userId => {
    if (userRooms[userId]) userRooms[userId].delete(roomId);
  });
  delete rooms[roomId];
  res.json({ message: 'Room deleted' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Chat Room Service running on port ${PORT}`);
});

module.exports = app;