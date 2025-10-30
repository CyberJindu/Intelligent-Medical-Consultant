import HealthPost from '../models/HealthPost.js';
import { analyzeConversationForSpecialty } from './geminiHelper.js';

/**
 * Generate personalized health content based on user's conversations
 */
export const generatePersonalizedContent = async (baseFeed, userId) => {
  try {
    // In a full implementation, we'd analyze user's chat history
    // For now, we'll enhance the base feed with some personalization logic
    
    const personalizedFeed = baseFeed.map(post => ({
      ...post.toObject(),
      relevanceScore: calculateRelevanceScore(post, userId),
      isNew: isContentNew(post, userId)
    }));

    // Sort by relevance score (highest first)
    personalizedFeed.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return personalizedFeed;

  } catch (error) {
    console.error('Content personalization error:', error);
    return baseFeed;
  }
};

/**
 * Calculate relevance score for content based on user's potential interests
 */
const calculateRelevanceScore = (post, userId) => {
  let score = 0;
  
  // Base score based on recency (newer content gets higher score)
  const daysOld = (new Date() - post.publishDate) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 100 - (daysOld * 2)); // Lose 2 points per day
  
  // Boost score for popular content
  score += Math.min(post.shareCount * 0.5, 20);
  score += Math.min(post.saveCount * 1, 30);
  
  // Topic-based scoring (in real app, based on user's chat history)
  // For now, using some common health topics
  const commonHealthInterests = ['wellness', 'prevention', 'nutrition', 'exercise'];
  const hasCommonInterest = post.topics.some(topic => 
    commonHealthInterests.includes(topic.toLowerCase())
  );
  
  if (hasCommonInterest) {
    score += 15;
  }
  
  return Math.round(score);
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