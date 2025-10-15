// config/db.js
const mongoose = require('mongoose');

const connectWithRetry = async (uri, options, retries = 5) => {
  try {
    console.log(`Attempting to connect to MongoDB at: ${uri}`);
    console.log('Connection options:', options);
    
    await mongoose.connect(uri, options);
    console.log('✅ MongoDB connected successfully');
    
    // Handle connection events
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    // Test the connection by listing collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));

  } catch (error) {
    if (retries === 0) {
      console.error('❌ MongoDB connection failed after all retries:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
    console.warn(`MongoDB connection attempt failed. Retrying... (${retries} attempts left)`);
    console.error('Connection error:', error.message);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
    return connectWithRetry(uri, options, retries - 1);
  }
};

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fileapp';
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // Default is 30000
    socketTimeoutMS: 45000, // Default is 360000
    family: 4 // Use IPv4, skip trying IPv6
  };

  await connectWithRetry(MONGO_URI, options);
};

module.exports = connectDB;
