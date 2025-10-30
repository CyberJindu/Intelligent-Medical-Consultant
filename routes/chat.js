import express from 'express';
import { 
  sendMessage, 
  getConversations, 
  getConversation, 
  deleteConversation 
} from '../controllers/chatController.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateSendMessage } from '../middleware/validation.js';

const router = express.Router();

// All chat routes require authentication
router.use(authMiddleware);

// Send message to AI
router.post('/send', validateSendMessage, sendMessage);

// Get user's conversation list
router.get('/conversations', getConversations);

// Get specific conversation
router.get('/conversations/:conversationId', getConversation);

// Delete conversation
router.delete('/conversations/:conversationId', deleteConversation);

export default router;