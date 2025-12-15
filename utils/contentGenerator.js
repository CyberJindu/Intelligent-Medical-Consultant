import HealthPost from '../models/HealthPost.js';
import User from '../models/User.js';
import { analyzeConversationForSpecialty } from './geminiHelper.js';

/**
 * Generate personalized health content based on user's ACTUAL conversation topics
 */
export const generatePersonalizedContent = async (baseFeed, userId) => {
  try {
    // 🔥 FIXED: Get REAL user data
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('User not found for personalization, returning base feed');
      return baseFeed;
    }
    
    // Get user's top health interests from conversation topics
    const userInterests = user.getTopHealthInterests(10);
    const userTopics = userInterests.map(interest => interest.topic);
    
    // If user has no topics yet, return base feed
    if (userTopics.length === 0) {
      console.log('No user topics found for personalization');
      return baseFeed.map(post => ({
        ...post.toObject(),
        relevanceScore: 10, // Base score for new users
        isNew: isContentNew(post, userId),
        reason: 'No user topics yet'
      }));
    }
    
    console.log('Personalizing for user topics:', userTopics);
    
    // 🔥 FIXED: Calculate REAL relevance scores based on user topics
    const personalizedFeed = baseFeed.map(post => {
      const relevanceScore = calculateRelevanceScore(post, userTopics, userInterests);
      const matchingTopics = findMatchingTopics(post, userTopics);
      
      return {
        ...post.toObject(),
        relevanceScore,
        isNew: isContentNew(post, userId),
        matchingTopics, // Which user topics matched this content
        matchPercentage: Math.round((matchingTopics.length / userTopics.length) * 100)
      };
    });

    // Sort by relevance score (highest first)
    personalizedFeed.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return personalizedFeed;

  } catch (error) {
    console.error('Content personalization error:', error);
    // Return base feed with fallback scores
    return baseFeed.map(post => ({
      ...post.toObject(),
      relevanceScore: 20,
      isNew: isContentNew(post, userId),
      reason: 'Personalization error'
    }));
  }
};

/**
 * 🔥 FIXED: Calculate REAL relevance score based on ACTUAL user topics
 */
