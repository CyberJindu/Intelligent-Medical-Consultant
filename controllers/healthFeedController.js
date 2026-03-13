import GeneratedContent from '../models/GeneratedContent.js';
import HealthPost from '../models/HealthPost.js';
import User from '../models/User.js';
import Specialist from '../models/Specialist.js';
import model from '../config/gemini.js';

// Get personalized health feed using GEMINI for intelligent matching
// Get personalized health feed using GEMINI for intelligent matching
export const getPersonalizedFeed = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get user with their conversation topics
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's conversation topics (the raw material for Gemini)
    const conversationTopics = user.conversationTopics || [];
    const recentConversations = conversationTopics
      .sort((a, b) => b.lastMentioned - a.lastMentioned)
      .slice(0, 15) // Get last 15 topics
      .map(t => t.topic);

    console.log('🎯 User conversation topics:', recentConversations);

    // FETCH FROM BOTH COLLECTIONS
    console.log('📡 Fetching content from both collections...');
    
    // 1. Get from GeneratedContent
    const generatedContent = await GeneratedContent.find({ 
      isPublished: true,
      isActive: true 
    })
    .populate('specialistId', 'name specialty')
    .sort({ generatedAt: -1 })
    .limit(30);

    // 2. Get from HealthPost
    const healthPosts = await HealthPost.find({ 
      isActive: true 
    })
    .sort({ publishDate: -1 })
    .limit(30);

    console.log(`📊 GeneratedContent: ${generatedContent.length} items`);
    console.log(`📊 HealthPost: ${healthPosts.length} items`);
    
    // Combine both collections
    let allContent = [...generatedContent, ...healthPosts];
    
    // Shuffle to mix content from both sources
    allContent = allContent.sort(() => Math.random() - 0.5);
    
    // Limit total to 50 items
    allContent = allContent.slice(0, 50);
    
    console.log(`📊 TOTAL available content: ${allContent.length} items`);

    // If no content, return empty
    if (allContent.length === 0) {
      return res.status(200).json({
        success: true,
        data: { 
          feed: [],
          message: 'No content available yet'
        }
      });
    }

    // If user has no conversation history, show most recent content
    if (recentConversations.length === 0) {
      const formattedFeed = await formatFeedContent(allContent.slice(0, 20));
      
      return res.status(200).json({
        success: true,
        data: { 
          feed: formattedFeed,
          generatedAt: new Date(),
          personalizationLevel: 'low',
          message: 'Showing latest content. Start chatting to get personalized recommendations!'
        }
      });
    }

    // Use GEMINI to intelligently match content to user's conversations
    const geminiAnalysis = await analyzeContentWithGemini(recentConversations, allContent);
    
    // Sort by Gemini's relevance scores
    const scoredContent = geminiAnalysis.map(item => ({
      ...item.content,
      relevanceScore: item.relevanceScore,
      relevanceReason: item.reason,
      matchingTopics: item.matchingTopics
    }));

    // Sort by score and take top 20
    const topContent = scoredContent
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);

    // Format for feed display
    const formattedFeed = await formatFeedContent(topContent);

    res.status(200).json({
      success: true,
      data: { 
        feed: formattedFeed,
        generatedAt: new Date(),
        personalizationLevel: 'high',
        totalAnalyzed: allContent.length,
        userTopicsCount: recentConversations.length,
        debug: {
          userTopics: recentConversations,
          geminiScores: geminiAnalysis.map(a => ({ 
            title: a.content.title, 
            score: a.relevanceScore,
            reason: a.reason 
          }))
        }
      }
    });

  } catch (error) {
    console.error('Health feed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch health feed',
      error: error.message
    });
  }
};

/**
 * Use Gemini to analyze content relevance based on user conversations
 */
