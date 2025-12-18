import multer from 'multer';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { 
  generateAIResponse, 
  analyzeForSpecialistRecommendation, 
  extractHealthTopicsFromConversation,
  analyzeHealthStateAndSpecialty // ⚡ NEW
} from '../utils/geminiHelper.js';

// Configure multer for image upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * Extract topics from conversation text and update user's health interests
 */
const extractAndUpdateTopics = async (userId, conversationText) => {
  try {
    console.log('🧠 Extracting topics for user:', userId);
    
    if (!conversationText?.trim()) {
      console.log('⚠️ No conversation text provided for topic extraction');
      return [];
    }

    const extractedTopics = await extractHealthTopicsFromConversation(conversationText);
    console.log('✅ Extracted topics:', extractedTopics.length);
    
    if (extractedTopics.length === 0) {
      return [];
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found for topic extraction:', userId);
      return [];
    }

    const formattedTopics = extractedTopics.map(topic => ({
      topic: topic.topic,
      category: topic.category,
      severity: topic.severity
    }));
    
    await user.updateConversationTopics(formattedTopics, conversationText.substring(0, 100));
    
    extractedTopics.forEach(topic => {
      const existingInterest = user.healthInterests.find(
        i => i.topic.toLowerCase() === topic.topic.toLowerCase()
      );
      
      if (existingInterest) {
        existingInterest.relevanceScore = Math.min(100, existingInterest.relevanceScore + 10);
        existingInterest.lastEngaged = new Date();
      } else {
        user.healthInterests.push({
          topic: topic.topic,
          relevanceScore: 60,
          lastEngaged: new Date(),
          contentTypePreferences: ['article', 'tips']
        });
      }
    });
    
    await user.save();
    console.log('✅ User topics and interests updated');
    
    return extractedTopics;

  } catch (error) {
    console.error('❌ Topic extraction and update error:', error);
    return [];
  }
};

