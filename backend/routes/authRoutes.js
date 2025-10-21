// routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

const router = express.Router();

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts. Please try again after 15 minutes'
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts
  message: 'Too many registration attempts. Please try again after an hour'
});

// Validation middleware
const registerValidation = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Full name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Full name can only contain letters and spaces'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('phoneNumber')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please enter a valid 10-digit Indian mobile number'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

const loginValidation = [
  body('emailOrPhone')
    .trim()
    .notEmpty()
    .withMessage('Email or phone number is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Token generation helper
const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '30d' // 30 days
    }
  );
};

// Refresh token generation helper
const signRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: '30d' // 30 days
    }
  );
};

// Register route
router.post('/register', registerLimiter, registerValidation, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }

    const { fullName, email, phoneNumber, password } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phoneNumber }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        error: 'A user with this email or phone number already exists'
      });
    }

    // Create verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Create new user
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      phoneNumber,
      password,
      verificationToken: verificationTokenHash,
      verificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    // Remove sensitive fields
    user.password = undefined;
    user.verificationToken = undefined;

    try {
      // Send verification email
      await sendVerificationEmail(user.email, verificationToken);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // In development, allow registration without email verification
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL_VERIFICATION === 'true') {
        user.verified = true;
        await user.save();
      } else {
        throw error;
      }
    }

    // Return success response with redirect
    res.sendWithRedirect(201, {
      status: 'success',
      message: 'Registration successful! Please check your email to verify your account.',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName
        }
      }
    }, '/auth/login');
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        status: 'error',
        error: `This ${field} is already registered`
      });
    }

    res.status(500).json({
      status: 'error',
      error: 'Registration failed. Please try again.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verify email route
router.get('/verify/:token', async (req, res) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid or expired verification token'
      });
    }

    user.verified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    const token = signToken(user);

    res.sendWithRedirect(200, {
      status: 'success',
      message: 'Email verified successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName
        },
        token
      }
    }, '/dashboard');
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Verification failed. Please try again.'
    });
  }
});

// Login route
router.post('/login', loginLimiter, loginValidation, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }

    const { emailOrPhone, password } = req.body;

    // Find user
    const user = await User.findOne({
      $or: [
        { email: emailOrPhone.toLowerCase() },
        { phoneNumber: emailOrPhone }
      ]
    }).select('+password +loginAttempts +lockUntil +active +verified');

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        status: 'error',
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.active) {
      return res.status(401).json({
        status: 'error',
        error: 'This account has been deactivated'
      });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(423).json({
        status: 'error',
        error: 'Account is locked',
        message: `Please try again after ${new Date(user.lockUntil).toLocaleString()}`
      });
    }

    // Verify password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      // Increment login attempts
      await user.incrementLoginAttempts();

      return res.status(401).json({
        status: 'error',
        error: 'Invalid credentials',
        remainingAttempts: Math.max(0, 5 - user.loginAttempts)
      });
    }

    // Check if email is verified
    if (!user.verified) {
      // In development mode with SKIP_EMAIL_VERIFICATION, auto-verify the user
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL_VERIFICATION === 'true') {
        user.verified = true;
        await user.save();
        console.log('Development mode: User auto-verified');
      } else {
        return res.sendWithRedirect(403, {
          status: 'error',
          error: 'Email not verified',
          message: 'Please verify your email before logging in'
        }, '/auth/verify-email');
      }
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = Date.now();
    await user.save();

    // Generate tokens
    const token = signToken(user);
    const refreshToken = signRefreshToken(user);

    // Store refresh token in user document
    user.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    user.refreshTokenExpires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    await user.save();

    // Remove sensitive data
    user.password = undefined;
    user.loginAttempts = undefined;
    user.lockUntil = undefined;

    // Send success response with redirect
    res.sendWithRedirect(200, {
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        },
        token,
        refreshToken
      }
    }, '/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Login failed. Please try again.',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to fetch user profile'
    });
  }
});

// Update password
router.patch('/update-password', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    // Check if current password is correct
    if (!(await user.comparePassword(req.body.currentPassword))) {
      return res.status(401).json({
        status: 'error',
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = req.body.newPassword;
    await user.save();

    // Generate new token
    const token = signToken(user);

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
      data: { token }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to update password'
    });
  }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        error: 'No user found with this email address'
      });
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send password reset email
    await sendPasswordResetEmail(user.email, resetToken);

    res.status(200).json({
      status: 'success',
      message: 'Password reset token sent to email'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to send password reset email'
    });
  }
});

// Reset password
router.patch('/reset-password/:token', async (req, res) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        error: 'Invalid or expired password reset token'
      });
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Failed to reset password'
    });
  }
});

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    // Clear refresh token from database
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshToken = undefined;
      user.refreshTokenExpires = undefined;
      await user.save();
    }

    res.sendWithRedirect(200, {
      status: 'success',
      message: 'Logged out successfully'
    }, '/auth/login');
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Logout failed'
    });
  }
});

// Refresh token route
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: 'error',
        error: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    // Find user and check if refresh token matches
    const user = await User.findById(decoded.id).select('+refreshToken +refreshTokenExpires');

    if (!user || !user.refreshToken || user.refreshToken !== crypto.createHash('sha256').update(refreshToken).digest('hex') || user.refreshTokenExpires < Date.now()) {
      return res.status(401).json({
        status: 'error',
        error: 'Invalid or expired refresh token'
      });
    }

    // Generate new tokens
    const newToken = signToken(user);
    const newRefreshToken = signRefreshToken(user);

    // Update refresh token in database
    user.refreshToken = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    user.refreshTokenExpires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to refresh token'
    });
  }
});

module.exports = router;