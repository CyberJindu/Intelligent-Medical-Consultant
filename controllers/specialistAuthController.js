import Specialist from '../models/Specialist.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'mediguide-secret-key-2024';

// Generate JWT token for specialists
const generateToken = (specialistId) => {
  return jwt.sign({ specialistId, userType: 'specialist' }, JWT_SECRET, { expiresIn: '30d' });
};

// Specialist registration
export const specialistRegister = async (req, res) => {
  try {
    const { email, password, name, specialty, phone, bio } = req.body;

    // Validation
    if (!email || !password || !name || !specialty || !phone || !bio) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if specialist already exists
    const existingSpecialist = await Specialist.findOne({ email });
    if (existingSpecialist) {
      return res.status(400).json({
        success: false,
        message: 'Specialist with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new specialist
    const specialist = new Specialist({
      email,
      password: hashedPassword,
      name,
      specialty,
      phone,
      bio,
      accountStatus: 'pending', // Requires admin approval
      lastLogin: new Date()
    });

    await specialist.save();

    // Generate token
    const token = generateToken(specialist._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Your account is pending approval.',
      data: {
        token,
        specialist: {
          id: specialist._id,
          email: specialist.email,
          name: specialist.name,
          accountStatus: specialist.accountStatus
        }
      }
    });

  } catch (error) {
    console.error('Specialist registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// Specialist login
export const specialistLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find specialist
    const specialist = await Specialist.findOne({ email });
    if (!specialist) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check account status
    if (specialist.accountStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: `Account is ${specialist.accountStatus}. Please contact administrator.`
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, specialist.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    specialist.lastLogin = new Date();
    await specialist.save();

    // Generate token
    const token = generateToken(specialist._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        specialist: {
          id: specialist._id,
          email: specialist.email,
          name: specialist.name,
          specialty: specialist.specialty
        }
      }
    });

  } catch (error) {
    console.error('Specialist login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// Get specialist profile
export const getSpecialistProfile = async (req, res) => {
  try {
    const specialist = await Specialist.findById(req.specialistId).select('-password -__v');
    
    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { specialist }
    });

  } catch (error) {
    console.error('Specialist profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};


// In the specialistRegister function, replace:
//accountStatus: 'pending',

// With:
//accountStatus: process.env.AUTO_APPROVE === 'true' ? 'approved' : 'pending',
