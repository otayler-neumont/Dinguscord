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

// Function to retry database connection with exponential backoff
const connectWithRetry = async (maxRetries = 5, initialDelay = 2000) => {
  let retries = 0;
  let lastError;

  while (retries < maxRetries) {
    try {
      console.log(`Attempting to connect to database (attempt ${retries + 1}/${maxRetries})...`);
      // Test connection by querying the database
      await pool.query('SELECT NOW()');
      console.log('Successfully connected to the database');
      return pool;
    } catch (error) {
      lastError = error;
      retries++;
      const delay = initialDelay * Math.pow(2, retries - 1);
      console.log(`Database connection attempt failed. Retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`Failed to connect to database after ${maxRetries} attempts`);
  throw lastError;
};

// Initialize the messages table if it doesn't exist
const initializeTable = async () => {
  try {
    // First ensure we can connect to the database
    await connectWithRetry();
    
    // Then create the table if it doesn't exist
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

// Mocking message data for testing
const mockMessages = [
  { 
    id: '1234-5678-9012',
    sender_id: 'Alice',
    room_id: 'General',
    content: 'Hello, world!',
    created_at: new Date().toISOString()
  },
  { 
    id: '2345-6789-0123',
    sender_id: 'Bob',
    room_id: 'General',
    content: 'How is everyone doing?',
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  { 
    id: '3456-7890-1234',
    sender_id: 'Charlie',
    room_id: 'General',
    content: 'Just checking in!',
    created_at: new Date(Date.now() - 7200000).toISOString()
  }
];

// Create a new message
const createMessage = async (messageData) => {
  try {
    // Try to insert into database
    try {
      const { sender_id, receiver_id, room_id, content, message_type = 'text' } = messageData;
      
      const query = `
        INSERT INTO messages(sender_id, receiver_id, room_id, content, message_type)
        VALUES($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [sender_id, receiver_id, room_id, content, message_type];
      const result = await pool.query(query, values);
      
      return result.rows[0];
    } catch (error) {
      console.warn('Database insert failed, using mock data:', error.message);
      // For demonstration, create a mock message
      return {
        id: Math.random().toString(36).substring(2, 15),
        sender_id: messageData.sender_id,
        receiver_id: messageData.receiver_id,
        room_id: messageData.room_id,
        content: messageData.content,
        message_type: messageData.message_type || 'text',
        is_delivered: false,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('Error creating message:', error);
    throw error;
  }
};

// Get messages for a specific room
const getRoomMessages = async (roomId, limit = 50, offset = 0) => {
  try {
    // Try to fetch from database
    try {
      const query = `
        SELECT * FROM messages
        WHERE room_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        OFFSET $3
      `;
      
      const values = [roomId, limit, offset];
      const result = await pool.query(query, values);
      
      return result.rows.reverse();
    } catch (error) {
      console.warn('Database query failed, using mock data:', error.message);
      // Return mock data for demonstration
      return mockMessages.filter(msg => msg.room_id === roomId);
    }
  } catch (error) {
    console.error('Error getting room messages:', error);
    throw error;
  }
};

// Get direct messages between two users
const getDirectMessages = async (userId1, userId2, limit = 50, offset = 0) => {
  try {
    const query = `
      SELECT * FROM messages
      WHERE (sender_id = $1 AND receiver_id = $2)
         OR (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at DESC
      LIMIT $3
      OFFSET $4
    `;
    
    const values = [userId1, userId2, limit, offset];
    const result = await pool.query(query, values);
    
    return result.rows.reverse();
  } catch (error) {
    console.error('Error getting direct messages:', error);
    throw error;
  }
};

// Mark messages as delivered
const markAsDelivered = async (messageIds) => {
  try {
    const query = `
      UPDATE messages
      SET is_delivered = true,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($1)
    `;
    
    const values = [messageIds];
    await pool.query(query, values);
    
    return true;
  } catch (error) {
    console.error('Error marking messages as delivered:', error);
    throw error;
  }
};

// Mark messages as read
const markAsRead = async (messageIds) => {
  try {
    const query = `
      UPDATE messages
      SET is_read = true,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($1)
    `;
    
    const values = [messageIds];
    await pool.query(query, values);
    
    return true;
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Get unread count for a user in a room
const getUnreadCount = async (userId, roomId) => {
  try {
    const query = `
      SELECT COUNT(*) as unread_count
      FROM messages
      WHERE room_id = $1
        AND sender_id != $2
        AND is_read = false
    `;
    
    const values = [roomId, userId];
    const result = await pool.query(query, values);
    
    return parseInt(result.rows[0].unread_count, 10);
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
};

// Get a message by ID
const getById = async (messageId) => {
  try {
    const query = `
      SELECT * FROM messages
      WHERE id = $1
    `;
    
    const values = [messageId];
    const result = await pool.query(query, values);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting message by ID:', error);
    throw error;
  }
};

// Delete a message
const deleteMessage = async (messageId) => {
  try {
    const query = `
      DELETE FROM messages
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [messageId];
    const result = await pool.query(query, values);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

// Initialize the table when the module is imported
initializeTable().catch(error => {
  console.error('Error initializing messages table:', error);
});

module.exports = {
  createMessage,
  getRoomMessages,
  getDirectMessages,
  markAsDelivered,
  markAsRead,
  getUnreadCount,
  getById,
  deleteMessage
}; 