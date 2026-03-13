import GeneratedContent from '../models/GeneratedContent.js';
import HealthPost from '../models/HealthPost.js';
import User from '../models/User.js';
import Specialist from '../models/Specialist.js';
import model from '../config/gemini.js';

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
      .slice(0, 15)
      .map(t => t.topic);

    console.log('🎯 User conversation topics:', recentConversations);

    // FETCH FROM BOTH COLLECTIONS - NO FILTERS, GET EVERYTHING!
    console.log('📡 Fetching ALL content from both collections...');
    
    // 1. Get ALL GeneratedContent (both published and drafts)
    const generatedContent = await GeneratedContent.find({})
      .populate('specialistId', 'name specialty')
      .sort({ generatedAt: -1 })
      .limit(50); // Increased limit to get more content

    // 2. Get ALL HealthPost (both active and inactive)
    const healthPosts = await HealthPost.find({})
      .sort({ publishDate: -1 })
      .limit(50);

    console.log(`📊 GeneratedContent: ${generatedContent.length} items total`);
    console.log(`📊 HealthPost: ${healthPosts.length} items total`);
    
    // Combine both collections
    let allContent = [...generatedContent, ...healthPosts];
    
    // Log what we got
    console.log(`📊 TOTAL available content: ${allContent.length} items`);
    
    // Separate by publish status for debugging
    const publishedGen = generatedContent.filter(c => c.isPublished === true).length;
    const draftGen = generatedContent.filter(c => c.isPublished === false).length;
    console.log(`📊 GeneratedContent breakdown: ${publishedGen} published, ${draftGen} drafts`);

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
    // Prepare content summaries for Gemini
    const contentSummaries = allContent.slice(0, 40).map((content, index) => {
      const isGenerated = !!content.specialistId;
      
      // Extract topics based on content type
      let topics = [];
      if (isGenerated) {
        topics = [
          content.topic,
          ...(content.keywords || [])
        ].filter(Boolean);
      } else {
        topics = content.topics || [];
      }
      
      // If no topics found, use title words as fallback
      if (topics.length === 0 && content.title) {
        topics = content.title.split(' ').filter(word => word.length > 3);
      }
      
      return {
        id: index,
        title: content.title || 'Health Article',
        topic: topics[0] || 'health',
        keywords: topics,
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
- Direct topic matches
- Related medical concepts
- User's likely interests
- Educational value

Return a JSON array with objects containing:
- contentId: number (the id field from above)
- relevanceScore: number (0-100)
- reason: string (brief explanation)
- matchingTopics: array of strings (which user topics this content matches)

Return ONLY the JSON array, no other text.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON array with better error handling
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Validate and clean the analysis
        return analysis
          .filter(item => item && typeof item.relevanceScore === 'number')
          .map(item => ({
            content: allContent[item.contentId],
            relevanceScore: Math.min(100, Math.max(0, item.relevanceScore)),
            reason: item.reason || 'Matches your interests',
            matchingTopics: item.matchingTopics || []
          }));
      } catch (parseError) {
        console.error('❌ Failed to parse Gemini JSON:', parseError);
        console.log('📝 Raw response:', text.substring(0, 300));
        return fallbackContentAnalysis(userTopics, allContent);
      }
    }

    return fallbackContentAnalysis(userTopics, allContent);

  } catch (error) {
    console.error('Gemini content analysis error:', error);
    return fallbackContentAnalysis(userTopics, allContent);
  }
};

/**
 * Fallback content analysis when Gemini is unavailable
 */
