import multer from 'multer';
import Chat from '../models/Chat.js';
import { generateAIResponse, analyzeForSpecialistRecommendation } from '../utils/geminiHelper.js';

// Configure multer for image upload
const storage = multer.memoryStorage(); // Store in memory for processing
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

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
    console.error('💬 Chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process message',
      error: error.message
    });
  }
};

// Send message with image
export const sendMessageWithImage = async (req, res) => {
  try {
    console.log('📸 Image upload attempt received');
    console.log('📋 Request body keys:', Object.keys(req.body || {}));
    
    const uploadMiddleware = upload.single('image');
    
    uploadMiddleware(req, res, async (err) => {
      if (err) {
        console.error('❌ Multer error:', err.message);
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      console.log('✅ File uploaded successfully');
      console.log('📁 File info:', {
        mimetype: req.file?.mimetype,
        size: req.file?.size,
        originalname: req.file?.originalname,
        bufferLength: req.file?.buffer?.length
      });

      const { message, conversationId } = req.body;
      const imageFile = req.file;
      const userId = req.userId;

      console.log('👤 User ID:', userId);
      console.log('💬 Message:', message);
      console.log('🆔 Conversation ID:', conversationId);

      if (!imageFile) {
        console.error('❌ No image file received');
        return res.status(400).json({
          success: false,
          message: 'Image is required'
        });
      }

      let chat;
      
      if (conversationId) {
        // Continue existing conversation
        chat = await Chat.findOne({ _id: conversationId, userId });
        if (!chat) {
          console.error('❌ Conversation not found:', conversationId);
          return res.status(404).json({
            success: false,
            message: 'Conversation not found'
          });
        }
        console.log('🔄 Continuing existing conversation');
      } else {
        // Start new conversation
        const title = message 
          ? message.substring(0, 50) + (message.length > 50 ? '...' : '')
          : 'Image consultation';
        chat = new Chat({
          userId,
          title,
          messages: []
        });
        console.log('🆕 Starting new conversation');
      }

      // Prepare image data for AI
      const imageData = {
        imageBuffer: imageFile.buffer,
        imageMimeType: imageFile.mimetype
      };

      // Add user message with image reference
      const userMessage = {
        text: message || 'Image uploaded',
        isUser: true,
        timestamp: new Date(),
        hasImage: true,
        imageInfo: {
          mimetype: imageFile.mimetype,
          size: imageFile.size,
          originalname: imageFile.originalname
        }
      };
      chat.messages.push(userMessage);

      try {
        // Generate AI response with image analysis
        console.log('🤖 Sending image to Gemini for analysis...');
        console.log('📊 Image size:', imageFile.buffer.length, 'bytes');
        console.log('📄 MIME type:', imageFile.mimetype);
        
        const aiResponse = await generateAIResponse(message || '', chat.messages, imageData);
        console.log('✅ Gemini response received');
        console.log('📝 Response preview:', aiResponse.substring(0, 200).replace(/\n/g, ' '));
        
        // Check if Specialist is needed
        const needsSpecialist = analyzeForSpecialistRecommendation(message || '', aiResponse);
        console.log('🎯 Specialist needed?', needsSpecialist);
        
        // Add AI message
        const aiMessage = {
          text: aiResponse,
          isUser: false,
          timestamp: new Date(),
          isImageAnalysis: true
        };
        chat.messages.push(aiMessage);

        // Update conversation title
        if (chat.messages.length === 2) {
          chat.title = message 
            ? message.substring(0, 50) + (message.length > 50 ? '...' : '')
            : 'Image Consultation';
        }

        chat.updatedAt = new Date();
        await chat.save();
        console.log('💾 Chat saved successfully');

        // Generate base64 preview for frontend
        const base64Preview = imageFile.buffer.toString('base64').substring(0, 100);
        
        res.status(200).json({
          success: true,
          data: {
            conversationId: chat._id,
            userMessage: {
              ...userMessage,
              imagePreview: `data:${imageFile.mimetype};base64,${base64Preview}...`
            },
            aiMessage,
            needsSpecialist: needsSpecialist || 
              aiMessage.text.toLowerCase().includes('specialist') || 
              aiMessage.text.toLowerCase().includes('doctor') ||
              aiMessage.text.toLowerCase().includes('emergency')
          }
        });
        
        console.log('🚀 Response sent successfully');

      } catch (geminiError) {
        console.error('❌ Gemini API error:', geminiError.message);
        console.error('🔧 Error stack:', geminiError.stack);
        
        // Add error message to chat
        const errorMessage = {
          text: "I apologize, but I'm having trouble analyzing this image. Please try again or describe the issue in text.",
          isUser: false,
          timestamp: new Date(),
          isError: true
        };
        
        if (chat) {
          chat.messages.push(errorMessage);
          chat.updatedAt = new Date();
          await chat.save();
        }

        res.status(500).json({
          success: false,
          data: {
            conversationId: chat?._id || null,
            aiMessage: errorMessage,
            needsSpecialist: false
          },
          message: 'AI analysis failed'
        });
      }
    });

  } catch (error) {
    console.error('💥 Image chat error:', error);
    console.error('🔧 Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to process image message',
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
    console.error('📚 Get conversations error:', error);
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
    console.error('🔍 Get conversation error:', error);
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
    console.error('🗑️ Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
      error: error.message
    });
  }
};