const analyzeContentWithGemini = async (userTopics, allContent) => {
  try {
    // Prepare content summaries for Gemini (limit to avoid token limits)
    const contentSummaries = allContent.slice(0, 30).map((content, index) => {
      const isGenerated = !!content.specialistId;
      return {
        id: index,
        title: content.title || 'Untitled',
        topic: content.topic || (content.topics ? content.topics[0] : 'health'),
        keywords: content.keywords || content.topics || [],
        summary: content.content ? content.content.substring(0, 200) : ''
      };
    });

    const prompt = `
You are a medical content recommendation expert. Your task is to match health content to a user based on their conversation history.

USER'S CONVERSATION TOPICS (what they've discussed):
${userTopics.map(t => `- ${t}`).join('\n')}

AVAILABLE CONTENT (each with ID, title, topic, keywords, and summary):
${JSON.stringify(contentSummaries, null, 2)}

Analyze each piece of content and determine how relevant it is to the user's conversation topics. Consider:
- Direct topic matches (if they discussed headaches, headache articles are highly relevant)
- Related topics (if they discussed stress, anxiety articles might be relevant)
- User's likely interests based on conversation patterns
- Educational value and appropriateness

Return a JSON array with objects containing:
- contentId: number (the id field from above)
- relevanceScore: number (0-100, how relevant this content is to the user)
- reason: string (brief explanation of why this content matches)
- matchingTopics: array of strings (which user topics this content matches)

Be thoughtful and intelligent in your matching. Some content might be relevant even without exact keyword matches.

Return ONLY the JSON array, no other text.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      
      // Map back to actual content objects
      return analysis.map(item => ({
        content: allContent[item.contentId],
        relevanceScore: item.relevanceScore,
        reason: item.reason,
        matchingTopics: item.matchingTopics || []
      }));
    }

    // Fallback if Gemini fails
    return fallbackContentAnalysis(userTopics, allContent);

  } catch (error) {
    console.error('Gemini content analysis error:', error);
    
    // If Gemini is overloaded, use fallback
    if (error.message.includes('503') || error.message.includes('overloaded')) {
      console.log('⚠️ Gemini overloaded, using fallback analysis');
      return fallbackContentAnalysis(userTopics, allContent);
    }
    
    return fallbackContentAnalysis(userTopics, allContent);
  }
};

/**
 * Fallback content analysis when Gemini is unavailable
 */
const fallbackContentAnalysis = (userTopics, allContent) => {
  const userTopicSet = new Set(userTopics.map(t => t.toLowerCase()));
  
  return allContent.map(content => {
    let score = 10; // Base score
    const contentTopics = [];
    
    if (content.topic) contentTopics.push(content.topic.toLowerCase());
    if (content.keywords) contentTopics.push(...content.keywords.map(k => k.toLowerCase()));
    
    // Count matches
    const matches = contentTopics.filter(topic => 
      Array.from(userTopicSet).some(userTopic => 
        topic.includes(userTopic) || userTopic.includes(topic)
      )
    );
    
    score += matches.length * 15;
    
    // Recency bonus
    const daysOld = (Date.now() - new Date(content.generatedAt)) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) score += 20;
    else if (daysOld < 30) score += 10;
    
    return {
      content,
      relevanceScore: Math.min(100, score),
      reason: matches.length > 0 
        ? `Matches topics: ${matches.join(', ')}` 
        : 'General health content',
      matchingTopics: matches
    };
  });
};

/**
 * Format content for feed display (works for both GeneratedContent and HealthPost)
 */
const formatFeedContent = async (contents) => {
  // Get all specialist IDs (only for GeneratedContent items)
  const specialistIds = contents
    .filter(content => content.specialistId) // Only items with specialistId
    .map(content => content.specialistId?._id || content.specialistId)
    .filter(id => id);
  
  // Fetch specialist details
  const specialists = await Specialist.find({ _id: { $in: specialistIds } })
    .select('name specialty')
    .lean();
  
  const specialistMap = {};
  specialists.forEach(spec => {
    specialistMap[spec._id.toString()] = spec;
  });

  return contents.map(content => {
    // Determine if this is GeneratedContent or HealthPost
    const isGenerated = !!content.specialistId;
    
    // Extract fields based on content type
    const title = content.title || 'Untitled Health Article';
    const contentText = content.content || '';
    
    // Handle date field (different names in each collection)
    const publishDate = isGenerated ? content.generatedAt : content.publishDate;
    
    // Handle author field
    let author = 'Healthcare Specialist';
    let authorSpecialty = '';
    
    if (isGenerated) {
      const specialist = content.specialistId?._id 
        ? specialistMap[content.specialistId._id.toString()]
        : specialistMap[content.specialistId?.toString()];
      
      author = specialist ? `Dr. ${specialist.name}` : (content.authorName || 'Healthcare Specialist');
      authorSpecialty = specialist?.specialty || content.authorSpecialty || '';
    } else {
      author = content.author || 'MediGuide Health Team';
    }
    
    // Calculate read time properly
    const wordCount = contentText ? contentText.split(/\s+/).length : 0;
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
    
    // Create excerpt
    let excerpt = '';
    if (content.excerpt && content.excerpt !== '...' && content.excerpt.length > 10) {
      excerpt = content.excerpt;
    } else if (contentText) {
      // Clean markdown and trim
      const plainText = contentText
        .replace(/#{1,6}\s?/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .trim();
      excerpt = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');
    } else {
      excerpt = 'Click to read this informative health article';
    }
    
    // Extract topics
    let contentTopics = [];
    if (isGenerated) {
      if (content.topic) contentTopics.push(content.topic);
      if (content.keywords && Array.isArray(content.keywords)) {
        contentTopics.push(...content.keywords);
      }
      if (content.feedTopics && Array.isArray(content.feedTopics)) {
        contentTopics.push(...content.feedTopics);
      }
    } else {
      if (content.topics && Array.isArray(content.topics)) {
        contentTopics = content.topics;
      }
    }
    
    // Ensure we have at least one topic
    if (contentTopics.length === 0) {
      contentTopics = ['health', 'wellness'];
    }
    
    // Remove duplicates and limit
    const uniqueTopics = [...new Set(contentTopics)].slice(0, 5);
    
    return {
      _id: content._id,
      title: title,
      content: contentText,
      excerpt: excerpt,
      author: author,
      authorType: isGenerated ? 'verified_specialist' : 'health_team',
      authorSpecialty: authorSpecialty,
      publishDate: publishDate || new Date(),
      readTime: `${readTimeMinutes} min read`,
      topics: uniqueTopics,
      relevanceScore: content.relevanceScore || 50,
      relevanceReason: content.relevanceReason || '',
      matchingTopics: content.matchingTopics || [],
      isSpecialistContent: isGenerated,
      source: isGenerated ? 'generated' : 'healthpost'
    };
  });
};


// Get feed by specific topics
export const getFeedByTopics = async (req, res) => {
  try {
    const { topics } = req.query;
    const userId = req.userId;
    
    if (!topics) {
      return res.status(400).json({
        success: false,
        message: 'Topics are required'
      });
    }

    const topicArray = Array.isArray(topics) ? topics : [topics];
    
    const user = await User.findById(userId);
    const isUserInterest = user ? 
      topicArray.some(topic => 
        user.conversationTopics?.some(ct => ct.topic.includes(topic))
      ) : false;
    
    // Fetch DIRECTLY from GeneratedContent - SIMPLE QUERY
    const feed = await GeneratedContent.find({
      isPublished: true,
      $or: [
        { topic: { $in: topicArray } },
        { keywords: { $in: topicArray } }
      ]
    })
    .populate('specialistId', 'name specialty')
    .select('title content topic keywords generatedAt')
    .sort({ generatedAt: -1 })
    .limit(15);

    // Get specialist names
    const specialistIds = [...new Set(feed.map(content => content.specialistId))];
    const specialists = await Specialist.find({ _id: { $in: specialistIds } })
      .select('name specialty')
      .lean();
    
    const specialistMap = {};
    specialists.forEach(spec => {
      specialistMap[spec._id.toString()] = spec;
    });

    // Format feed
    const formattedFeed = feed.map(content => {
      const relevanceScore = calculateRelevanceScore(content, topicArray);
      const specialist = specialistMap[content.specialistId?._id?.toString() || content.specialistId?.toString()];
      
      // Create topics
      const contentTopics = [];
      if (content.topic) contentTopics.push(content.topic.toLowerCase());
      if (content.keywords && Array.isArray(content.keywords)) {
        content.keywords.forEach(kw => {
          if (kw && typeof kw === 'string') contentTopics.push(kw.toLowerCase());
        });
      }
      
      return {
        _id: content._id,
        title: content.title,
        content: content.content,
        excerpt: content.content ? content.content.substring(0, 200) + '...' : '',
        author: specialist ? `Dr. ${specialist.name}` : 'Healthcare Specialist',
        authorType: 'verified_specialist',
        publishDate: content.generatedAt,
        readTime: `${Math.ceil(content.content?.length / 1000) || 5} min read`,
        topics: contentTopics,
        specialistSpecialty: specialist?.specialty || '',
        isSpecialistContent: true,
        relevanceScore,
        matchingTopics: topicArray.filter(topic => 
          content.topic?.includes(topic) || 
          content.keywords?.includes(topic)
        ).map(topic => ({ postTopic: topic, userTopic: topic, exactMatch: true }))
      };
    });

    formattedFeed.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.status(200).json({
      success: true,
      data: { 
        feed: formattedFeed,
        topics: topicArray,
        isUserInterest: isUserInterest,
        feedSource: 'generated_content'
      }
    });

  } catch (error) {
    console.error('Feed by topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feed by topics',
      error: error.message
    });
  }
};

// Track article view
export const trackView = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.userId;

    const article = await GeneratedContent.findById(articleId);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Use the model's incrementView method
    await article.incrementView(userId);

    res.status(200).json({
      success: true,
      message: 'View tracked successfully',
      data: {
        views: article.views
      }
    });

  } catch (error) {
    console.error('Track view error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track view',
      error: error.message
    });
  }
};

// Save article for later
export const saveArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.userId;

    const article = await GeneratedContent.findById(articleId);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Increment save count
    article.saveCount = (article.saveCount || 0) + 1;
    await article.save();

    // Update user's interests
    const user = await User.findById(userId);
    if (user && article.topic) {
      const newTopics = [{
        topic: article.topic.toLowerCase(),
        category: 'wellness',
        severity: 'informational'
      }];
      
      await user.updateConversationTopics(newTopics, `Saved article: ${article.title}`);
    }

    res.status(200).json({
      success: true,
      message: 'Article saved successfully',
      data: {
        saveCount: article.saveCount
      }
    });

  } catch (error) {
    console.error('Save article error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save article',
      error: error.message
    });
  }
};

export const updateUserTopics = async (req, res) => {
  try {
    const userId = req.userId;
    const { topics, context } = req.body;
    
    if (!topics || !Array.isArray(topics)) {
      return res.status(400).json({
        success: false,
        message: 'Topics array is required'
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Format topics for storage
    const formattedTopics = topics.map(topic => ({
      topic: topic.toLowerCase(),
      category: 'wellness',
      severity: 'informational',
      context: context || 'From conversation'
    }));
    
    // Save to user's conversationTopics
    await user.updateConversationTopics(formattedTopics, context);
    
    console.log(`✅ Saved ${topics.length} topics for user ${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Topics saved successfully',
      data: {
        topicsCount: topics.length,
        userTopics: user.conversationTopics.length
      }
    });
    
  } catch (error) {
    console.error('Update user topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save topics',
      error: error.message
    });
  }
};