const fallbackContentAnalysis = (userTopics, allContent) => {
  const userTopicSet = new Set(userTopics.map(t => t.toLowerCase()));
  
  return allContent.map(content => {
    let score = 20; // Higher base score
    const contentTopics = [];
    
    // Extract topics from title
    if (content.title) {
      content.title.toLowerCase().split(' ').forEach(word => {
        if (word.length > 3) contentTopics.push(word);
      });
    }
    
    // Add content-specific topics
    if (content.topic) contentTopics.push(content.topic.toLowerCase());
    if (content.keywords) contentTopics.push(...content.keywords.map(k => k.toLowerCase()));
    if (content.topics) contentTopics.push(...content.topics.map(t => t.toLowerCase()));
    
    // Count semantic matches
    const matches = [];
    contentTopics.forEach(topic => {
      userTopics.forEach(userTopic => {
        const userTopicLower = userTopic.toLowerCase();
        if (topic.includes(userTopicLower) || userTopicLower.includes(topic)) {
          matches.push(userTopic);
        }
      });
    });
    
    const uniqueMatches = [...new Set(matches)];
    score += uniqueMatches.length * 15;
    
    // Recency bonus
    const publishDate = content.generatedAt || content.publishDate || new Date();
    const daysOld = (Date.now() - new Date(publishDate)) / (1000 * 60 * 60 * 24);
    if (daysOld < 7) score += 25;
    else if (daysOld < 30) score += 15;
    else if (daysOld < 90) score += 5;
    
    return {
      content,
      relevanceScore: Math.min(100, score),
      reason: uniqueMatches.length > 0 
        ? `Related to: ${uniqueMatches.slice(0, 3).join(', ')}` 
        : 'General health content',
      matchingTopics: uniqueMatches
    };
  });
};

/**
 * Format content for feed display (handles both GeneratedContent and HealthPost)
 */
