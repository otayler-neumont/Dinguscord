const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const messageService = require('./messageService');
const redisService = require('./redisService');
const config = require('../config/config');

class SocketService {
  constructor() {
    this.io = null;
    this.users = new Map(); // Map of userId -> socketId
  }
  
  // Initialize Socket.IO server
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    // Set up Redis adapter for horizontal scaling
    this.setupRedisAdapter();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    console.log('Socket.IO initialized');
  }
  
  // Set up Redis adapter for horizontal scaling
  async setupRedisAdapter() {
    try {
      const pubClient = createClient({
        url: `redis://${config.redis.host}:${config.redis.port}`
      });
      const subClient = pubClient.duplicate();
      
      await Promise.all([pubClient.connect(), subClient.connect()]);
      
      this.io.adapter(createAdapter(pubClient, subClient));
      console.log('Redis adapter for Socket.IO initialized');
    } catch (error) {
      console.error('Failed to set up Redis adapter:', error);
    }
  }
  
  // Set up Socket.IO event handlers
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      
      // Authenticate user
      socket.on('authenticate', async ({ userId, token }) => {
        try {
          // TODO: Implement actual token verification
          
          // Store user in our map
          this.users.set(userId, socket.id);
          socket.userId = userId;
          
          // Set user as online in Redis
          await redisService.setUserOnline(userId, socket.id);
          
          // Join user's own room (for direct messages)
          socket.join(`user:${userId}`);
          
          console.log(`User authenticated: ${userId}`);
          socket.emit('authenticated', { success: true });
        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('authenticated', { 
            success: false, 
            error: 'Authentication failed' 
          });
        }
      });
      
      // Handle joining a room
      socket.on('join_room', async ({ roomId }) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }
          
          // Join the room
          socket.join(`room:${roomId}`);
          
          // Add user to room in Redis
          await redisService.addUserToRoom(socket.userId, roomId);
          
          // Get recent messages for this room
          const messages = await messageService.getRoomMessages(roomId);
          
          // Send room info to the user
          socket.emit('room_joined', { 
            roomId,
            messages,
            success: true 
          });
          
          // Notify other users in the room
          socket.to(`room:${roomId}`).emit('user_joined', {
            userId: socket.userId,
            roomId
          });
          
          console.log(`User ${socket.userId} joined room ${roomId}`);
        } catch (error) {
          console.error('Error joining room:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });
      
      // Handle leaving a room
      socket.on('leave_room', async ({ roomId }) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }
          
          // Leave the room
          socket.leave(`room:${roomId}`);
          
          // Remove user from room in Redis
          await redisService.removeUserFromRoom(socket.userId, roomId);
          
          // Notify other users in the room
          socket.to(`room:${roomId}`).emit('user_left', {
            userId: socket.userId,
            roomId
          });
          
          console.log(`User ${socket.userId} left room ${roomId}`);
          socket.emit('room_left', { roomId, success: true });
        } catch (error) {
          console.error('Error leaving room:', error);
          socket.emit('error', { message: 'Failed to leave room' });
        }
      });
      
      // Handle sending a message
      socket.on('send_message', async (messageData, callback) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }
          
          // Set sender ID from socket
          messageData.sender_id = socket.userId;
          
          // Create the message
          const message = await messageService.createMessage(messageData);
          
          // Determine where to emit the message
          if (message.room_id) {
            // Emit to the room
            this.io.to(`room:${message.room_id}`).emit('new_message', message);
          } else if (message.receiver_id) {
            // Direct message - emit to both sender and receiver
            this.io.to(`user:${message.sender_id}`).to(`user:${message.receiver_id}`).emit('new_message', message);
          }
          
          // Callback with the created message
          if (callback) {
            callback({ success: true, message });
          }
        } catch (error) {
          console.error('Error sending message:', error);
          if (callback) {
            callback({ success: false, error: error.message });
          } else {
            socket.emit('error', { message: 'Failed to send message' });
          }
        }
      });
      
      // Handle typing indicators
      socket.on('typing', async ({ roomId }) => {
        try {
          if (!socket.userId || !roomId) return;
          
          // Set user as typing in Redis
          await messageService.setUserTyping(socket.userId, roomId);
          
          // Broadcast to room
          socket.to(`room:${roomId}`).emit('user_typing', {
            userId: socket.userId,
            roomId
          });
        } catch (error) {
          console.error('Error with typing indicator:', error);
        }
      });
      
      // Handle marking messages as read
      socket.on('mark_read', async ({ messageIds, roomId }) => {
        try {
          if (!socket.userId || !messageIds || !Array.isArray(messageIds)) {
            socket.emit('error', { message: 'Invalid parameters' });
            return;
          }
          
          // Mark messages as read
          await messageService.markAsRead(messageIds, socket.userId, roomId);
          
          // Emit event to notify other users
          if (roomId) {
            socket.to(`room:${roomId}`).emit('messages_read', {
              userId: socket.userId,
              messageIds,
              roomId
            });
          }
          
          socket.emit('marked_read', { success: true, messageIds });
        } catch (error) {
          console.error('Error marking messages as read:', error);
          socket.emit('error', { message: 'Failed to mark messages as read' });
        }
      });
      
      // Handle message deletion
      socket.on('delete_message', async ({ messageId, roomId }, callback) => {
        try {
          if (!socket.userId || !messageId) {
            socket.emit('error', { message: 'Invalid parameters' });
            return;
          }
          
          // Delete the message
          const deletedMessage = await messageService.deleteMessage(messageId, socket.userId);
          
          // Notify room or direct message participants
          if (roomId) {
            this.io.to(`room:${roomId}`).emit('message_deleted', {
              messageId,
              roomId
            });
          } else if (deletedMessage && deletedMessage.receiver_id) {
            this.io.to(`user:${deletedMessage.sender_id}`)
              .to(`user:${deletedMessage.receiver_id}`)
              .emit('message_deleted', { messageId });
          }
          
          if (callback) {
            callback({ success: true });
          }
        } catch (error) {
          console.error('Error deleting message:', error);
          if (callback) {
            callback({ success: false, error: error.message });
          } else {
            socket.emit('error', { message: error.message });
          }
        }
      });
      
      // Handle getting typing users
      socket.on('get_typing_users', async ({ roomId }, callback) => {
        try {
          if (!roomId) return;
          
          const typingUsers = await messageService.getTypingUsers(roomId);
          
          if (callback) {
            callback({ success: true, typingUsers });
          }
        } catch (error) {
          console.error('Error getting typing users:', error);
          if (callback) {
            callback({ success: false, error: error.message });
          }
        }
      });
      
      // Handle disconnection
      socket.on('disconnect', async () => {
        try {
          if (socket.userId) {
            // Remove from our map
            this.users.delete(socket.userId);
            
            // Set as offline in Redis
            await redisService.setUserOffline(socket.userId);
            
            console.log(`User disconnected: ${socket.userId}`);
          }
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });
    });
  }
  
  // Emit an event to a specific user
  emitToUser(userId, event, data) {
    const socketId = this.users.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }
  
  // Emit an event to a room
  emitToRoom(roomId, event, data) {
    this.io.to(`room:${roomId}`).emit(event, data);
    return true;
  }
  
  // Emit an event to all connected clients
  emitToAll(event, data) {
    this.io.emit(event, data);
    return true;
  }
}

// Create singleton instance
const socketService = new SocketService();

module.exports = socketService; 