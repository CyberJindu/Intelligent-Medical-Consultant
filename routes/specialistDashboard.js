// routes/specialistDashboard.js
import express from 'express';
import { 
  getPerformanceStats,
  getAnalytics 
} from '../controllers/specialistDashboardController.js';
import { specialistAuthMiddleware } from '../middleware/specialistAuth.js';

const router = express.Router();

// All routes require specialist authentication
router.use(specialistAuthMiddleware);

// Get performance statistics for dashboard
router.get('/performance', getPerformanceStats);

// Get detailed analytics (optional)
router.get('/analytics', getAnalytics);

export default router;
