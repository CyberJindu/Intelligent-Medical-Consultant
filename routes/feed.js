import express from 'express';
import { 
  getPersonalizedFeed, 
  getFeedByTopics, 
  saveArticle, 
  shareArticle 
} from '../controllers/healthFeedController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.use(authMiddleware);

// Get personalized health feed (NOW FROM GENERATED CONTENT)
router.get('/personalized', getPersonalizedFeed);

// Get feed by specific topics
router.get('/by-topics', getFeedByTopics);

// Save article for later
router.post('/articles/:articleId/save', saveArticle);

// Share article
router.post('/articles/:articleId/share', shareArticle);

export default router;
