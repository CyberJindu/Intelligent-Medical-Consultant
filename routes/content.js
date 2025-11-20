import express from 'express';
import {
  generateContent,
  getContentHistory,
  updateContent,
  deleteContent
} from '../controllers/contentController.js';
import { specialistAuthMiddleware } from '../middleware/specialistAuth.js';

const router = express.Router();

// All routes require specialist authentication
router.use(specialistAuthMiddleware);

// Content generation routes
router.post('/generate', generateContent);
router.get('/history', getContentHistory);
router.put('/:id', updateContent);
router.delete('/:id', deleteContent);

export default router;
