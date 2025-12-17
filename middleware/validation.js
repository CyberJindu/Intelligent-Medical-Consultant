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

// Specialist recommendation validation - FIXED TO ACCEPT OBJECTS
export const validateSpecialistRecommendation = (req, res, next) => {
  const { conversationContext } = req.body;

  // Check if conversationContext exists
  if (!conversationContext) {
    return res.status(400).json({
      success: false,
      message: 'Conversation context is required'
    });
  }

  let conversationText = '';

  try {
    // Handle multiple formats:
    // 1. String (text conversation)
    if (typeof conversationContext === 'string') {
      conversationText = conversationContext.trim();
    }
    // 2. Object with text/message/content fields
    else if (typeof conversationContext === 'object' && conversationContext !== null) {
      // Handle array of messages (most common)
      if (Array.isArray(conversationContext)) {
        conversationText = conversationContext
          .map(msg => {
            // Extract text from different possible message formats
            if (typeof msg === 'string') return msg;
            if (msg.text) return msg.text;
            if (msg.message) return msg.message;
            if (msg.content) return msg.content;
            if (msg.userMessage) return msg.userMessage;
            if (msg.botResponse) return msg.botResponse;
            return '';
          })
          .filter(text => text && text.trim() !== '')
          .join('\n')
          .trim();
      }
      // Handle single message object
      else if (conversationContext.text) {
        conversationText = String(conversationContext.text).trim();
      } else if (conversationContext.message) {
        conversationText = String(conversationContext.message).trim();
      } else if (conversationContext.content) {
        conversationText = String(conversationContext.content).trim();
      } else {
        // Try to extract conversation from any object format
        conversationText = Object.values(conversationContext)
          .filter(value => typeof value === 'string')
          .join(' ')
          .trim();
      }
    }
    // 3. Any other type (convert to string)
    else {
      conversationText = String(conversationContext).trim();
    }

    // Final validation
    if (!conversationText || conversationText === '') {
      return res.status(400).json({
        success: false,
        message: 'Could not extract valid conversation text'
      });
    }

    if (conversationText.length > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Conversation context too long (max 10000 characters)'
      });
    }

    // Add debug logging
    console.log('Conversation validation - Extracted text length:', conversationText.length);
    console.log('First 200 chars:', conversationText.substring(0, 200));

    // Store both original and processed text
    req.body.conversationContext = conversationText;
    req.body.originalContext = conversationContext; // Keep original for debugging

    next();

  } catch (error) {
    console.error('Conversation validation error:', error);
    return res.status(400).json({
      success: false,
      message: 'Invalid conversation format',
      error: error.message
    });
  }
};

// Verification document validation (for partner platform)
export const validateVerificationDocuments = (req, res, next) => {
  const { idProof, license, experience } = req.body;

  if (!idProof || !license || !experience) {
    return res.status(400).json({
      success: false,
      message: 'All three documents are required: ID Proof, License, and Experience Certificate'
    });
  }

  // Validate base64 format
  const base64Regex = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+)?;base64,/;
  
  [idProof, license, experience].forEach((doc, index) => {
    const docName = ['ID Proof', 'Professional License', 'Experience Certificate'][index];
    
    if (!base64Regex.test(doc)) {
      return res.status(400).json({
        success: false,
        message: `${docName} must be in valid base64 format`
      });
    }

    // Check file size (approx 5MB limit)
    const base64Data = doc.replace(/^data:[^;]+;base64,/, '');
    const fileSize = (base64Data.length * 3) / 4; // Approximate size in bytes
    
    if (fileSize > 5 * 1024 * 1024) { // 5MB
      return res.status(400).json({
        success: false,
        message: `${docName} exceeds 5MB size limit`
      });
    }

    // Check file type
    const mimeMatch = doc.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
    if (mimeMatch) {
      const mimeType = mimeMatch[1];
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      
      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({
          success: false,
          message: `${docName} must be JPEG, PNG, or PDF format`
        });
      }
    }
  });

  next();
};

// Specialist registration validation
export const validateSpecialistRegistration = (req, res, next) => {
  const { email, password, name, specialty, phone, bio } = req.body;

  const requiredFields = [
    { field: email, name: 'Email' },
    { field: password, name: 'Password' },
    { field: name, name: 'Full Name' },
    { field: specialty, name: 'Specialty' },
    { field: phone, name: 'Phone Number' },
    { field: bio, name: 'Professional Bio' }
  ];

  for (const { field, name } of requiredFields) {
    if (!field || field.trim() === '') {
      return res.status(400).json({
        success: false,
        message: `${name} is required`
      });
    }
  }

  // Email validation
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid email address'
    });
  }

  // Password strength
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }

  // Phone validation
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid phone number'
    });
  }

  // Bio length
  if (bio.length < 50) {
    return res.status(400).json({
      success: false,
      message: 'Professional bio must be at least 50 characters'
    });
  }

  // Clean phone number
  req.body.phone = cleanPhone;
  next();
};

// Content generation validation
export const validateContentGeneration = (req, res, next) => {
  const { topic, contentType } = req.body;

  if (!topic || topic.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'Topic is required'
    });
  }

  if (!contentType || !['article', 'blog-post', 'guide', 'tips', 'research'].includes(contentType)) {
    return res.status(400).json({
      success: false,
      message: 'Valid content type is required'
    });
  }

  if (topic.length > 200) {
    return res.status(400).json({
      success: false,
      message: 'Topic too long (max 200 characters)'
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

// CORS middleware
export const corsMiddleware = (req, res, next) => {
  const allowedOrigins = [process.env.CLIENT_URL, 'http://localhost:5173'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
};

// Rate limiting middleware
export const rateLimitMiddleware = (req, res, next) => {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
  
  next();
};

// Error handling middleware
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => error.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  res.status(500).json({
    success: false,
    message: 'Something went wrong',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
};

// 404 handler
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};
