const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const roomModel = require('./models/roomModel');

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
  res.status(200).json({ 
    status: 'UP', 
    service: 'chatroom-service',
    timestamp: new Date().toISOString()
  });
});

// Create a new room
app.post('/rooms', async (req, res) => {
  try {
    const { name, userId, allowJoinExisting } = req.body;
    if (!name || !userId) {
      return res.status(400).json({ 
        success: false,
        message: 'name and userId required' 
      });
    }
    
    // Use the room name as the room ID for easier access
    const roomId = name;
    
    // Check if room already exists
    const existingRoom = await roomModel.getRoomById(roomId);
    
    if (existingRoom) {
      // If the same user is trying to create the room again, just add them to the room
      if (existingRoom.users.includes(userId)) {
        return res.status(200).json({
          success: true,
          message: 'You are already in this room',
          room: existingRoom,
          wasExisting: true
        });
      }
      
      // If a different user is trying to create a room with the same name
      if (allowJoinExisting === true) {
        // Explicitly allow joining existing room
        const updatedRoom = await roomModel.addUserToRoom(roomId, userId);
        return res.status(200).json({
          success: true,
          message: 'Added to existing room',
          room: updatedRoom,
          wasExisting: true
        });
      } else {
        // Don't automatically add to existing room - return error
        return res.status(409).json({
          success: false,
          message: `Room name '${name}' is already taken. Please choose a different name.`,
          error: 'ROOM_NAME_EXISTS'
        });
      }
    }
    
    // Create new room
    const newRoom = await roomModel.createRoom({
      id: roomId,
      name: name,
      userId: userId
    });
    
    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      room: newRoom,
      wasExisting: false
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all rooms for a user
app.get('/users/:userId/rooms', async (req, res) => {
  try {
    const { userId } = req.params;
    const userRooms = await roomModel.getUserRooms(userId);
    res.json(userRooms);
  } catch (error) {
    console.error('Error getting user rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get a specific room
app.get('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await roomModel.getRoomById(roomId);
    
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: 'Room not found' 
      });
    }
    
    res.json(room);
  } catch (error) {
    console.error('Error getting room:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add a user to a room
app.post('/rooms/:roomId/add/:userId', async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    
    // Check if room exists
    const room = await roomModel.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: 'Room not found' 
      });
    }
    
    // Add user to room
    const updatedRoom = await roomModel.addUserToRoom(roomId, userId);
    
    res.json({
      success: true,
      message: 'User added to room successfully',
      room: updatedRoom
    });
  } catch (error) {
    console.error('Error adding user to room:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Remove a user from a room (leave room)
app.post('/rooms/:roomId/leave/:userId', async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    
    // Check if room exists
    const room = await roomModel.getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ 
        success: false,
        message: 'Room not found' 
      });
    }
    
    // Remove user from room
    const updatedRoom = await roomModel.removeUserFromRoom(roomId, userId);
    
    res.json({ 
      success: true,
      message: 'Left room successfully', 
      room: updatedRoom 
    });
  } catch (error) {
    console.error('Error removing user from room:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete a room
app.delete('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const deletedRoom = await roomModel.deleteRoom(roomId);
    
    if (!deletedRoom) {
      return res.status(404).json({ 
        success: false,
        message: 'Room not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Room deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Chat Room Service running on port ${PORT}`);
});

module.exports = app;