import GeneratedContent from '../models/GeneratedContent.js';
import User from '../models/User.js';
import Specialist from '../models/Specialist.js';
import { analyzeTopicsForMatching } from '../utils/geminiHelper.js'; 

// Get personalized health feed with SEMANTIC topic matching
export const getPersonalizedFeed = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get user's topics for personalization
    const user = await User.findById(userId);
    const userTopics = user ? user.getTopHealthInterests(5).map(interest => interest.topic) : [];
    
    console.log('🎯 User topics for personalization:', userTopics);
    
    // Get ALL published contents
    const allContents = await GeneratedContent.find({ isPublished: true })
      .populate('specialistId', 'name specialty')
      .select('title content contentType topic targetAudience tone wordCount keywords generatedAt lastModified isPublished')
      .sort({ generatedAt: -1 })
      .limit(50); // Get more for better matching

    console.log('📊 Total published contents:', allContents.length);
    
    // If no user topics OR no contents, return general feed
    if (userTopics.length === 0 || allContents.length === 0) {
      const generalFeed = await getGeneralFeed(allContents);
      return res.json({
        success: true,
        data: { 
          feed: generalFeed,
          generatedAt: new Date(),
          personalizationLevel: 'low',
          feedSource: 'general_fallback'
        }
      });
    }
    
    // Use Gemini to find SEMANTIC matches between user topics and content topics
    console.log('🤖 Using Gemini for semantic topic matching...');
    
    // Prepare content topics for Gemini analysis
    const contentTopicsMap = {};
    allContents.forEach(content => {
      const topics = [
        content.topic,
        ...(content.keywords || []),
        content.contentType
      ].filter(t => t && typeof t === 'string');
      
      contentTopicsMap[content._id] = {
        id: content._id,
        title: content.title,
        topics: topics
      };
    });
    
    // Get semantic matches using Gemini
    const semanticMatches = await findSemanticMatches(userTopics, contentTopicsMap);
    
    console.log('✅ Semantic matches found:', semanticMatches.length);
    
    // Sort contents by semantic match score
    const matchedContentIds = semanticMatches.map(match => match.contentId);
    const unmatchedContents = allContents.filter(content => 
      !matchedContentIds.includes(content._id.toString())
    );
    
    // Get specialist names
    const specialistIds = [...new Set(allContents.map(content => content.specialistId))];
    const specialists = await Specialist.find({ _id: { $in: specialistIds } })
      .select('name specialty')
      .lean();
    
    const specialistMap = {};
    specialists.forEach(spec => {
      specialistMap[spec._id.toString()] = spec;
    });
    
    // Format matched contents first (with semantic scores)
    const formattedMatchedFeed = semanticMatches.map(match => {
      const content = allContents.find(c => c._id.toString() === match.contentId);
      if (!content) return null;
      
      const specialist = specialistMap[content.specialistId?._id?.toString() || content.specialistId?.toString()];
      
      // Calculate read time
      const wordCount = content.content ? content.content.split(/\s+/).length : 0;
      const readTimeMinutes = Math.ceil(wordCount / 200);
      
      // Create topics array
      const contentTopics = [];
      if (content.topic) contentTopics.push(content.topic.toLowerCase());
      if (content.keywords && Array.isArray(content.keywords)) {
        content.keywords.forEach(kw => {
          if (kw && typeof kw === 'string') contentTopics.push(kw.toLowerCase());
        });
      }
      
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
        relevanceScore: Math.min(match.semanticScore * 100, 95), // Convert to percentage
        matchingTopics: match.matchingPairs,
        matchPercentage: Math.round(match.semanticScore * 100),
        semanticMatch: true,
        matchReason: match.explanation
      };
    }).filter(item => item !== null);
    
    // Format unmatched contents (fallback)
    const formattedUnmatchedFeed = unmatchedContents.slice(0, 10).map(content => {
      const specialist = specialistMap[content.specialistId?._id?.toString() || content.specialistId?.toString()];
      
      const wordCount = content.content ? content.content.split(/\s+/).length : 0;
      const readTimeMinutes = Math.ceil(wordCount / 200);
      
      const contentTopics = [];
      if (content.topic) contentTopics.push(content.topic.toLowerCase());
      if (content.keywords && Array.isArray(content.keywords)) {
        content.keywords.forEach(kw => {
          if (kw && typeof kw === 'string') contentTopics.push(kw.toLowerCase());
        });
      }
      
      const uniqueTopics = [...new Set(contentTopics)].slice(0, 6);
      
      // Calculate basic relevance based on recency
      const daysOld = (new Date() - content.generatedAt) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 50 - (daysOld));
      
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
        relevanceScore: Math.round(recencyScore),
        semanticMatch: false,
        matchReason: 'General recommendation based on recency'
      };
    });
    
    // Combine matched first, then unmatched
    const finalFeed = [...formattedMatchedFeed, ...formattedUnmatchedFeed];
    
    res.status(200).json({
      success: true,
      data: { 
        feed: finalFeed.slice(0, 20), // Limit to 20 items
        generatedAt: new Date(),
        personalizationLevel: semanticMatches.length > 0 ? 'high' : 'medium',
        userTopicsCount: userTopics.length,
        semanticMatchesCount: semanticMatches.length,
        feedSource: 'semantic_gemini_matching',
        debug: {
          userTopics,
          totalContents: allContents.length,
          semanticMatches: semanticMatches.length
        }
      }
    });

  } catch (error) {
    console.error('Health feed error:', error);
    
    // Fallback to general feed if Gemini fails
    try {
      console.log('🔄 Gemini failed, falling back to general feed...');
      const allContents = await GeneratedContent.find({ isPublished: true })
        .populate('specialistId', 'name specialty')
        .select('title content topic keywords generatedAt')
        .sort({ generatedAt: -1 })
        .limit(15);
      
      const generalFeed = await getGeneralFeed(allContents);
      
      return res.json({
        success: true,
        data: { 
          feed: generalFeed,
          generatedAt: new Date(),
          personalizationLevel: 'low',
          feedSource: 'fallback_general',
          error: error.message
        }
      });
    } catch (fallbackError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch health feed',
        error: error.message
      });
    }
  }
};