const calculateRelevanceScore = (post, userTopics, userInterests) => {
  let score = 0;
  
  // 1. Topic Matching (40 points max)
  const postTopics = post.topics || [];
  const matchingTopics = postTopics.filter(topic => 
    userTopics.some(userTopic => 
      topic.toLowerCase().includes(userTopic.toLowerCase()) ||
      userTopic.toLowerCase().includes(topic.toLowerCase())
    )
  );
  
  score += Math.min(matchingTopics.length * 10, 40);
  
  // 2. Recency (30 points max)
  const daysOld = (new Date() - post.publishDate) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 30 - (daysOld * 1.5)); // Lose 1.5 points per day
  
  // 3. Content Quality Signals (20 points max)
  score += Math.min(post.shareCount * 0.2, 10);
  score += Math.min(post.saveCount * 0.4, 10);
  
  // 4. Author Credibility (10 points)
  if (post.authorType === 'verified_specialist') {
    score += 10;
  } else if (post.authorType === 'medical_expert') {
    score += 5;
  }
  
  // 5. User Interest Relevance (extra 0-20 points based on interest scores)
  if (userInterests && userInterests.length > 0) {
    let interestBonus = 0;
    userInterests.forEach(interest => {
      if (postTopics.some(topic => 
        topic.toLowerCase().includes(interest.topic.toLowerCase()) ||
        interest.topic.toLowerCase().includes(topic.toLowerCase())
      )) {
        // Add bonus based on how relevant this topic is to the user
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
  const postTopics = post.topics || [];
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
  // In real implementation, check user's read history
  // For now, consider content from last 7 days as new
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return post.publishDate > sevenDaysAgo;
};

/**
 * 🔥 NEW: Get personalized content query for user
 */
export const getPersonalizedContentQuery = async (userId, limit = 10) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      // Return general content for non-existent users
      return {
        query: { isActive: true },
        sort: { publishDate: -1 },
        limit
      };
    }
    
    const userInterests = user.getTopHealthInterests(5);
    const userTopics = userInterests.map(interest => interest.topic);
    
    if (userTopics.length === 0) {
      // No topics yet, return general content
      return {
        query: { isActive: true },
        sort: { publishDate: -1 },
        limit
      };
    }
    
    // Build query to match user topics
    return {
      query: {
        isActive: true,
        $or: [
          { topics: { $in: userTopics } },
          { 
            $or: userTopics.map(topic => ({
              title: { $regex: topic, $options: 'i' }
            }))
          }
        ]
      },
      sort: { publishDate: -1 },
      limit
    };
    
  } catch (error) {
    console.error('Personalized query error:', error);
    return {
      query: { isActive: true },
      sort: { publishDate: -1 },
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
 * Create sample health content for the feed (for initial setup)
 */
export const createSampleHealthContent = async () => {
  const samplePosts = [
    {
      title: 'Understanding Headaches: Causes and Prevention Strategies',
      content: 'Headaches can stem from various causes including stress, dehydration, poor posture, or underlying health conditions. Staying hydrated, managing stress through meditation or exercise, and maintaining regular sleep patterns can significantly reduce headache frequency. If headaches persist or are severe, consult a healthcare professional for proper diagnosis and treatment.',
      excerpt: 'Learn about common headache causes and effective prevention methods to improve your daily wellbeing.',
      author: 'MediGuide Health Team',
      topics: ['headaches', 'prevention', 'wellness', 'pain management'],
      readTime: '4 min read'
    },
    {
      title: 'The Importance of Regular Sleep Patterns for Overall Health',
      content: 'Consistent sleep schedules help regulate your body\'s internal clock, leading to better sleep quality and overall health. Adults should aim for 7-9 hours of sleep per night. Irregular sleep patterns can disrupt circadian rhythms, affecting mood, cognitive function, and immune system performance. Establish a relaxing bedtime routine and avoid screens before sleep for better rest.',
      excerpt: 'Discover how maintaining regular sleep patterns can transform your health and daily energy levels.',
      author: 'MediGuide Sleep Experts',
      topics: ['sleep', 'health', 'wellness', 'circadian rhythm'],
      readTime: '5 min read'
    },
    {
      title: 'Managing Seasonal Allergies: Tips and Treatment Options',
      content: 'Seasonal allergies affect millions worldwide. Common symptoms include sneezing, runny nose, itchy eyes, and fatigue. Over-the-counter antihistamines, nasal sprays, and avoiding allergen exposure can help manage symptoms. For persistent allergies, consult an allergist for personalized treatment plans including immunotherapy options.',
      excerpt: 'Effective strategies to manage seasonal allergy symptoms and improve your quality of life during allergy season.',
      author: 'MediGuide Allergy Specialists',
      topics: ['allergies', 'seasonal', 'treatment', 'health tips'],
      readTime: '6 min read'
    },
    {
      title: 'Stress Management Techniques for Better Mental Health',
      content: 'Chronic stress can impact both mental and physical health. Effective stress management techniques include mindfulness meditation, regular exercise, deep breathing exercises, and maintaining social connections. Identifying stress triggers and developing healthy coping mechanisms is crucial for long-term wellbeing and preventing stress-related health issues.',
      excerpt: 'Learn practical techniques to manage stress and improve your mental health in daily life.',
      author: 'MediGuide Mental Health Team',
      topics: ['stress', 'mental health', 'wellness', 'mindfulness'],
      readTime: '7 min read'
    },
    {
      title: 'Benefits of Regular Physical Activity for Heart Health',
      content: 'Regular exercise strengthens your heart muscle, improves blood circulation, and helps maintain healthy blood pressure levels. Aim for at least 150 minutes of moderate-intensity exercise per week. Activities like brisk walking, swimming, or cycling can significantly reduce the risk of heart disease and improve overall cardiovascular health.',
      excerpt: 'Discover how regular physical activity can protect your heart and enhance your overall health.',
      author: 'MediGuide Cardiology Team',
      topics: ['exercise', 'heart health', 'fitness', 'prevention'],
      readTime: '5 min read'
    }
  ];

  try {
    // Check if sample content already exists
    const existingCount = await HealthPost.countDocuments();
    if (existingCount === 0) {
      await HealthPost.insertMany(samplePosts);
      console.log('✅ Sample health content created successfully');
    }
  } catch (error) {
    console.error('Error creating sample health content:', error);
  }

};
