const { createClient } = require('redis');
const config = require('../config/config');

// Create Redis client
const redisClient = createClient({
  url: `redis://${config.redis.host}:${config.redis.port}`
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Redis connection error:', err);
  }
})();

// Handle Redis errors
redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Set default key expiration time (in seconds)
const DEFAULT_EXPIRATION = 3600; // 1 hour

const RedisService = {
  // Cache a message in Redis
  async cacheMessage(message) {
    try {
      // Store message in a hash
      await redisClient.hSet(`message:${message.id}`, message);
      
      // Add message to room's recent messages list (sorted set by timestamp)
      if (message.room_id) {
        const score = new Date(message.created_at).getTime();
        await redisClient.zAdd(`room:${message.room_id}:messages`, {
          score,
          value: message.id
        });
        
        // Keep only the 100 most recent messages in the sorted set
        await redisClient.zRemRangeByRank(`room:${message.room_id}:messages`, 0, -101);
      }
      
      // If it's a direct message, add to user conversation lists
      if (message.receiver_id && !message.room_id) {
        const conversationKey1 = `user:${message.sender_id}:conversations`;
        const conversationKey2 = `user:${message.receiver_id}:conversations`;
        const score = new Date(message.created_at).getTime();
        
        await redisClient.zAdd(conversationKey1, {
          score,
          value: message.receiver_id
        });
        
        await redisClient.zAdd(conversationKey2, {
          score,
          value: message.sender_id
        });
        
        // Store the latest message between these users
        const conversationId = [message.sender_id, message.receiver_id].sort().join(':');
        await redisClient.set(
          `conversation:${conversationId}:latestMessage`,
          JSON.stringify(message),
          { EX: DEFAULT_EXPIRATION }
        );
      }
      
      return true;
    } catch (error) {
      console.error('Redis cache error:', error);
      return false;
    }
  },
  
  // Get cached messages for a room
  async getRoomMessages(roomId, limit = 50) {
    try {
      // Get the message IDs from the sorted set (newest first)
      const messageIds = await redisClient.zRange(
        `room:${roomId}:messages`,
        0,
        limit - 1,
        { REV: true }
      );
      
      if (!messageIds.length) return [];
      
      // Get all messages in parallel
      const messagePromises = messageIds.map(id => 
        redisClient.hGetAll(`message:${id}`)
      );
      
      const messages = await Promise.all(messagePromises);
      return messages.filter(Boolean); // Remove any null values
    } catch (error) {
      console.error('Redis get room messages error:', error);
      return [];
    }
  },
  
  // Track user presence (online status)
  async setUserOnline(userId, socketId) {
    try {
      // Add user to online users set with their socket ID
      await redisClient.hSet('online_users', userId, socketId);
      
      // Set a timestamp for when they came online
      await redisClient.hSet(`user:${userId}`, 'last_active', Date.now());
      await redisClient.hSet(`user:${userId}`, 'status', 'online');
      
      return true;
    } catch (error) {
      console.error('Redis set user online error:', error);
      return false;
    }
  },
  
  // Remove user from online status when they disconnect
  async setUserOffline(userId) {
    try {
      // Remove user from online users set
      await redisClient.hDel('online_users', userId);
      
      // Update their last active timestamp
      await redisClient.hSet(`user:${userId}`, 'last_active', Date.now());
      await redisClient.hSet(`user:${userId}`, 'status', 'offline');
      
      return true;
    } catch (error) {
      console.error('Redis set user offline error:', error);
      return false;
    }
  },
  
  // Check if a user is online
  async isUserOnline(userId) {
    try {
      return await redisClient.hExists('online_users', userId);
    } catch (error) {
      console.error('Redis check user online error:', error);
      return false;
    }
  },
  
  // Get a user's socket ID
  async getUserSocket(userId) {
    try {
      return await redisClient.hGet('online_users', userId);
    } catch (error) {
      console.error('Redis get user socket error:', error);
      return null;
    }
  },
  
  // Get all users in a room
  async getRoomUsers(roomId) {
    try {
      return await redisClient.sMembers(`room:${roomId}:users`);
    } catch (error) {
      console.error('Redis get room users error:', error);
      return [];
    }
  },
  
  // Add a user to a room
  async addUserToRoom(userId, roomId) {
    try {
      await redisClient.sAdd(`room:${roomId}:users`, userId);
      await redisClient.sAdd(`user:${userId}:rooms`, roomId);
      return true;
    } catch (error) {
      console.error('Redis add user to room error:', error);
      return false;
    }
  },
  
  // Remove a user from a room
  async removeUserFromRoom(userId, roomId) {
    try {
      await redisClient.sRem(`room:${roomId}:users`, userId);
      await redisClient.sRem(`user:${userId}:rooms`, roomId);
      return true;
    } catch (error) {
      console.error('Redis remove user from room error:', error);
      return false;
    }
  },
  
  // Set user typing status
  async setUserTyping(userId, roomId) {
    try {
      // Set user as typing with 5 second expiration
      await redisClient.set(`typing:${roomId}:${userId}`, '1', { EX: 5 });
      return true;
    } catch (error) {
      console.error('Redis set user typing error:', error);
      return false;
    }
  },
  
  // Get all typing users in a room
  async getTypingUsers(roomId) {
    try {
      const keys = await redisClient.keys(`typing:${roomId}:*`);
      return keys.map(key => key.split(':')[2]);
    } catch (error) {
      console.error('Redis get typing users error:', error);
      return [];
    }
  },
  
  // Increment unread message count for a user
  async incrementUnreadCount(userId, roomId) {
    try {
      await redisClient.incr(`user:${userId}:room:${roomId}:unread`);
      return true;
    } catch (error) {
      console.error('Redis increment unread count error:', error);
      return false;
    }
  },
  
  // Reset unread message count for a user in a room
  async resetUnreadCount(userId, roomId) {
    try {
      await redisClient.del(`user:${userId}:room:${roomId}:unread`);
      return true;
    } catch (error) {
      console.error('Redis reset unread count error:', error);
      return false;
    }
  },
  
  // Get unread message count for a user in a room
  async getUnreadCount(userId, roomId) {
    try {
      const count = await redisClient.get(`user:${userId}:room:${roomId}:unread`);
      return parseInt(count || '0', 10);
    } catch (error) {
      console.error('Redis get unread count error:', error);
      return 0;
    }
  }
};

module.exports = RedisService; 