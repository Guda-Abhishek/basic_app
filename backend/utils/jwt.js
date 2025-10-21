const jwt = require('jsonwebtoken');

// Generate access token
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m' // 15 minutes
  });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
  const crypto = require('crypto');
  return jwt.sign({ ...payload, jti: crypto.randomBytes(16).toString('hex') }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' // 7 days
  });
};

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw error;
  }
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
