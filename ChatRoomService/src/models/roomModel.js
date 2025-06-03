const { Pool } = require('pg');

// Create a PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'chatroom',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password'
});

// Function to retry database connection with exponential backoff
const connectWithRetry = async (maxRetries = 5, initialDelay = 2000) => {
  let retries = 0;
  let lastError;

  while (retries < maxRetries) {
    try {
      console.log(`Attempting to connect to database (attempt ${retries + 1}/${maxRetries})...`);
      await pool.query('SELECT NOW()');
      console.log('Successfully connected to the chatroom database');
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

// Initialize the tables if they don't exist
const initializeTables = async () => {
  try {
    // First ensure we can connect to the database
    await connectWithRetry();
    
    // Create rooms table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name);
      CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON rooms(created_by);
    `);
    
    // Create room_memberships table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS room_memberships (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        UNIQUE(room_id, user_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_room_memberships_room_id ON room_memberships(room_id);
      CREATE INDEX IF NOT EXISTS idx_room_memberships_user_id ON room_memberships(user_id);
    `);
    
    console.log('Room tables initialized successfully');
  } catch (error) {
    console.error('Error initializing room tables:', error);
    throw error;
  }
};

// Create a new room
const createRoom = async (roomData) => {
  try {
    const { id, name, userId } = roomData;
    
    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert room
      const roomQuery = `
        INSERT INTO rooms(id, name, created_by)
        VALUES($1, $2, $3)
        ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      const roomResult = await client.query(roomQuery, [id, name, userId]);
      const room = roomResult.rows[0];
      
      // Add creator as member
      const memberQuery = `
        INSERT INTO room_memberships(room_id, user_id)
        VALUES($1, $2)
        ON CONFLICT (room_id, user_id) DO NOTHING
      `;
      await client.query(memberQuery, [id, userId]);
      
      await client.query('COMMIT');
      
      // Get room with members
      return await getRoomById(id);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating room:', error);
    throw error;
  }
};

// Get room by ID with members
const getRoomById = async (roomId) => {
  try {
    const query = `
      SELECT 
        r.*,
        COALESCE(
          json_agg(
            CASE WHEN rm.user_id IS NOT NULL 
            THEN rm.user_id 
            ELSE NULL END
          ) FILTER (WHERE rm.user_id IS NOT NULL), 
          '[]'::json
        ) as users
      FROM rooms r
      LEFT JOIN room_memberships rm ON r.id = rm.room_id
      WHERE r.id = $1
      GROUP BY r.id, r.name, r.created_by, r.created_at, r.updated_at
    `;
    
    const result = await pool.query(query, [roomId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting room by ID:', error);
    throw error;
  }
};

// Get rooms for a user
const getUserRooms = async (userId) => {
  try {
    const query = `
      SELECT 
        r.*,
        COALESCE(
          json_agg(
            CASE WHEN rm2.user_id IS NOT NULL 
            THEN rm2.user_id 
            ELSE NULL END
          ) FILTER (WHERE rm2.user_id IS NOT NULL), 
          '[]'::json
        ) as users
      FROM rooms r
      INNER JOIN room_memberships rm ON r.id = rm.room_id
      LEFT JOIN room_memberships rm2 ON r.id = rm2.room_id
      WHERE rm.user_id = $1
      GROUP BY r.id, r.name, r.created_by, r.created_at, r.updated_at
      ORDER BY r.updated_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting user rooms:', error);
    throw error;
  }
};

// Add user to room
const addUserToRoom = async (roomId, userId) => {
  try {
    const query = `
      INSERT INTO room_memberships(room_id, user_id)
      VALUES($1, $2)
      ON CONFLICT (room_id, user_id) DO NOTHING
      RETURNING *
    `;
    
    await pool.query(query, [roomId, userId]);
    
    // Return updated room
    return await getRoomById(roomId);
  } catch (error) {
    console.error('Error adding user to room:', error);
    throw error;
  }
};

// Remove user from room
const removeUserFromRoom = async (roomId, userId) => {
  try {
    const query = `
      DELETE FROM room_memberships
      WHERE room_id = $1 AND user_id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [roomId, userId]);
    
    // Return updated room
    return await getRoomById(roomId);
  } catch (error) {
    console.error('Error removing user from room:', error);
    throw error;
  }
};

// Delete room
const deleteRoom = async (roomId) => {
  try {
    const query = `
      DELETE FROM rooms
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [roomId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error deleting room:', error);
    throw error;
  }
};

// Check if room exists
const roomExists = async (roomId) => {
  try {
    const query = `SELECT id FROM rooms WHERE id = $1`;
    const result = await pool.query(query, [roomId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking if room exists:', error);
    throw error;
  }
};

// Initialize tables when module is loaded
initializeTables().catch(error => {
  console.error('Error initializing room tables:', error);
});

module.exports = {
  createRoom,
  getRoomById,
  getUserRooms,
  addUserToRoom,
  removeUserFromRoom,
  deleteRoom,
  roomExists
}; 