const formatFeedContent = async (contents) => {
  console.log(`🎨 Formatting ${contents.length} contents for feed`);

  // First, separate content by type
  const generatedItems = contents.filter(c => c.specialistId);
  const healthPostItems = contents.filter(c => !c.specialistId);
  
  console.log(`📊 Found ${generatedItems.length} GeneratedContent items, ${healthPostItems.length} HealthPost items`);

  // Get specialist details for GeneratedContent items
  const specialistIds = generatedItems
    .map(content => content.specialistId?._id || content.specialistId)
    .filter(id => id);
  
  const specialists = await Specialist.find({ _id: { $in: specialistIds } })
    .select('name specialty')
    .lean();
  
  const specialistMap = {};
  specialists.forEach(spec => {
    specialistMap[spec._id.toString()] = spec;
  });

  // Process all contents
  const formatted = [];

  // 1. Process GeneratedContent items
  for (const content of generatedItems) {
    const specialist = content.specialistId?._id 
      ? specialistMap[content.specialistId._id.toString()]
      : specialistMap[content.specialistId?.toString()];
    
    // Calculate read time
    const wordCount = content.content ? content.content.split(/\s+/).length : 0;
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
    
    // Create excerpt
    let excerpt = content.excerpt || '';
    if (!excerpt && content.content) {
      const plainText = content.content
        .replace(/#{1,6}\s?/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .trim();
      excerpt = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');
    }
    
    // Collect topics
    const contentTopics = [];
    if (content.topic) contentTopics.push(content.topic);
    if (content.keywords && Array.isArray(content.keywords)) {
      contentTopics.push(...content.keywords);
    }
    if (content.feedTopics && Array.isArray(content.feedTopics)) {
      contentTopics.push(...content.feedTopics);
    }
    
    formatted.push({
      _id: content._id,
      title: content.title || 'Health Article',
      content: content.content || '',
      excerpt: excerpt || content.content?.substring(0, 150) + '...' || 'Click to read',
      author: specialist ? `Dr. ${specialist.name}` : (content.authorName || 'Healthcare Specialist'),
      authorType: 'verified_specialist',
      authorSpecialty: specialist?.specialty || content.authorSpecialty || '',
      publishDate: content.generatedAt || new Date(),
      readTime: content.readTime || `${readTimeMinutes} min read`,
      topics: [...new Set(contentTopics)].slice(0, 5),
      relevanceScore: content.relevanceScore || 50,
      relevanceReason: content.relevanceReason || '',
      matchingTopics: content.matchingTopics || [],
      isSpecialistContent: true,
      source: 'generated',
      isPublished: content.isPublished // Include publish status for debugging
    });
  }

  // 2. Process HealthPost items
  for (const content of healthPostItems) {
    // Calculate read time
    const wordCount = content.content ? content.content.split(/\s+/).length : 0;
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
    
    // Create excerpt
    let excerpt = content.excerpt || '';
    if (!excerpt && content.content) {
      const plainText = content.content
        .replace(/#{1,6}\s?/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .trim();
      excerpt = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');
    }
    
    formatted.push({
      _id: content._id,
      title: content.title || 'Health Article',
      content: content.content || '',
      excerpt: excerpt || content.content?.substring(0, 150) + '...' || 'Click to read',
      author: content.author || 'MediGuide Health Team',
      authorType: 'health_team',
      authorSpecialty: '',
      publishDate: content.publishDate || new Date(),
      readTime: content.readTime || `${readTimeMinutes} min read`,
      topics: (content.topics && Array.isArray(content.topics)) ? content.topics.slice(0, 5) : ['health', 'wellness'],
      relevanceScore: content.relevanceScore || 50,
      relevanceReason: content.relevanceReason || '',
      matchingTopics: content.matchingTopics || [],
      isSpecialistContent: false,
      source: 'healthpost'
    });
  }

  // Sort by relevance score (higher first)
  return formatted.sort((a, b) => b.relevanceScore - a.relevanceScore);
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
    
    // Fetch from GeneratedContent - GET ALL, not just published
    const feed = await GeneratedContent.find({
      $or: [
        { topic: { $in: topicArray } },
        { keywords: { $in: topicArray } },
        { title: { $regex: topicArray.join('|'), $options: 'i' } }
      ]
    })
    .populate('specialistId', 'name specialty')
    .sort({ generatedAt: -1 })
    .limit(20);

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
        author: specialist ? `Dr. ${specialist.name}` : (content.authorName || 'Healthcare Specialist'),
        authorType: 'verified_specialist',
        publishDate: content.generatedAt,
        readTime: content.readTime || `${Math.ceil(content.content?.length / 1000) || 5} min read`,
        topics: contentTopics.slice(0, 5),
        specialistSpecialty: specialist?.specialty || content.authorSpecialty || '',
        isSpecialistContent: true,
        relevanceScore,
        matchingTopics: topicArray.filter(topic => 
          content.topic?.toLowerCase().includes(topic.toLowerCase()) || 
          content.keywords?.some(k => k.toLowerCase().includes(topic.toLowerCase())) ||
          content.title?.toLowerCase().includes(topic.toLowerCase())
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

    article.saveCount = (article.saveCount || 0) + 1;
    await article.save();

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
    
    const formattedTopics = topics.map(topic => ({
      topic: topic.toLowerCase(),
      category: 'wellness',
      severity: 'informational',
      context: context || 'From conversation'
    }));
    
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

    article.shares = (article.shares || 0) + 1;
    await article.save();

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
  
  const contentTopics = [];
  if (content.topic) contentTopics.push(content.topic);
  if (content.keywords && Array.isArray(content.keywords)) {
    contentTopics.push(...content.keywords);
  }
  if (content.title) {
    content.title.toLowerCase().split(' ').forEach(word => {
      if (word.length > 3) contentTopics.push(word);
    });
  }
  
  const matchingTopics = contentTopics.filter(topic => 
    userTopics.some(userTopic => 
      topic.toLowerCase().includes(userTopic.toLowerCase()) ||
      userTopic.toLowerCase().includes(topic.toLowerCase())
    )
  );
  
  score += Math.min(matchingTopics.length * 15, 60);
  
  const daysOld = (new Date() - (content.generatedAt || content.publishDate || new Date())) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 40 - (daysOld * 1.5));
  
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
  if (content.title) {
    content.title.toLowerCase().split(' ').forEach(word => {
      if (word.length > 3) contentTopics.push(word);
    });
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
