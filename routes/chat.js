import express from 'express';
import { 
  sendMessage, 
  getConversations, 
  getConversation, 
  deleteConversation,
  sendMessageWithImage,
  extractTopicsFromConversation,  
  updateUserHealthInterests       
} from '../controllers/chatController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateSendMessage } from '../middleware/validation.js';

const router = express.Router();

// All chat routes require authentication
router.use(authMiddleware);

// Send message to AI
router.post('/send', validateSendMessage, sendMessage);

// Send message with image
router.post('/send-image', sendMessageWithImage);

// Extract topics from conversation
router.post('/extract-topics', extractTopicsFromConversation);

// Update user health interests
router.post('/update-interests', updateUserHealthInterests);

// Get user's conversation list
router.get('/conversations', getConversations);

// Get specific conversation
router.get('/conversations/:conversationId', getConversation);

// Delete conversation
router.delete('/conversations/:conversationId', deleteConversation);

export default router;
