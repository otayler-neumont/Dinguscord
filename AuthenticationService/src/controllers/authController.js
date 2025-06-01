const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
const config = require('../config/config');

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id,
      username: user.username,
      email: user.email
    },
    config.app.jwtSecret,
    { expiresIn: config.app.jwtExpiresIn }
  );
};

// Register a new user
const register = async (req, res) => {
  try {
    const { username, email, password, display_name } = req.body;
    
    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Username, email, and password are required'
      });
    }
    
    // Check if user already exists
    const existingUserByEmail = await UserModel.getUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(409).json({ 
        success: false,
        message: 'Email already in use'
      });
    }
    
    const existingUserByUsername = await UserModel.getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(409).json({ 
        success: false,
        message: 'Username already taken'
      });
    }
    
    // Create new user
    const newUser = await UserModel.createUser({
      username,
      email,
      password,
      display_name
    });
    
    // Generate JWT token
    const token = generateToken(newUser);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: newUser,
      token
    });
  } catch (error) {
    console.error('Error in user registration:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Authenticate user
    const result = await UserModel.authenticateUser(email, password);
    
    if (!result.success) {
      return res.status(401).json({ 
        success: false,
        message: result.message || 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = generateToken(result.user);
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: result.user,
      token
    });
  } catch (error) {
    console.error('Error in user login:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user profile
    const user = await UserModel.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email, display_name, avatar_url } = req.body;
    
    // Update user profile
    const updatedUser = await UserModel.updateUser(userId, {
      username,
      email,
      display_name,
      avatar_url
    });
    
    if (!updatedUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;
    
    // Validate required fields
    if (!current_password || !new_password) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    // Change password
    const result = await UserModel.changePassword(userId, current_password, new_password);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false,
        message: result.message
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Verify token
const verifyToken = async (req, res) => {
  try {
    // If middleware has passed, token is valid
    res.status(200).json({
      success: true,
      message: 'Token is valid',
      user: req.user
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  verifyToken
}; 