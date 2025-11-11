import jwt from 'jsonwebtoken';
import Specialist from '../models/Specialist.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const specialistAuthMiddleware = async (req, res, next) => {
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
    
    // Check if this is a specialist token
    if (decoded.userType !== 'specialist') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type. Specialist access required.'
      });
    }

    // Find specialist and attach to request
    const specialist = await Specialist.findById(decoded.specialistId).select('-password -__v');
    
    if (!specialist) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Specialist not found.'
      });
    }

    // Check if account is approved
    if (specialist.accountStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Account is ${specialist.accountStatus}. Access denied.`
      });
    }

    // Attach specialist to request object
    req.specialistId = decoded.specialistId;
    req.specialist = specialist;
    
    next();
  } catch (error) {
    console.error('Specialist auth middleware error:', error);

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
