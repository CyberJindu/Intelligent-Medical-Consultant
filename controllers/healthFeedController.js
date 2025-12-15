import HealthPost from '../models/HealthPost.js';
import User from '../models/User.js';
import { generatePersonalizedContent, getPersonalizedContentQuery } from '../utils/contentGenerator.js';

// Get personalized health feed based on user's conversation topics
export const getPersonalizedFeed = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get personalized query for this user
    const { query, sort, limit } = await getPersonalizedContentQuery(userId, 15);
    
    // Fetch content with personalized query
    const feed = await HealthPost.find(query)
      .select('title content excerpt author authorType publishDate readTime topics image shareCount saveCount')
      .sort(sort)
      .limit(limit);

    // Personalize the feed with relevance scores
    const personalizedFeed = await generatePersonalizedContent(feed, userId);

    res.status(200).json({
      success: true,
      data: { 
        feed: personalizedFeed,
        generatedAt: new Date(),
        personalizationLevel: personalizedFeed.length > 0 ? 'high' : 'medium'
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
    
    // Also fetch user to check if these are their interests
    const user = await User.findById(userId);
    const isUserInterest = user ? 
      topicArray.some(topic => 
        user.conversationTopics?.some(ct => ct.topic.includes(topic))
      ) : false;
    
    const feed = await HealthPost.find({
      topics: { $in: topicArray },
      isActive: true
    })
    .select('title content excerpt author authorType publishDate readTime topics image shareCount saveCount')
    .sort({ publishDate: -1 })
    .limit(15);

    // Personalize even topic-based feeds
    const personalizedFeed = await generatePersonalizedContent(feed, userId);

    res.status(200).json({
      success: true,
      data: { 
        feed: personalizedFeed,
        topics: topicArray,
        isUserInterest: isUserInterest
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

// Save article for later (update user's interests)
export const saveArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.userId;

    const article = await HealthPost.findById(articleId);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Increment save count on article
    article.saveCount += 1;
    await article.save();

    // Update user's interests based on article topics
    const user = await User.findById(userId);
    if (user && article.topics && article.topics.length > 0) {
      const newTopics = article.topics.map(topic => ({
        topic: topic.toLowerCase(),
        category: 'wellness',
        severity: 'informational'
      }));
      
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

// Share article (track engagement)
export const shareArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.userId;

    const article = await HealthPost.findById(articleId);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Increment share count
    article.shareCount += 1;
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
        shareCount: article.shareCount
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
