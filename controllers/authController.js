import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mediguide-secret-key-2024';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
};

// Phone number login/registration
export const phoneLogin = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Clean phone number (remove non-digits)
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number'
      });
    }

    // Find user or create new one
    let user = await User.findOne({ phoneNumber: cleanPhone });

    if (!user) {
      // Create new user
      user = new User({
        phoneNumber: cleanPhone,
        lastLogin: new Date()
      });
      await user.save();
    } else {
      // Update last login for existing user
      user.lastLogin = new Date();
      await user.save();
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: user.isNew ? 'Registration successful' : 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          profileComplete: user.isProfileComplete
        }
      }
    });

  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

// Get user profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-__v');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const { name, email, dateOfBirth, gender, bloodType } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        name,
        email,
        dateOfBirth,
        gender,
        bloodType,
        isProfileComplete: true,
        profileUpdatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};