const MessageModel = require('../models/messageModel');
const RedisService = require('./redisService');
const RabbitMQService = require('./rabbitmqService');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

class MessageService {
  constructor() {
    // Set up RabbitMQ consumer for the broadcast queue
    RabbitMQService.registerHandler(
      RabbitMQService.queues.messageBroadcast,
      this.handleIncomingBroadcast.bind(this)
    );
  }
  
  // Enrich messages with usernames
  async enrichMessagesWithUsernames(messages) {
    if (!messages || messages.length === 0) {
      return messages;
    }

    try {
      // Get unique sender IDs
      const senderIds = [...new Set(messages.map(msg => msg.sender_id))];
      
      // Fetch usernames for all unique senders
      const usernames = {};
      for (const senderId of senderIds) {
        try {
          const response = await fetch(`http://dinguscord-authentication-service-1:3000/auth/users/${senderId}`);
          if (response.ok) {
            const user = await response.json();
            usernames[senderId] = user.username;
          } else {
            console.warn(`Failed to fetch username for user ${senderId}`);
            usernames[senderId] = `User${senderId}`;
          }
        } catch (error) {
          console.error(`Error fetching username for user ${senderId}:`, error);
          usernames[senderId] = `User${senderId}`;
        }
      }

      // Enrich messages with usernames
      return messages.map(message => ({
        ...message,
        username: usernames[message.sender_id] || `User${message.sender_id}`
      }));
    } catch (error) {
      console.error('Error enriching messages with usernames:', error);
      return messages.map(message => ({
        ...message,
        username: `User${message.sender_id}`
      }));
    }
  }

  // Process incoming message broadcast from other services
  async handleIncomingBroadcast(message, routingKey) {
    console.log(`Received broadcast message with routing key: ${routingKey}`, message);
    
    // Handle different types of broadcasts based on routing key
    switch (routingKey) {
      case 'message.delivered':
        // Mark messages as delivered
        if (message.messageIds && Array.isArray(message.messageIds)) {
          await MessageModel.markAsDelivered(message.messageIds);
        }
        break;
        
      case 'message.read':
        // Mark messages as read
        if (message.messageIds && Array.isArray(message.messageIds)) {
          await MessageModel.markAsRead(message.messageIds);
        }
        break;
        
      case 'message.deleted':
        // Handle message deletion
        if (message.messageId) {
          await MessageModel.deleteMessage(message.messageId);
        }
        break;
        
      default:
        console.log(`Unhandled routing key: ${routingKey}`);
    }
  }
  
