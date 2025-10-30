import HealthPost from '../models/HealthPost.js';
import { generatePersonalizedContent } from '../utils/contentGenerator.js';

// Get personalized health feed
export const getPersonalizedFeed = async (req, res) => {
  try {
    const userId = req.userId;
    
    // In a real app, we'd analyze user's chat history for interests
    // For now, we'll return general health content
    const feed = await HealthPost.find({ isActive: true })
      .select('title content excerpt author publishDate readTime topics image')
      .sort({ publishDate: -1 })
      .limit(10);

    // If we have user data, we could personalize this further
    const personalizedFeed = await generatePersonalizedContent(feed, userId);

    res.status(200).json({
      success: true,
      data: { 
        feed: personalizedFeed,
        generatedAt: new Date()
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

// Get feed by topics
export const getFeedByTopics = async (req, res) => {
  try {
    const { topics } = req.query;
    
    if (!topics) {
      return res.status(400).json({
        success: false,
        message: 'Topics are required'
      });
    }

    const topicArray = Array.isArray(topics) ? topics : [topics];
    
    const feed = await HealthPost.find({
      topics: { $in: topicArray },
      isActive: true
    })
    .select('title content excerpt author publishDate readTime topics image')
    .sort({ publishDate: -1 })
    .limit(15);

    res.status(200).json({
      success: true,
      data: { 
        feed,
        topics: topicArray
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

// Save article for later
export const saveArticle = async (req, res) => {
  try {
    const { articleId } = req.params;
    const userId = req.userId;

    // This would typically update user's saved articles
    // For now, we'll just return success
    // In a real implementation, we'd have a UserSavedArticles model

    res.status(200).json({
      success: true,
      message: 'Article saved successfully'
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

// Share article
export const shareArticle = async (req, res) => {
  try {
    const { articleId } = req.params;

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