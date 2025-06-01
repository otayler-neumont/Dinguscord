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

// Initialize the users table if it doesn't exist
const initializeTable = async () => {
  try {
    // First ensure we can connect to the database
    await connectWithRetry();
    
    // Then create the table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        avatar_url VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log('Users table initialized');
  } catch (error) {
    console.error('Error initializing users table:', error);
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
  changePassword
}; 