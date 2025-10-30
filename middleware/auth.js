import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user and attach to request
    const user = await User.findById(decoded.userId).select('-__v');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    // Attach user to request object
    req.userId = decoded.userId;
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};