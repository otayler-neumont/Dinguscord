const { Pool } = require('pg');
const config = require('../config/config');

// Create a PostgreSQL connection pool
const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password
});

// Initialize the messages table if it doesn't exist
const initializeTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id VARCHAR(255) NOT NULL,
        receiver_id VARCHAR(255),
        room_id VARCHAR(255),
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        is_delivered BOOLEAN DEFAULT FALSE,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    `);
    console.log('Messages table initialized');
  } catch (error) {
    console.error('Error initializing messages table:', error);
    throw error;
  }
};

// Call initialization at module load
initializeTable().catch(console.error);

// Message model methods
const MessageModel = {
  // Create a new message
  async create(messageData) {
    const { sender_id, receiver_id, room_id, content, message_type } = messageData;
    
    try {
      const result = await pool.query(
        `INSERT INTO messages 
         (sender_id, receiver_id, room_id, content, message_type) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [sender_id, receiver_id, room_id, content, message_type || 'text']
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  },

  // Get messages for a specific room
  async getByRoom(roomId, limit = 50, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT * FROM messages 
         WHERE room_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [roomId, limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching room messages:', error);
      throw error;
    }
  },

  // Get messages between two users (direct messages)
  async getDirectMessages(userId1, userId2, limit = 50, offset = 0) {
    try {
      const result = await pool.query(
        `SELECT * FROM messages 
         WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
         ORDER BY created_at DESC 
         LIMIT $3 OFFSET $4`,
        [userId1, userId2, limit, offset]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      throw error;
    }
  },

  // Mark messages as delivered
  async markAsDelivered(messageIds) {
    try {
      const result = await pool.query(
        `UPDATE messages 
         SET is_delivered = TRUE, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ANY($1::uuid[]) 
         RETURNING *`,
        [messageIds]
      );
      return result.rows;
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
      throw error;
    }
  },

  // Mark messages as read
  async markAsRead(messageIds) {
    try {
      const result = await pool.query(
        `UPDATE messages 
         SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ANY($1::uuid[]) 
         RETURNING *`,
        [messageIds]
      );
      return result.rows;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  },

  // Get message by ID
  async getById(id) {
    try {
      const result = await pool.query(
        'SELECT * FROM messages WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching message by ID:', error);
      throw error;
    }
  },

  // Delete a message
  async delete(id) {
    try {
      const result = await pool.query(
        'DELETE FROM messages WHERE id = $1 RETURNING *',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }
};

module.exports = MessageModel; 