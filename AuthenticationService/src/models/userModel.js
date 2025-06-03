const { Pool } = require('pg');
const bcrypt = require('bcrypt');
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

// Initialize the users table
const initializeTable = async () => {
  try {
    await connectWithRetry();
    
    // Create users table
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(createUsersTable);
    console.log('Users table initialized successfully');
    
    // Create friendships table
    const createFriendsTable = `
      CREATE TABLE IF NOT EXISTS friendships (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, friend_id),
        CHECK (user_id != friend_id)
      )
    `;
    
    await pool.query(createFriendsTable);
    console.log('Friendships table initialized successfully');
    
    // Create index for faster friendship queries
    const createFriendshipIndexes = `
      CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
      CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
      CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
    `;
    
    await pool.query(createFriendshipIndexes);
    console.log('Friendship indexes created successfully');
    
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
};

// Create a new user
const createUser = async (userData) => {
  try {
    const { username, email, password, display_name } = userData;
    
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const query = `
      INSERT INTO users(username, email, password, display_name)
      VALUES($1, $2, $3, $4)
      RETURNING id, username, email, display_name, created_at
    `;
    
    const values = [username, email, hashedPassword, display_name || username];
    const result = await pool.query(query, values);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Get user by email
const getUserByEmail = async (email) => {
  try {
    const query = `
      SELECT * FROM users
      WHERE email = $1
    `;
    
    const values = [email];
    const result = await pool.query(query, values);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};

// Get user by username
const getUserByUsername = async (username) => {
  try {
    const query = `
      SELECT * FROM users
      WHERE username = $1
    `;
    
    const values = [username];
    const result = await pool.query(query, values);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user by username:', error);
    throw error;
  }
};

// Get user by ID
const getUserById = async (id) => {
  try {
    const query = `
      SELECT id, username, email, display_name, avatar_url, is_active, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    
    const values = [id];
    const result = await pool.query(query, values);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
};

// Authenticate user (verify password)
const authenticateUser = async (email, password) => {
  try {
    // Get user by email
    const user = await getUserByEmail(email);
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return { success: false, message: 'Invalid password' };
    }
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return { 
      success: true, 
      user: userWithoutPassword
    };
  } catch (error) {
    console.error('Error authenticating user:', error);
    throw error;
  }
};

// Update user profile
const updateUser = async (id, userData) => {
  try {
    const { username, email, display_name, avatar_url } = userData;
    
    const query = `
      UPDATE users
      SET username = COALESCE($1, username),
          email = COALESCE($2, email),
          display_name = COALESCE($3, display_name),
          avatar_url = COALESCE($4, avatar_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, username, email, display_name, avatar_url, is_active, created_at, updated_at
    `;
    
    const values = [username, email, display_name, avatar_url, id];
    const result = await pool.query(query, values);
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

// Change password
const changePassword = async (id, currentPassword, newPassword) => {
  try {
    // Get user with password
    const query = `SELECT * FROM users WHERE id = $1`;
    const result = await pool.query(query, [id]);
    const user = result.rows[0];
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return { success: false, message: 'Current password is incorrect' };
    }
    
    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    const updateQuery = `
      UPDATE users
      SET password = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    
    await pool.query(updateQuery, [hashedPassword, id]);
    
    return { success: true, message: 'Password updated successfully' };
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

// Search users by username or display name
const searchUsers = async (searchTerm, excludeUserId) => {
  try {
    const query = `
      SELECT id, username, email, display_name, avatar_url
      FROM users
      WHERE (username ILIKE $1 OR display_name ILIKE $1)
        AND id != $2
        AND is_active = true
      ORDER BY 
        CASE WHEN username ILIKE $1 THEN 1 ELSE 2 END,
        username
      LIMIT 20
    `;
    
    const searchPattern = `%${searchTerm}%`;
    const values = [searchPattern, excludeUserId];
    const result = await pool.query(query, values);
    
    return result.rows;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

// Add friend request
const addFriend = async (userId, friendId) => {
  try {
    // Check if friendship already exists
    const existingQuery = `
      SELECT * FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) 
         OR (user_id = $2 AND friend_id = $1)
    `;
    const existingResult = await pool.query(existingQuery, [userId, friendId]);
    
    if (existingResult.rows.length > 0) {
      return { success: false, message: 'Friendship already exists' };
    }
    
    // Create friendship record
    const query = `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'accepted')
      RETURNING *
    `;
    
    const result = await pool.query(query, [userId, friendId]);
    
    // Create reciprocal friendship record for easier querying
    const reciprocalQuery = `
      INSERT INTO friendships (user_id, friend_id, status)
      VALUES ($1, $2, 'accepted')
      RETURNING *
    `;
    
    await pool.query(reciprocalQuery, [friendId, userId]);
    
    return { success: true, friendship: result.rows[0] };
  } catch (error) {
    console.error('Error adding friend:', error);
    throw error;
  }
};

// Remove friend
const removeFriend = async (userId, friendId) => {
  try {
    const query = `
      DELETE FROM friendships 
      WHERE (user_id = $1 AND friend_id = $2) 
         OR (user_id = $2 AND friend_id = $1)
    `;
    
    const result = await pool.query(query, [userId, friendId]);
    
    return { success: true, deletedCount: result.rowCount };
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

// Get user's friends list with user details
const getFriends = async (userId) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.avatar_url,
        f.created_at as friend_since
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = $1 
        AND f.status = 'accepted'
        AND u.is_active = true
      ORDER BY u.username
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting friends:', error);
    throw error;
  }
};

// Check if two users are friends
const areFriends = async (userId1, userId2) => {
  try {
    const query = `
      SELECT 1 FROM friendships 
      WHERE user_id = $1 AND friend_id = $2 AND status = 'accepted'
    `;
    
    const result = await pool.query(query, [userId1, userId2]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking friendship:', error);
    throw error;
  }
};

// Initialize the table when the module is imported
initializeTable().catch(error => {
  console.error('Error initializing users table:', error);
});

module.exports = {
  createUser,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  authenticateUser,
  updateUser,
  changePassword,
  searchUsers,
  addFriend,
  removeFriend,
  getFriends,
  areFriends
}; 