import express from 'express';
import { 
  specialistRegister, 
  specialistLogin, 
  getSpecialistProfile, 
  updateSpecialistProfile
} from '../controllers/specialistAuthController.js';
import { specialistAuthMiddleware } from '../middleware/specialistAuth.js';

const router = express.Router();

// Public routes
router.post('/register', specialistRegister);
router.post('/login', specialistLogin);

// Protected routes (require specialist authentication)
router.get('/profile', specialistAuthMiddleware, getSpecialistProfile);
router.put('/profile', specialistAuthMiddleware, updateSpecialistProfile);

export default router;
