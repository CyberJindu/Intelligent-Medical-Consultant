import express from 'express';
import { phoneLogin, getProfile, updateProfile } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validatePhoneLogin, validateProfileUpdate } from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.post('/login', validatePhoneLogin, phoneLogin);

// Protected routes (require authentication)
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, validateProfileUpdate, updateProfile);

export default router;