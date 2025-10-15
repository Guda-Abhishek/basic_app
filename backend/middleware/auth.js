// middleware/auth.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');

const verifyAsync = promisify(jwt.verify);

const authMiddleware = async (req, res, next) => {
  try {
    // Check if token exists in headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.sendWithRedirect(401, {
        status: 'error',
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token'
      }, '/auth/login');
    }

    // Extract and verify token
    const token = authHeader.split(' ')[1];
    const decoded = await verifyAsync(token, process.env.JWT_SECRET);

    // Check if user still exists
    const currentUser = await User.findById(decoded.id).select('+active');
    if (!currentUser) {
      return res.status(401).json({
        status: 'error',
        error: 'User not found',
        message: 'The user belonging to this token no longer exists'
      });
    }

    // Check if user is active
    if (!currentUser.active) {
      return res.status(401).json({
        status: 'error',
        error: 'Inactive user',
        message: 'This account has been deactivated'
      });
    }

    // Check if user changed password after token was issued
    if (currentUser.passwordChangedAt) {
      const changedTimestamp = parseInt(
        currentUser.passwordChangedAt.getTime() / 1000,
        10
      );

      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({
          status: 'error',
          error: 'Invalid token',
          message: 'User recently changed password. Please log in again'
        });
      }
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        error: 'Token expired',
        message: 'Your session has expired. Please log in again'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        status: 'error',
        error: 'Invalid token',
        message: 'Invalid authentication token provided'
      });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Internal server error',
      message: 'Something went wrong. Please try again later'
    });
  }
};

module.exports = authMiddleware;
