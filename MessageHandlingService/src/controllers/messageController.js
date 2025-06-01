const messageService = require('../services/messageService');
const socketService = require('../services/socketService');

class MessageController {
  // Create a new message
  async createMessage(req, res) {
    try {
      const { room_id, receiver_id, content, message_type } = req.body;
      
      // Validate required fields
      if (!content) {
        return res.status(400).json({
          success: false,
          message: 'Message content is required'
        });
      }
      
      // Either room_id or receiver_id must be provided
      if (!room_id && !receiver_id) {
        return res.status(400).json({
          success: false,
          message: 'Either room ID or receiver ID is required'
        });
      }
      
      // Get sender ID from authenticated user
      const sender_id = req.user.id;
      
      // Create message
      const message = await messageService.createMessage({
        sender_id,
        receiver_id,
        room_id,
        content,
        message_type
      });
      
      // Return success response
      return res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: message
      });
    } catch (error) {
      console.error('Error creating message:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to send message'
      });
    }
  }
  
  // Get messages for a room
  async getRoomMessages(req, res) {
    try {
      const { roomId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      
      // Validate room ID
      if (!roomId) {
        return res.status(400).json({
          success: false,
          message: 'Room ID is required'
        });
      }
      
      // Get messages
      const messages = await messageService.getRoomMessages(roomId, limit, offset);
      
      // Return success response
      return res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          limit,
          offset,
          total: messages.length // This is not the total count, just the count of returned messages
        }
      });
    } catch (error) {
      console.error('Error fetching room messages:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch messages'
      });
    }
  }
  
  // Get direct messages between two users
  async getDirectMessages(req, res) {
    try {
      const { userId } = req.params; // The other user
      const currentUserId = req.user.id; // The current user
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      
      // Validate user ID
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }
      
      // Get messages
      const messages = await messageService.getDirectMessages(currentUserId, userId, limit, offset);
      
      // Return success response
      return res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          limit,
          offset,
          total: messages.length
        }
      });
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch messages'
      });
    }
  }
  
  // Mark messages as delivered
  async markAsDelivered(req, res) {
    try {
      const { messageIds } = req.body;
      
      // Validate message IDs
      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Message IDs array is required'
        });
      }
      
      // Mark messages as delivered
      const updatedMessages = await messageService.markAsDelivered(messageIds);
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Messages marked as delivered',
        data: updatedMessages
      });
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark messages as delivered'
      });
    }
  }
  
  // Mark messages as read
  async markAsRead(req, res) {
    try {
      const { messageIds, roomId } = req.body;
      const userId = req.user.id;
      
      // Validate message IDs
      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Message IDs array is required'
        });
      }
      
      // Mark messages as read
      const updatedMessages = await messageService.markAsRead(messageIds, userId, roomId);
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Messages marked as read',
        data: updatedMessages
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark messages as read'
      });
    }
  }
  
  // Delete a message
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;
      
      // Validate message ID
      if (!messageId) {
        return res.status(400).json({
          success: false,
          message: 'Message ID is required'
        });
      }
      
      // Delete message
      const deletedMessage = await messageService.deleteMessage(messageId, userId);
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Message deleted successfully',
        data: deletedMessage
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      
      // Handle specific error cases
      if (error.message === 'Message not found') {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      } else if (error.message === 'Unauthorized to delete this message') {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own messages'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete message'
      });
    }
  }
  
  // Get unread count for a user in a room
  async getUnreadCount(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;
      
      // Validate room ID
      if (!roomId) {
        return res.status(400).json({
          success: false,
          message: 'Room ID is required'
        });
      }
      
      // Get unread count
      const count = await messageService.getUnreadCount(userId, roomId);
      
      // Return success response
      return res.status(200).json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get unread count'
      });
    }
  }
}

// Create singleton instance
const messageController = new MessageController();

module.exports = messageController; 