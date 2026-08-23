/**
 * MongoDB Database Connection Configuration
 * 
 * This module handles the connection to MongoDB using Mongoose.
 * It includes connection pooling, error handling, retry logic,
 * and graceful shutdown handling.
 */

const mongoose = require('mongoose');

/**
 * MongoDB Connection Options
 * These options optimize connection pooling and handling
 */
const connectionOptions = {
  // Maximum number of sockets the MongoDB driver will keep open
  maxPoolSize: 10,
  
  // Minimum number of sockets the MongoDB driver will keep open
  minPoolSize: 5,
  
  // How long to wait for a connection to be established (in ms)
  serverSelectionTimeoutMS: 5000,
  
  // How long a socket can be inactive before closing (in ms)
  socketTimeoutMS: 45000,
  
  // The name of the database we want to use
  dbName: process.env.DB_NAME || 'complaint_system',
  
  // Use the new URL parser
  // Note: These are default in Mongoose 6+, but included for clarity
};

/**
 * Database Connection State Tracking
 */
let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Connect to MongoDB Database
 * 
 * @returns {Promise<mongoose.Connection>} Mongoose connection object
 * @throws {Error} If connection fails after max retries
 */
const connectDB = async () => {
  // If already connected, return the existing connection
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log('📦 Using existing MongoDB connection');
    return mongoose.connection;
  }

  // Get MongoDB URI from environment variables
  const MONGODB_URI = process.env.MONGODB_URI;

  // Validate MongoDB URI exists
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in environment variables');
    throw new Error('MONGODB_URI environment variable is required');
  }

  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    
    // Attempt to connect to MongoDB
    const conn = await mongoose.connect(MONGODB_URI, connectionOptions);
    
    isConnected = true;
    connectionAttempts = 0; // Reset attempts on successful connection
    
    console.log(`✅ MongoDB Connected Successfully`);
    console.log(`📍 Host: ${conn.connection.host}`);
    console.log(`📂 Database: ${conn.connection.name}`);
    
    return conn.connection;
    
  } catch (error) {
    isConnected = false;
    connectionAttempts++;
    
    console.error(`❌ MongoDB Connection Error (Attempt ${connectionAttempts}/${MAX_RETRY_ATTEMPTS}):`, error.message);
    
    // Retry logic
    if (connectionAttempts < MAX_RETRY_ATTEMPTS) {
      console.log(`🔄 Retrying connection in ${RETRY_DELAY / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDB(); // Recursive retry
    }
    
    // Max retries exceeded
    console.error('❌ Max connection attempts exceeded. Exiting...');
    throw new Error(`Failed to connect to MongoDB after ${MAX_RETRY_ATTEMPTS} attempts: ${error.message}`);
  }
};

/**
 * Disconnect from MongoDB Database
 * 
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  if (!isConnected) {
    console.log('📦 No active MongoDB connection to disconnect');
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('🔌 MongoDB Disconnected Successfully');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error.message);
    throw error;
  }
};

/**
 * Get Current Connection Status
 * 
 * @returns {Object} Connection status information
 */
const getConnectionStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    isConnected,
    state: states[mongoose.connection.readyState] || 'unknown',
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
    connectionAttempts,
  };
};

/**
 * MongoDB Connection Event Handlers
 * These handlers log various connection events for monitoring
 */

// Connection successful
mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connected to MongoDB');
});

// Connection error
mongoose.connection.on('error', (err) => {
  console.error('🔴 Mongoose connection error:', err.message);
  isConnected = false;
});

// Connection disconnected
mongoose.connection.on('disconnected', () => {
  console.log('🟡 Mongoose disconnected from MongoDB');
  isConnected = false;
});

// Connection reconnected
mongoose.connection.on('reconnected', () => {
  console.log('🟢 Mongoose reconnected to MongoDB');
  isConnected = true;
});

// Close connection when app terminates
mongoose.connection.on('close', () => {
  console.log('🔵 Mongoose connection closed');
  isConnected = false;
});

/**
 * Graceful Shutdown Handlers
 * Ensures database connection is properly closed on app termination
 */

// Handle application termination
const gracefulShutdown = async (signal) => {
  console.log(`\n📛 Received ${signal}. Closing MongoDB connection...`);
  try {
    await disconnectDB();
    console.log('👋 MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error.message);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error);
  await gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  await gracefulShutdown('unhandledRejection');
});

// Export functions
module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  mongoose, // Export mongoose instance for models
};