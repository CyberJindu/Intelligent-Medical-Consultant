import express from 'express';
import { 
  submitVerification, 
  getVerificationStatus,
  updateVerificationStatus 
} from '../controllers/verificationController.js';
import { specialistAuthMiddleware } from '../middleware/specialistAuth.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';

const router = express.Router();

// Specialist routes (requires authentication)
router.use(specialistAuthMiddleware);

// Submit verification documents - Send base64 strings in body
router.post('/submit', submitVerification);

// Get verification status
router.get('/status', getVerificationStatus);

// Admin routes (requires admin authentication)
router.use(adminAuthMiddleware);

// Update verification status (admin only)
router.put('/:specialistId/status', updateVerificationStatus);

export default router;