// Helper: Get general feed without semantic matching
const getGeneralFeed = async (contents) => {
  const specialistIds = [...new Set(contents.map(content => content.specialistId))];
  const specialists = await Specialist.find({ _id: { $in: specialistIds } })
    .select('name specialty')
    .lean();
  
  const specialistMap = {};
  specialists.forEach(spec => {
    specialistMap[spec._id.toString()] = spec;
  });
  
  return contents.map(content => {
    const specialist = specialistMap[content.specialistId?._id?.toString() || content.specialistId?.toString()];
    
    const wordCount = content.content ? content.content.split(/\s+/).length : 0;
    const readTimeMinutes = Math.ceil(wordCount / 200);
    
    const contentTopics = [];
    if (content.topic) contentTopics.push(content.topic.toLowerCase());
    if (content.keywords && Array.isArray(content.keywords)) {
      content.keywords.forEach(kw => {
        if (kw && typeof kw === 'string') contentTopics.push(kw.toLowerCase());
      });
    }
    
    const uniqueTopics = [...new Set(contentTopics)].slice(0, 6);
    
    // Calculate recency score
    const daysOld = (new Date() - content.generatedAt) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 70 - (daysOld * 2));
    
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
      relevanceScore: Math.round(recencyScore),
      semanticMatch: false,
      matchReason: 'General health recommendation'
    };
  });
};

// Semantic matching using Gemini
const findSemanticMatches = async (userTopics, contentTopicsMap) => {
  try {
    // If Gemini is not available or quota exceeded, use keyword fallback
    if (process.env.GEMINI_DISABLED === 'true') {
      console.log('⚠️ Gemini disabled, using keyword fallback matching');
      return findKeywordMatches(userTopics, contentTopicsMap);
    }
    
    // Prepare prompt for Gemini
    const contentsArray = Object.values(contentTopicsMap);
    
    const prompt = `
    I need to find semantic matches between user health interests and medical content topics.
    
    USER INTERESTS: ${JSON.stringify(userTopics)}
    
    AVAILABLE CONTENT TOPICS:
    ${contentsArray.map(c => `Content ID: ${c.id}, Title: "${c.title}", Topics: ${JSON.stringify(c.topics)}`).join('\n')}
    
    For EACH user interest, find ALL content topics that are semantically related.
    Consider:
    1. Medical synonyms (e.g., "heart health" = "cardiovascular", "cardio")
    2. Related conditions (e.g., "headache" = "migraine", "tension")
    3. Broader/narrower terms (e.g., "nutrition" = "diet", "vitamins")
    4. Symptom-disease relationships (e.g., "fever" = "infection", "inflammation")
    
    Return a JSON array of matches with this format:
    [
      {
        "contentId": "content_id_here",
        "userTopic": "user_topic_here", 
        "contentTopic": "matched_topic_here",
        "semanticScore": 0.85, // 0.0 to 1.0
        "relationship": "exact_match|synonym|related_condition|broader_term|narrower_term",
        "explanation": "Brief explanation of the semantic relationship"
      }
    ]
    
    Only include matches with semanticScore >= 0.4.
    `;
    
    // Call Gemini API (you'll need to implement this)
    const geminiResponse = await callGeminiForTopicMatching(prompt);
    
    if (!geminiResponse || !Array.isArray(geminiResponse)) {
      throw new Error('Invalid response from Gemini');
    }
    
    // Group matches by content and calculate aggregate scores
    const matchesByContent = {};
    geminiResponse.forEach(match => {
      if (!matchesByContent[match.contentId]) {
        matchesByContent[match.contentId] = [];
      }
      matchesByContent[match.contentId].push(match);
    });
    
    // Calculate final scores per content
    const finalMatches = Object.entries(matchesByContent).map(([contentId, matches]) => {
      const avgScore = matches.reduce((sum, m) => sum + m.semanticScore, 0) / matches.length;
      const matchingPairs = matches.map(m => ({
        userTopic: m.userTopic,
        contentTopic: m.contentTopic,
        relationship: m.relationship
      }));
      
      // Find the best explanation
      const bestMatch = matches.sort((a, b) => b.semanticScore - a.semanticScore)[0];
      
      return {
        contentId,
        semanticScore: avgScore,
        matchingPairs,
        explanation: bestMatch.explanation || `Matches ${matches.length} user interests`
      };
    });
    
    // Sort by semantic score (highest first)
    return finalMatches.sort((a, b) => b.semanticScore - a.semanticScore);
    
  } catch (error) {
    console.error('Semantic matching error:', error);
    // Fallback to keyword matching
    return findKeywordMatches(userTopics, contentTopicsMap);
  }
};

