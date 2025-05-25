const express = require('express');
const messageController = require('../controllers/messageController');
const { authenticateToken, optionalAuth } = require('../utils/authMiddleware');

const router = express.Router();

// Create a new message
router.post('/', authenticateToken, messageController.createMessage);

// Get messages for a room
router.get('/room/:roomId', authenticateToken, messageController.getRoomMessages);

// Get direct messages between current user and another user
router.get('/direct/:userId', authenticateToken, messageController.getDirectMessages);

// Mark messages as delivered
router.put('/delivered', authenticateToken, messageController.markAsDelivered);

// Mark messages as read
router.put('/read', authenticateToken, messageController.markAsRead);

// Delete a message
router.delete('/:messageId', authenticateToken, messageController.deleteMessage);

// Get unread count for a room
router.get('/unread/:roomId', authenticateToken, messageController.getUnreadCount);

module.exports = router; 