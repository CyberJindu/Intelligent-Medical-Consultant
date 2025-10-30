import express from 'express';
import { 
  getRecommendedSpecialists, 
  getAllSpecialists, 
  getSpecialist 
} from '../controllers/specialistController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateSpecialistRecommendation } from '../middleware/validation.js';

const router = express.Router();

// Protected routes
router.use(authMiddleware);

// Get recommended specialists based on conversation
router.post('/recommend', validateSpecialistRecommendation, getRecommendedSpecialists);

// Get all specialists (with optional filtering)
router.get('/', getAllSpecialists);

// Get specific specialist details
router.get('/:specialistId', getSpecialist);

export default router;