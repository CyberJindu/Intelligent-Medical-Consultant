import HealthPost from '../models/HealthPost.js';
import User from '../models/User.js';

/**
 * Generate personalized health content based on user's ACTUAL conversation topics
 * NOW WORKS WITH GENERATEDCONTENT
 */
export const generatePersonalizedContent = async (baseFeed, userId) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('User not found for personalization, returning base feed');
      return baseFeed;
    }
    
    const userInterests = user.getTopHealthInterests(10);
    const userTopics = userInterests.map(interest => interest.topic);
    
    if (userTopics.length === 0) {
      return baseFeed.map(post => ({
        ...post,
        relevanceScore: 10,
        isNew: isContentNew(post, userId),
        reason: 'No user topics yet'
      }));
    }
    
    console.log('Personalizing for user topics:', userTopics);
    
    const personalizedFeed = baseFeed.map(post => {
      const relevanceScore = calculateRelevanceScore(post, userTopics, userInterests);
      const matchingTopics = findMatchingTopics(post, userTopics);
      
      return {
        ...post,
        relevanceScore,
        isNew: isContentNew(post, userId),
        matchingTopics,
        matchPercentage: Math.round((matchingTopics.length / userTopics.length) * 100)
      };
    });

    personalizedFeed.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return personalizedFeed;

  } catch (error) {
    console.error('Content personalization error:', error);
    return baseFeed.map(post => ({
      ...post,
      relevanceScore: 20,
      isNew: isContentNew(post, userId),
      reason: 'Personalization error'
    }));
  }
};

/**
 * Calculate REAL relevance score based on ACTUAL user topics
 */
const calculateRelevanceScore = (post, userTopics, userInterests) => {
  let score = 0;
  
  // 1. Topic Matching (40 points max)
  const postTopics = post.topics || post.feedTopics || [];
  const matchingTopics = postTopics.filter(topic => 
    userTopics.some(userTopic => 
      topic.toLowerCase().includes(userTopic.toLowerCase()) ||
      userTopic.toLowerCase().includes(topic.toLowerCase())
    )
  );
  
  score += Math.min(matchingTopics.length * 10, 40);
  
  // 2. Recency (30 points max)
  const publishDate = post.publishDate || post.generatedAt;
  const daysOld = (new Date() - new Date(publishDate)) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 30 - (daysOld * 1.5));
  
  // 3. Content Quality Signals (20 points max)
  const engagement = post.engagement || {};
  score += Math.min((engagement.shares || 0) * 0.2, 10);
  score += Math.min((engagement.likes || 0) * 0.4, 10);
  
  // 4. Author Credibility (10 points)
  if (post.isSpecialistContent || post.authorType === 'verified_specialist') {
    score += 10;
  }
  
  // 5. User Interest Relevance (extra 0-20 points based on interest scores)
  if (userInterests && userInterests.length > 0) {
    let interestBonus = 0;
    userInterests.forEach(interest => {
      if (postTopics.some(topic => 
        topic.toLowerCase().includes(interest.topic.toLowerCase()) ||
        interest.topic.toLowerCase().includes(topic.toLowerCase())
      )) {
        interestBonus += Math.min(interest.relevanceScore / 10, 5);
      }
    });
    score += Math.min(interestBonus, 20);
  }
  
  return Math.round(Math.min(score, 100));
};

/**
 * Find which user topics match the content
 */
const findMatchingTopics = (post, userTopics) => {
  const postTopics = post.topics || post.feedTopics || [];
  const matching = [];
  
  postTopics.forEach(postTopic => {
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

/**
 * Check if content is new for the user
 */
const isContentNew = (post, userId) => {
  const publishDate = post.publishDate || post.generatedAt;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return new Date(publishDate) > sevenDaysAgo;
};

/**
 * Get personalized content query for user
 */
export const getPersonalizedContentQuery = async (userId, limit = 10) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return {
        query: { isPublished: true, isActive: true },
        sort: { generatedAt: -1 },
        limit
      };
    }
    
    const userInterests = user.getTopHealthInterests(5);
    const userTopics = userInterests.map(interest => interest.topic);
    
    if (userTopics.length === 0) {
      return {
        query: { isPublished: true, isActive: true },
        sort: { generatedAt: -1 },
        limit
      };
    }
    
    return {
      query: {
        isPublished: true,
        isActive: true,
        $or: [
          { topic: { $in: userTopics } },
          { keywords: { $in: userTopics } },
          { 
            $or: userTopics.map(topic => ({
              title: { $regex: topic, $options: 'i' }
            }))
          }
        ]
      },
      sort: { generatedAt: -1 },
      limit
    };
    
  } catch (error) {
    console.error('Personalized query error:', error);
    return {
      query: { isPublished: true, isActive: true },
      sort: { generatedAt: -1 },
      limit
    };
  }
};

/**
 * Generate health content topics based on common medical issues
 */
export const generateHealthTopics = () => {
  return [
    'Headache Management',
    'Stress Relief',
    'Healthy Sleep',
    'Nutrition Tips',
    'Exercise Benefits',
    'Allergy Management',
    'Cold and Flu',
    'Mental Wellness',
    'Heart Health',
    'Diabetes Prevention',
    'Weight Management',
    'Skin Care',
    'Digestive Health',
    'Women Health',
    'Men Health',
    'Child Health',
    'Elderly Care',
    'First Aid',
    'Vaccination',
    'Preventive Care'
  ];
};

/**
 * Create sample health content for the feed (DISABLED - USING REAL CONTENT)
 */
export const createSampleHealthContent = async () => {
  console.log('⚠️ Sample content creation is disabled. Using real specialist-generated content only.');
  return;
};