// Share article
export const shareArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.userId;

    const article = await GeneratedContent.findById(articleId);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Increment share count
    article.shares = (article.shares || 0) + 1;
    await article.save();

    // Track user engagement
    const user = await User.findById(userId);
    if (user) {
      user.contentEngagement.push({
        contentId: articleId,
        contentType: 'article',
        engagementType: 'shared',
        timestamp: new Date()
      });
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Article shared successfully',
      data: {
        shareCount: article.shares
      }
    });

  } catch (error) {
    console.error('Share article error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share article',
      error: error.message
    });
  }
};

/**
 * Helper: Calculate relevance score
 */
const calculateRelevanceScore = (content, userTopics) => {
  let score = 0;
  
  // Topic matching
  const contentTopics = [];
  if (content.topic) contentTopics.push(content.topic);
  if (content.keywords && Array.isArray(content.keywords)) {
    contentTopics.push(...content.keywords);
  }
  
  const matchingTopics = contentTopics.filter(topic => 
    userTopics.some(userTopic => 
      topic.toLowerCase().includes(userTopic.toLowerCase()) ||
      userTopic.toLowerCase().includes(topic.toLowerCase())
    )
  );
  
  score += Math.min(matchingTopics.length * 20, 60);
  
  // Recency (40 points max)
  const daysOld = (new Date() - content.generatedAt) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 40 - (daysOld * 2));
  
  return Math.round(Math.min(score, 100));
};

/**
 * Helper: Find matching topics
 */
const findMatchingTopics = (content, userTopics) => {
  const contentTopics = [];
  if (content.topic) contentTopics.push(content.topic);
  if (content.keywords && Array.isArray(content.keywords)) {
    contentTopics.push(...content.keywords);
  }
  
  const matching = [];
  
  contentTopics.forEach(postTopic => {
    userTopics.forEach(userTopic => {
      if (postTopic.toLowerCase().includes(userTopic.toLowerCase()) ||
          userTopic.toLowerCase().includes(postTopic.toLowerCase())) {
        matching.push({
          postTopic,
          userTopic,
          exactMatch: postTopic.toLowerCase() === userTopic.toLowerCase()
        });
      }
    });
  });
  
  return matching;
};





