const nodemailer = require('nodemailer');

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Send verification email
const sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify/${token}`;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    to: email,
    subject: 'Verify Your Email Address',
    html: `
      <h1>Email Verification</h1>
      <p>Thank you for registering! Please verify your email address by clicking the link below:</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
        Verify Email
      </a>
      <p>If you did not register for an account, please ignore this email.</p>
      <p>This link will expire in 24 hours.</p>
    `,
  };

  try {
    if ((process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && process.env.SKIP_EMAIL_VERIFICATION === 'true') {
      console.log('Email verification skipped in development/test mode');
      console.log('Verification URL would have been:', verificationUrl);
      return;
    }
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending verification email:', error);
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.log('Would have sent email to:', email);
      console.log('Verification URL:', verificationUrl);
      return;
    }
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${token}`;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    to: email,
    subject: 'Reset Your Password',
    html: `
      <h1>Password Reset</h1>
      <p>You requested to reset your password. Click the link below to set a new password:</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
        Reset Password
      </a>
      <p>If you did not request this password reset, please ignore this email.</p>
      <p>This link will expire in 1 hour.</p>
    `,
  };

  try {
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_EMAIL_VERIFICATION === 'true') {
      console.log('Password reset email skipped in development mode');
      console.log('Reset URL would have been:', resetUrl);
      return;
    }
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log('Would have sent email to:', email);
      console.log('Reset URL:', resetUrl);
      return;
    }
    throw new Error('Failed to send password reset email');
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};