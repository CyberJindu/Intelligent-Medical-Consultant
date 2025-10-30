// Validation middleware for different request types

// Phone login validation
export const validatePhoneLogin = (req, res, next) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber || phoneNumber.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required'
    });
  }

  // Clean phone number and validate
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  if (cleanPhone.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid phone number (at least 10 digits)'
    });
  }

  // Replace with cleaned version
  req.body.phoneNumber = cleanPhone;
  next();
};

// Profile update validation
export const validateProfileUpdate = (req, res, next) => {
  const { name, email, dateOfBirth, gender, bloodType } = req.body;

  // Optional fields, but validate if provided
  if (email && !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid email address'
    });
  }

  if (dateOfBirth && !isValidDate(dateOfBirth)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid date of birth'
    });
  }

  if (gender && !['male', 'female', 'other', 'prefer-not-to-say'].includes(gender)) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid gender'
    });
  }

  if (bloodType && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodType)) {
    return res.status(400).json({
      success: false,
      message: 'Please select a valid blood type'
    });
  }

  next();
};

// Chat message validation
export const validateSendMessage = (req, res, next) => {
  const { message, conversationId } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Message is required'
    });
  }

  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'Message too long (max 1000 characters)'
    });
  }

  // Trim the message
  req.body.message = message.trim();
  next();
};

// Specialist recommendation validation
export const validateSpecialistRecommendation = (req, res, next) => {
  const { conversationContext } = req.body;

  if (!conversationContext || conversationContext.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Conversation context is required'
    });
  }

  if (conversationContext.length > 5000) {
    return res.status(400).json({
      success: false,
      message: 'Conversation context too long'
    });
  }

  next();
};

// Helper validation functions
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// CORS middleware (optional, for additional CORS configuration)
export const corsMiddleware = (req, res, next) => {
  const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

// Rate limiting middleware (optional)
export const rateLimitMiddleware = (req, res, next) => {
  // Simple in-memory rate limiting (for development)
  // In production, use a proper rate limiting library like express-rate-limit
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
  
  // This is a simplified version - implement proper rate limiting in production
  next();
};

// Error handling middleware (should be last)
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => error.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message: 'Something went wrong',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
};

// 404 handler for undefined routes
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};