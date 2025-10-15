// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');

// Load environment variables
dotenv.config();

// Import DB connection
const connectDB = require('./config/db');

// Constants
const PORT = 5000; // Force port 5000
const NODE_ENV = process.env.NODE_ENV || 'development';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '10mb';

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Handle OPTIONS preflight requests
app.options('*', cors());

// General middleware
app.use(compression());
app.use(express.json({ limit: MAX_FILE_SIZE }));
app.use(express.urlencoded({ extended: true, limit: MAX_FILE_SIZE }));
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// Custom middleware
const handleRedirects = require('./middleware/redirect');
app.use(handleRedirects);

// Ensure upload directories exist
const userUploadsDir = path.join(UPLOAD_DIR, 'users');
const guestUploadsDir = path.join(UPLOAD_DIR, 'guests');
[userUploadsDir, guestUploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Serve static files
app.use('/uploads/users', express.static(userUploadsDir));
app.use('/uploads/guests', express.static(guestUploadsDir));

// Import routes
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const transformRoutes = require('./routes/transformRoutes');

// Debug route to test API
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

// Request logging middleware
app.use((req, res, next) => {
  const requestStart = Date.now();
  
  // Log request
  console.log('⬅️ Incoming request:');
  console.log(`   ${req.method} ${req.originalUrl}`);
  console.log('   Headers:', JSON.stringify(req.headers, null, 2));
  console.log('   Body:', req.body);
  console.log('   Query:', req.query);
  
  // Store original res.json to intercept response
  const oldJson = res.json;
  res.json = function(data) {
    console.log('➡️ Outgoing response:');
    console.log(`   Status: ${res.statusCode}`);
    console.log('   Body:', JSON.stringify(data, null, 2));
    console.log(`   Time: ${Date.now() - requestStart}ms`);
    
    // Call original json function
    return oldJson.apply(res, arguments);
  };
  
  next();
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/transform', transformRoutes);

// Error handling middleware (must be before 404 handler)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  res.status(err.status || 500).json({
    error: NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Handle 404 (must be after all other routes)
app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).json({ error: 'Route not found' });
});

// Start server only after MongoDB connection is established
let server;

const startServer = async () => {
  try {
    console.log('Starting server...');
    console.log('Environment:', {
      NODE_ENV,
      PORT,
      MONGO_URI: process.env.MONGO_URI,
      CORS_ORIGIN: process.env.CORS_ORIGIN
    });
    
    // Connect to MongoDB first
    console.log('Attempting to connect to MongoDB...');
    await connectDB();
    console.log('MongoDB connection successful!');
    
    // Start server with port fallback
    const startServerOnPort = (port) => {
      server = app.listen(port, '0.0.0.0', () => {
        const addr = server.address();
        console.log(`Server is listening on ${addr.address}:${addr.port}`);
      });
      
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${port} is busy, trying ${port + 1}...`);
          server.close();
          startServerOnPort(port + 1);
        } else {
          console.error('Server error:', err);
          process.exit(1);
        }
      });

      server.on('listening', () => {
        const actualPort = server.address().port;
        console.log(`✅ Server running in ${NODE_ENV} mode on port ${actualPort}`);
        console.log(`📁 Upload directories initialized at ${UPLOAD_DIR}`);
        console.log('🌐 API endpoints:');
        console.log('   - POST /api/auth/register');
        console.log('   - POST /api/auth/login');
        console.log('   - GET /api/files');
        console.log('   - POST /api/files/upload');
        console.log('   - GET /api/test');
      });
    };

    startServerOnPort(PORT);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

startServer();

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  server.close(() => {
    process.exit(1);
  });
});