  // Create and send a new message
  async createMessage(messageData) {
    try {
      // Validate required fields
      if (!messageData.sender_id) {
        throw new Error('Sender ID is required');
      }
      
      if (!messageData.content) {
        throw new Error('Message content is required');
      }
      
      // Either room_id or receiver_id must be present
      if (!messageData.room_id && !messageData.receiver_id) {
        throw new Error('Either room ID or receiver ID is required');
      }
      
      // Save message to database
      const savedMessage = await MessageModel.createMessage(messageData);
      
      // Enrich with username
      const enrichedMessages = await this.enrichMessagesWithUsernames([savedMessage]);
      const enrichedMessage = enrichedMessages[0];
      
      // Cache message in Redis
      await RedisService.cacheMessage(enrichedMessage);
      
      // Determine the routing key based on message type
      let routingKey = 'message.sent';
      if (messageData.room_id) {
        routingKey = 'message.room.sent';
      } else if (messageData.receiver_id) {
        routingKey = 'message.direct.sent';
      }
      
      // Publish message to RabbitMQ for other services
      await RabbitMQService.publishMessage(routingKey, {
        message: enrichedMessage,
        timestamp: new Date().toISOString()
      });
      
      // If the message is for a room, increment unread count for all users except sender
      if (messageData.room_id) {
        const roomUsers = await RedisService.getRoomUsers(messageData.room_id);
        
        for (const userId of roomUsers) {
          if (userId !== messageData.sender_id) {
            await RedisService.incrementUnreadCount(userId, messageData.room_id);
          }
        }
      } else if (messageData.receiver_id) {
        // For direct messages, increment unread count for the receiver
        await RedisService.incrementUnreadCount(
          messageData.receiver_id,
          `direct:${messageData.sender_id}`
        );
      }
      
      // Publish notification event for the notification service
      await RabbitMQService.publishMessage('notification.message.new', {
        message: enrichedMessage,
        timestamp: new Date().toISOString()
      });
      
      return enrichedMessage;
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }
  
  // Get messages for a room
  async getRoomMessages(roomId, limit = 50, offset = 0) {
    try {
      // Try to get messages from Redis cache first
      const cachedMessages = await RedisService.getRoomMessages(roomId, limit);
      
      if (cachedMessages && cachedMessages.length >= limit) {
        console.log(`Returning ${cachedMessages.length} cached messages for room ${roomId}`);
        // Enrich cached messages with usernames
        return await this.enrichMessagesWithUsernames(cachedMessages);
      }
      
      // If cache miss or not enough messages in cache, get from database
      console.log(`Cache miss for room ${roomId}, fetching from database`);
      const messages = await MessageModel.getRoomMessages(roomId, limit, offset);
      
      // Enrich messages with usernames
      const enrichedMessages = await this.enrichMessagesWithUsernames(messages);
      
      // Cache these messages for future requests
      for (const message of enrichedMessages) {
        await RedisService.cacheMessage(message);
      }
      
      return enrichedMessages;
    } catch (error) {
      console.error('Error fetching room messages:', error);
      throw error;
    }
  }
  
  // Get direct messages between two users
  async getDirectMessages(userId1, userId2, limit = 50, offset = 0) {
    try {
      // Get from database
      const messages = await MessageModel.getDirectMessages(userId1, userId2, limit, offset);
      
      // Enrich messages with usernames
      const enrichedMessages = await this.enrichMessagesWithUsernames(messages);
      
      // Cache these messages for future requests
      for (const message of enrichedMessages) {
        await RedisService.cacheMessage(message);
      }
      
      return enrichedMessages;
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      throw error;
    }
  }
  
  // Mark messages as delivered
  async markAsDelivered(messageIds) {
    try {
      // Update in database
      const updatedMessages = await MessageModel.markAsDelivered(messageIds);
      
      // Publish event to RabbitMQ
      await RabbitMQService.publishMessage('message.delivered', {
        messageIds,
        timestamp: new Date().toISOString()
      });
      
      return updatedMessages;
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
      throw error;
    }
  }
  
  // Mark messages as read
  async markAsRead(messageIds, userId, roomId) {
    try {
      // Update in database
      const updatedMessages = await MessageModel.markAsRead(messageIds);
      
      // Publish event to RabbitMQ
      await RabbitMQService.publishMessage('message.read', {
        messageIds,
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Reset unread count in Redis
      if (roomId) {
        await RedisService.resetUnreadCount(userId, roomId);
      }
      
      return updatedMessages;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }
  
  // Delete a message
  async deleteMessage(messageId, userId) {
    try {
      // Get the message first to check permissions
      const message = await MessageModel.getById(messageId);
      
      if (!message) {
        throw new Error('Message not found');
      }
      
      // Check if user is the sender (only sender can delete their message)
      if (message.sender_id !== userId) {
        throw new Error('Unauthorized to delete this message');
      }
      
      // Delete from database
      const deletedMessage = await MessageModel.deleteMessage(messageId);
      
      // Publish event to RabbitMQ
      await RabbitMQService.publishMessage('message.deleted', {
        messageId,
        userId,
        timestamp: new Date().toISOString()
      });
      
      return deletedMessage;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }
  
  // Get unread count for a user in a room
  async getUnreadCount(userId, roomId) {
    try {
      return await RedisService.getUnreadCount(userId, roomId);
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }
  
  // Set user typing status
  async setUserTyping(userId, roomId) {
    try {
      await RedisService.setUserTyping(userId, roomId);
      
      // Publish typing event to RabbitMQ for other services
      await RabbitMQService.publishMessage('message.typing', {
        userId,
        roomId,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error('Error setting typing status:', error);
      return false;
    }
  }
  
  // Get typing users in a room
  async getTypingUsers(roomId) {
    try {
      return await RedisService.getTypingUsers(roomId);
    } catch (error) {
      console.error('Error getting typing users:', error);
      return [];
    }
  }
}

// Create a singleton instance
const messageService = new MessageService();

module.exports = messageService; 