// Fallback: Simple keyword matching
const findKeywordMatches = (userTopics, contentTopicsMap) => {
  const matches = [];
  
  Object.values(contentTopicsMap).forEach(content => {
    const contentTopics = content.topics.map(t => t.toLowerCase());
    const userTopicsLower = userTopics.map(t => t.toLowerCase());
    
    const matchingPairs = [];
    
    userTopicsLower.forEach(userTopic => {
      contentTopics.forEach(contentTopic => {
        // Simple keyword matching
        if (contentTopic.includes(userTopic) || userTopic.includes(contentTopic)) {
          matchingPairs.push({
            userTopic,
            contentTopic,
            relationship: 'keyword_match'
          });
        }
        
        // Check for common medical synonyms
        const synonyms = getMedicalSynonyms(userTopic);
        synonyms.forEach(synonym => {
          if (contentTopic.includes(synonym) || contentTopic === synonym) {
            matchingPairs.push({
              userTopic,
              contentTopic,
              relationship: 'synonym_match'
            });
          }
        });
      });
    });
    
    if (matchingPairs.length > 0) {
      const score = Math.min(matchingPairs.length * 0.2, 0.8); // Max 0.8 for keyword matches
      matches.push({
        contentId: content.id,
        semanticScore: score,
        matchingPairs,
        explanation: `Found ${matchingPairs.length} keyword matches`
      });
    }
  });
  
  return matches.sort((a, b) => b.semanticScore - a.semanticScore);
};

// Common medical synonyms (could be expanded)
const getMedicalSynonyms = (topic) => {
  const synonymMap = {
    'heart': ['cardiovascular', 'cardio', 'cardiac', 'heart disease', 'heart attack'],
    'headache': ['migraine', 'tension headache', 'cephalalgia', 'head pain'],
    'fever': ['pyrexia', 'high temperature', 'hyperthermia'],
    'pain': ['ache', 'discomfort', 'soreness', 'hurt'],
    'stress': ['anxiety', 'tension', 'pressure', 'worry'],
    'sleep': ['insomnia', 'rest', 'slumber', 'sleep disorder'],
    'nutrition': ['diet', 'food', 'eating', 'nutrients', 'vitamins'],
    'exercise': ['workout', 'physical activity', 'fitness', 'training'],
    'weight': ['obesity', 'body mass', 'fat', 'weight loss'],
    'mental': ['psychological', 'emotional', 'psychiatric', 'mind']
  };
  
  const topicLower = topic.toLowerCase();
  for (const [key, synonyms] of Object.entries(synonymMap)) {
    if (topicLower.includes(key) || synonyms.some(s => topicLower.includes(s))) {
      return synonyms;
    }
  }
  
  return [];
};

// Mock Gemini call (you need to implement actual Gemini API call)
const callGeminiForTopicMatching = async (prompt) => {
  try {
    // TODO: Replace with actual Gemini API call
    // For now, return mock data
    console.log('🤖 Calling Gemini for semantic matching...');
    
    // Simulate Gemini API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock response - in real implementation, call Gemini API
    return [
      {
        contentId: "example_content_id",
        userTopic: "heart health",
        contentTopic: "cardiovascular wellness",
        semanticScore: 0.85,
        relationship: "synonym",
        explanation: "'heart health' is synonymous with 'cardiovascular wellness' in medical context"
      }
    ];
    
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
};

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
