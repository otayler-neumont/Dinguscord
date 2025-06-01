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
        // Allow specific origins for better security
        origin: [
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          'http://127.0.0.1:5174',
          'http://127.0.0.1:3000'
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      // Allow both WebSocket and long-polling transports
      transports: ['websocket', 'polling'],
      // Configure connection timeout
      connectTimeout: 10000,
      // Ping interval to maintain connections
      pingInterval: 25000,
      pingTimeout: 20000
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
      
      // Handle connection errors
      socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
      });
      
      socket.on('connect_error', (error) => {
        console.error(`Connection error for ${socket.id}:`, error);
      });
      
      socket.on('connect_timeout', () => {
        console.error(`Connection timeout for ${socket.id}`);
      });
      
      // Authenticate user
      socket.on('authenticate', async ({ userId, token }) => {
        try {
          console.log(`Authentication attempt for user: ${userId}`);
          // For development, just accept any authentication attempt
          // In production, you would verify the token
          
          // Store user in our map
          this.users.set(userId, socket.id);
          socket.userId = userId;
          
          // Set user as online in Redis
          try {
            await redisService.setUserOnline(userId, socket.id);
          } catch (error) {
            console.error('Error setting user online in Redis:', error);
          }
          
          // Join user's own room (for direct messages)
          socket.join(`user:${userId}`);
          
          console.log(`User authenticated: ${userId}`);
          socket.emit('authenticated', { success: true, userId });
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
          console.log(`User ${socket.userId} attempting to join room: ${roomId}`);
          if (!socket.userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
          }
          
          // Join the room
          socket.join(`room:${roomId}`);
          
          // Add user to room in Redis
          try {
            await redisService.addUserToRoom(socket.userId, roomId);
          } catch (error) {
            console.error('Error adding user to room in Redis:', error);
          }
          
          // Get recent messages for this room
          let messages = [];
          try {
            const messageService = require('./messageService');
            messages = await messageService.getRoomMessages(roomId);
          } catch (error) {
            console.error('Error getting messages for room:', error);
            // Use mock messages for development
            messages = [
              { 
                id: '1',
                sender_id: 'System',
                content: `Welcome to the ${roomId} room!`,
                created_at: new Date().toISOString()
              }
            ];
          }
          
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
          try {
            await redisService.removeUserFromRoom(socket.userId, roomId);
          } catch (error) {
            console.error('Error removing user from room in Redis:', error);
          }
          
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
          let message;
          try {
            const messageService = require('./messageService');
            message = await messageService.createMessage(messageData);
          } catch (error) {
            console.error('Error creating message in database:', error);
            // Create a mock message for development
            message = {
              id: Math.random().toString(36).substring(2),
              sender_id: socket.userId,
              room_id: messageData.room_id,
              receiver_id: messageData.receiver_id,
              content: messageData.text || messageData.content,
              created_at: new Date().toISOString()
            };
          }
          
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
          try {
            await redisService.setUserTyping(socket.userId, roomId);
          } catch (error) {
            console.error('Error setting user typing in Redis:', error);
          }
          
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
          console.log(`Socket disconnected: ${socket.id}`);
          
          // If user was authenticated, remove them from users map
          if (socket.userId) {
            this.users.delete(socket.userId);
            
            // Set user as offline in Redis
            try {
              await redisService.setUserOffline(socket.userId);
            } catch (error) {
              console.error('Error setting user offline in Redis:', error);
            }
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