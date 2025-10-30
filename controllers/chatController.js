import Chat from '../models/Chat.js';
import { generateAIResponse } from '../utils/geminiHelper.js';

// Send message to AI and get response
export const sendMessage = async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const userId = req.userId;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    let chat;
    
    if (conversationId) {
      // Continue existing conversation
      chat = await Chat.findOne({ _id: conversationId, userId });
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }
    } else {
      // Start new conversation
      chat = new Chat({
        userId,
        title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        messages: []
      });
    }

    // Add user message
    const userMessage = {
      text: message.trim(),
      isUser: true,
      timestamp: new Date()
    };
    chat.messages.push(userMessage);

    // Generate AI response
    const aiResponse = await generateAIResponse(message, chat.messages);
    
    // Add AI message
    const aiMessage = {
      text: aiResponse,
      isUser: false,
      timestamp: new Date()
    };
    chat.messages.push(aiMessage);

    // Update conversation title if it's the first message
    if (chat.messages.length === 2) {
      chat.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
    }

    chat.updatedAt = new Date();
    await chat.save();

    res.status(200).json({
      success: true,
      data: {
        conversationId: chat._id,
        userMessage,
        aiMessage,
        needsSpecialist: aiMessage.text.toLowerCase().includes('specialist') || 
                        aiMessage.text.toLowerCase().includes('doctor') ||
                        aiMessage.text.toLowerCase().includes('emergency')
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process message',
      error: error.message
    });
  }
};

// Get user's chat conversations
export const getConversations = async (req, res) => {
  try {
    const userId = req.userId;
    const conversations = await Chat.find({ userId })
      .select('title messages updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    const simplifiedConversations = conversations.map(conv => ({
      id: conv._id,
      title: conv.title,
      preview: conv.messages.length > 0 ? conv.messages[0].text : 'No messages',
      messageCount: conv.messages.length,
      lastUpdated: conv.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: { conversations: simplifiedConversations }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
};

// Get specific conversation
export const getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    const conversation = await Chat.findOne({ _id: conversationId, userId });
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { conversation }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
      error: error.message
    });
  }
};

// Delete conversation
export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.userId;

    const result = await Chat.deleteOne({ _id: conversationId, userId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
      error: error.message
    });
  }
};