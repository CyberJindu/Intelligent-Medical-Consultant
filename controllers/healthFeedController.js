import GeneratedContent from '../models/GeneratedContent.js';
import User from '../models/User.js';
import Specialist from '../models/Specialist.js'; // ADD THIS IMPORT

// Get personalized health feed DIRECTLY from GeneratedContent
export const getPersonalizedFeed = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get user's topics for personalization
    const user = await User.findById(userId);
    const userTopics = user ? user.getTopHealthInterests(5).map(interest => interest.topic) : [];
    
    console.log('🎯 User topics for personalization:', userTopics);
    
    // Build SIMPLE query - NO isActive, NO feedTopics
    let query = { isPublished: true };
    
    if (userTopics.length > 0) {
      query.$or = [
        { topic: { $in: userTopics } },
        { keywords: { $in: userTopics } },
        { 
          $or: userTopics.map(topic => ({
            title: { $regex: topic, $options: 'i' }
          }))
        }
      ];
    }
    
    console.log('🔍 Query:', JSON.stringify(query, null, 2));
    
    // Fetch content - ONLY SELECT FIELDS THAT ACTUALLY EXIST
    const feed = await GeneratedContent.find(query)
      .populate('specialistId', 'name specialty')
      .select('title content contentType topic targetAudience tone wordCount keywords generatedAt lastModified isPublished')
      .sort({ generatedAt: -1 })
      .limit(20);

    console.log('📊 Found', feed.length, 'contents for feed');
    
    // Get specialist names for all contents
    const specialistIds = [...new Set(feed.map(content => content.specialistId))];
    const specialists = await Specialist.find({ _id: { $in: specialistIds } })
      .select('name specialty')
      .lean();
    
    const specialistMap = {};
    specialists.forEach(spec => {
      specialistMap[spec._id.toString()] = spec;
    });
    
    // Format for feed display - USE ONLY ACTUAL FIELDS
    const formattedFeed = await Promise.all(feed.map(async (content) => {
      const relevanceScore = calculateRelevanceScore(content, userTopics);
      const matchingTopics = findMatchingTopics(content, userTopics);
      
      const specialist = specialistMap[content.specialistId?._id?.toString() || content.specialistId?.toString()];
      
      // Calculate read time from content length
      const wordCount = content.content ? content.content.split(/\s+/).length : 0;
      const readTimeMinutes = Math.ceil(wordCount / 200);
      
      // Create topics array from actual fields
      const contentTopics = [];
      if (content.topic) contentTopics.push(content.topic.toLowerCase());
      if (content.keywords && Array.isArray(content.keywords)) {
        content.keywords.forEach(kw => {
          if (kw && typeof kw === 'string') contentTopics.push(kw.toLowerCase());
        });
      }
      if (content.contentType) contentTopics.push(content.contentType.toLowerCase().replace('_', ' '));
      
      // Add common health categories
      const healthCategories = ['health', 'wellness', 'medical'];
      healthCategories.forEach(cat => contentTopics.push(cat));
      
      // Remove duplicates and limit
      const uniqueTopics = [...new Set(contentTopics)].slice(0, 6);
      
      return {
        _id: content._id,
        title: content.title,
        content: content.content,
        excerpt: content.content ? content.content.substring(0, 200) + (content.content.length > 200 ? '...' : '') : '',
        author: specialist ? `Dr. ${specialist.name}` : 'Healthcare Specialist',
        authorType: 'verified_specialist',
        publishDate: content.generatedAt,
        readTime: `${readTimeMinutes} min read`,
        topics: uniqueTopics,
        specialistSpecialty: specialist?.specialty || '',
        isSpecialistContent: true,
        relevanceScore,
        matchingTopics,
        matchPercentage: Math.round((matchingTopics.length / Math.max(userTopics.length, 1)) * 100)
      };
    }));

    // Sort by relevance
    formattedFeed.sort((a, b) => b.relevanceScore - a.relevanceScore);

    res.status(200).json({
      success: true,
      data: { 
        feed: formattedFeed,
        generatedAt: new Date(),
        personalizationLevel: userTopics.length > 0 ? 'high' : 'medium',
        userTopicsCount: userTopics.length,
        feedSource: 'generated_content',
        totalContents: feed.length
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

// Keep saveArticle, updateUserTopics, and shareArticle functions exactly as they are
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
