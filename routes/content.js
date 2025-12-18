import express from 'express';
import {
  generateContent,
  getContentHistory,
  approveAndSaveContent,
  updateContent,
  deleteContent,
  getContentStats
} from '../controllers/contentController.js';
import { specialistAuthMiddleware } from '../middleware/specialistAuth.js';

const router = express.Router();

// All routes require specialist authentication
router.use(specialistAuthMiddleware);

// Content generation routes
router.post('/generate', generateContent);
router.post('/approve', approveAndSaveContent);
router.get('/history', getContentHistory);
router.put('/:id', updateContent);
router.delete('/:id', deleteContent);
router.get('/stats', getContentStats);


export default router;