// ⚡ NEW: Real-time health state analysis
const analyzeConversationHealthState = async (conversationText, chat, userId) => {
  try {
    console.log('⚡ Analyzing health state in real-time...');
    
    const healthAnalysis = await analyzeHealthStateAndSpecialty(conversationText);
    console.log('✅ Health analysis result:', healthAnalysis);
    
    // Update chat with health analysis
    await chat.updateHealthState(
      healthAnalysis.healthState,
      healthAnalysis.severityScore,
      healthAnalysis.recommendedSpecialty
    );
    
    // Update key symptoms
    chat.keySymptoms = [...new Set([...chat.keySymptoms || [], ...healthAnalysis.keySymptoms])];
    await chat.save();
    
    return healthAnalysis;
    
  } catch (error) {
    console.error('❌ Health state analysis error:', error);
    
    // Fallback to simple keyword detection
    const legacyNeedsSpecialist = analyzeForSpecialistRecommendation(
      conversationText.split('\n').pop() || '',
      ''
    );
    
    return {
      healthState: legacyNeedsSpecialist ? 'urgent' : 'routine',
      severityScore: legacyNeedsSpecialist ? 60 : 20,
      recommendedSpecialty: 'General Physician',
      specialistAdvised: legacyNeedsSpecialist,
      keySymptoms: [],
      confidence: 0.5
    };
  }
};

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
      chat = await Chat.findOne({ _id: conversationId, userId });
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }
    } else {
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
    
    // Extract topics from this conversation
    const conversationText = [...chat.messages.map(m => m.text), message, aiResponse].join(' ');
    const extractedTopics = await extractAndUpdateTopics(userId, conversationText);
    
    // ⚡ NEW: Real-time health state analysis
    const healthAnalysis = await analyzeConversationHealthState(conversationText, chat, userId);
    
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

    // Legacy check for backward compatibility
    const legacyNeedsSpecialist = analyzeForSpecialistRecommendation(message, aiResponse);

    res.status(200).json({
      success: true,
      data: {
        conversationId: chat._id,
        userMessage,
        aiMessage,
        extractedTopics: extractedTopics.map(t => ({
          topic: t.topic,
          category: t.category,
          severity: t.severity,
          confidence: t.confidence
        })),
        // ⚡ NEW: Health analysis data for proactive recommendations
        healthAnalysis: {
          healthState: healthAnalysis.healthState,
          severityScore: healthAnalysis.severityScore,
          recommendedSpecialty: healthAnalysis.recommendedSpecialty,
          specialistAdvised: healthAnalysis.specialistAdvised,
          keySymptoms: healthAnalysis.keySymptoms,
          confidence: healthAnalysis.confidence
        },
        // Legacy field for backward compatibility
        needsSpecialist: legacyNeedsSpecialist || healthAnalysis.specialistAdvised,
        topicCount: extractedTopics.length
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

      const { message, conversationId } = req.body;
      const imageFile = req.file;
      const userId = req.userId;

      if (!imageFile) {
        console.error('❌ No image file received');
        return res.status(400).json({
          success: false,
          message: 'Image is required'
        });
      }

      let chat;
      
      if (conversationId) {
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

      const imageData = {
        imageBuffer: imageFile.buffer,
        imageMimeType: imageFile.mimetype
      };

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
        console.log('🤖 Sending image to Gemini for analysis...');
        
        const aiResponse = await generateAIResponse(message || '', chat.messages, imageData);
        console.log('✅ Gemini response received');
        
        const conversationText = [...chat.messages.map(m => m.text), message || '', aiResponse].join(' ');
        const extractedTopics = await extractAndUpdateTopics(userId, conversationText);
        
        // ⚡ NEW: Health analysis for image conversations too
        const healthAnalysis = await analyzeConversationHealthState(conversationText, chat, userId);
        
        const legacyNeedsSpecialist = analyzeForSpecialistRecommendation(message || '', aiResponse);
        console.log('🎯 Specialist needed?', legacyNeedsSpecialist);
        
        const aiMessage = {
          text: aiResponse,
          isUser: false,
          timestamp: new Date(),
          isImageAnalysis: true
        };
        chat.messages.push(aiMessage);

        if (chat.messages.length === 2) {
          chat.title = message 
            ? message.substring(0, 50) + (message.length > 50 ? '...' : '')
            : 'Image Consultation';
        }

        chat.updatedAt = new Date();
        await chat.save();
        console.log('💾 Chat saved successfully');

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
            extractedTopics: extractedTopics.map(t => ({
              topic: t.topic,
              category: t.category,
              severity: t.severity,
              confidence: t.confidence
            })),
            // ⚡ NEW: Health analysis for image chats
            healthAnalysis: {
              healthState: healthAnalysis.healthState,
              severityScore: healthAnalysis.severityScore,
              recommendedSpecialty: healthAnalysis.recommendedSpecialty,
              specialistAdvised: healthAnalysis.specialistAdvised,
              keySymptoms: healthAnalysis.keySymptoms,
              confidence: healthAnalysis.confidence
            },
            needsSpecialist: legacyNeedsSpecialist || 
              aiMessage.text.toLowerCase().includes('specialist') || 
              aiMessage.text.toLowerCase().includes('doctor') ||
              aiMessage.text.toLowerCase().includes('emergency') ||
              healthAnalysis.specialistAdvised,
            topicCount: extractedTopics.length
          }
        });
        
        console.log('🚀 Response sent successfully');

      } catch (geminiError) {
        console.error('❌ Gemini API error:', geminiError.message);
        
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
            extractedTopics: [],
            healthAnalysis: {
              healthState: 'routine',
              severityScore: 20,
              recommendedSpecialty: 'General Physician',
              specialistAdvised: false,
              keySymptoms: [],
              confidence: 0.5
            },
            needsSpecialist: false
          },
          message: 'AI analysis failed'
        });
      }
    });

  } catch (error) {
    console.error('💥 Image chat error:', error);
    
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
      .select('title messages healthState severityScore specialistAdvised updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50);

    const simplifiedConversations = conversations.map(conv => ({
      id: conv._id,
      title: conv.title,
      preview: conv.messages.length > 0 ? conv.messages[0].text : 'No messages',
      messageCount: conv.messages.length,
      healthState: conv.healthState,
      severityScore: conv.severityScore,
      specialistAdvised: conv.specialistAdvised,
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

/**
 * Extract topics from conversation text (API endpoint)
 */
export const extractTopicsFromConversation = async (req, res) => {
  try {
    const { conversationText } = req.body;
    const userId = req.userId;
    
    console.log('🧠 Topic extraction API called for user:', userId);

    if (!conversationText?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Conversation text is required'
      });
    }

    const extractedTopics = await extractAndUpdateTopics(userId, conversationText);

    res.status(200).json({
      success: true,
      data: {
        topics: extractedTopics.map(t => ({
          topic: t.topic,
          category: t.category,
          severity: t.severity,
          confidence: t.confidence
        })),
        count: extractedTopics.length,
        userUpdated: true
      }
    });

  } catch (error) {
    console.error('❌ Topic extraction API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract topics from conversation',
      error: error.message
    });
  }
};

/**
 * Update user health interests based on topics (API endpoint)
 */
export const updateUserHealthInterests = async (req, res) => {
  try {
    const { topics } = req.body;
    const userId = req.userId;

    console.log('🔄 Health interests update API called for user:', userId);

    if (!topics || !Array.isArray(topics)) {
      return res.status(400).json({
        success: false,
        message: 'Topics array is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedTopics = [];
    
    topics.forEach(topic => {
      if (!topic?.topic) return;
      
      const existingInterest = user.healthInterests.find(
        i => i.topic.toLowerCase() === topic.topic?.toLowerCase()
      );
      
      if (existingInterest) {
        existingInterest.relevanceScore = Math.min(100, existingInterest.relevanceScore + 15);
        existingInterest.lastEngaged = new Date();
        updatedTopics.push({
          topic: existingInterest.topic,
          relevanceScore: existingInterest.relevanceScore,
          action: 'updated'
        });
      } else {
        user.healthInterests.push({
          topic: topic.topic,
          relevanceScore: 70,
          lastEngaged: new Date(),
          contentTypePreferences: ['article', 'tips', 'guide']
        });
        updatedTopics.push({
          topic: topic.topic,
          relevanceScore: 70,
          action: 'added'
        });
      }
    });

    await user.save();
    console.log('✅ Health interests updated, total interests:', user.healthInterests.length);

    const topInterests = user.getTopHealthInterests(5);

    res.status(200).json({
      success: true,
      data: {
        updatedTopics,
        topInterests,
        totalInterests: user.healthInterests.length
      }
    });

  } catch (error) {
    console.error('❌ Update interests API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update health interests',
      error: error.message
    });
  }
};
