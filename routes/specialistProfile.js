import express from 'express';
import { 
  updateSpecialistProfile, 
  deleteProfilePicture,
  getVerificationStatus
} from '../controllers/specialistProfileController.js';
import { specialistAuthMiddleware } from '../middleware/specialistAuth.js';

const router = express.Router();

// All routes require specialist authentication
router.use(specialistAuthMiddleware);

// Update profile (with image upload)
router.put('/profile', updateSpecialistProfile);

// Delete profile picture
router.delete('/profile/picture', deleteProfilePicture);

router.get('/verification', getVerificationStatus);

export default router;
