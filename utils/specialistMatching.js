import Specialist from '../models/Specialist.js';
import { analyzeConversationForSpecialty } from './geminiHelper.js';

/**
 * Analyze conversation and recommend specialists
 */
export const analyzeConversationForSpecialist = async (conversationContext) => {
  try {
    const analysis = await analyzeConversationForSpecialty(conversationContext);
    return analysis;

  } catch (error) {
    console.error('Specialist matching analysis error:', error);
    
    return {
      recommendedSpecialty: 'General Physician',
      severity: 'routine',
      confidence: 0.6,
      keySymptoms: []
    };
  }
};

/**
 * Find specialists based on analysis results with VERIFICATION PRIORITY
 */
export const findMatchingSpecialists = async (analysis, limit = 5) => {
  try {
    const { recommendedSpecialty, severity, healthTopics = [] } = analysis;
    
    let query = { 
      isActive: true,
      isAvailableForConsultation: true 
    };
    
    // Build search query
    if (recommendedSpecialty && recommendedSpecialty !== 'General Physician') {
      query.$or = [
        { specialty: { $regex: recommendedSpecialty, $options: 'i' } },
        { subSpecialty: { $regex: recommendedSpecialty, $options: 'i' } }
      ];
    } else {
      query.specialty = { $regex: 'general|physician|family', $options: 'i' };
    }

    // Get more specialists to sort locally
    const specialists = await Specialist.find(query)
      .select('name specialty subSpecialty bio rating experience verificationStatus verificationLevel verificationDate responseTime languages consultationTypes')
      .limit(limit * 3);

    if (specialists.length === 0) {
      return [];
    }

    // Calculate scores and sort
    const scoredSpecialists = specialists.map(specialist => {
      const matchScore = calculateMatchScore(specialist, analysis);
      const verificationBoost = getVerificationBoost(specialist);
      
      return {
        ...specialist.toObject(),
        matchScore: Math.round(matchScore),
        verificationBoost: verificationBoost,
        totalScore: Math.round(matchScore + verificationBoost),
        isVerified: specialist.verificationStatus === 'verified'
      };
    });

    // Sort by total score (highest first)
    scoredSpecialists.sort((a, b) => b.totalScore - a.totalScore);
    
    // Return top N
    return scoredSpecialists.slice(0, limit);

  } catch (error) {
    console.error('Find specialists error:', error);
    return [];
  }
};

/**
 * Calculate match score between specialist and user needs
 */
export const calculateMatchScore = (specialist, userAnalysis) => {
  let score = 0;
  const { recommendedSpecialty, severity, healthTopics = [] } = userAnalysis;
  
  // 1. Specialty match (40 points)
  const specialtyMatch = specialist.specialty.toLowerCase().includes(recommendedSpecialty.toLowerCase()) ||
                       (specialist.subSpecialty && specialist.subSpecialty.toLowerCase().includes(recommendedSpecialty.toLowerCase()));
  
  if (specialtyMatch) {
    score += 40;
  } else if (recommendedSpecialty === 'General Physician' && 
             specialist.specialty.toLowerCase().includes('general')) {
    score += 35;
  }
  
  // 2. Experience (25 points scaled)
  if (specialist.experience) {
    const expScore = Math.min((specialist.experience / 20) * 25, 25);
    score += expScore;
  }
  
  // 3. Rating (20 points scaled)
  if (specialist.rating) {
    const ratingScore = (specialist.rating / 5) * 20;
    score += ratingScore;
  }
  
  // 4. Languages (5 points if matches common languages)
  if (specialist.languages && specialist.languages.length > 0) {
    const commonLangs = ['english', 'spanish', 'french', 'hindi'];
    const hasCommonLang = specialist.languages.some(lang => 
      commonLangs.includes(lang.toLowerCase())
    );
    if (hasCommonLang) score += 5;
  }
  
  // 5. Consultation types (5 points for video/chat available)
  if (specialist.consultationTypes && 
      (specialist.consultationTypes.includes('video') || 
       specialist.consultationTypes.includes('chat'))) {
    score += 5;
  }
  
  // 6. Response time for urgent cases (5 points)
  if (severity === 'urgent' || severity === 'critical') {
    if (specialist.responseTime && specialist.responseTime.includes('< 30')) {
      score += 5;
    }
  }
  
  return Math.min(score, 100);
};

/**
 * Get verification boost score (YOUR MAIN FEATURE)
 */
const getVerificationBoost = (specialist) => {
  let boost = 0;
  
  // VERIFICATION STATUS BOOST (Your competitive advantage)
  if (specialist.verificationStatus === 'verified') {
    boost += 50; // HUGE BOOST - verified specialists get massive priority
    
    // Additional boost based on verification level
    if (specialist.verificationLevel === 'expert') {
      boost += 30;
    } else if (specialist.verificationLevel === 'advanced') {
      boost += 20;
    } else if (specialist.verificationLevel === 'basic') {
      boost += 10;
    }
    
    // Recency bonus (recently verified gets extra)
    if (specialist.verificationDate) {
      const daysSinceVerification = (new Date() - specialist.verificationDate) / (1000 * 60 * 60 * 24);
      if (daysSinceVerification < 30) {
        boost += 15; // Newly verified bonus
      }
    }
  } else if (specialist.verificationStatus === 'pending') {
    boost += 5; // Small boost for pending verification
  }
  
  // Penalty for unverified (they appear lower)
  if (specialist.verificationStatus === 'unverified' || !specialist.verificationStatus) {
    boost -= 20;
  }
  
  return boost;
};

/**
 * Get emergency specialists (available immediately)
 */
export const getEmergencySpecialists = async (limit = 3) => {
  try {
    const specialists = await Specialist.find({
      isActive: true,
      isAvailableForConsultation: true,
      verificationStatus: 'verified' // Only verified for emergencies
    })
    .select('name specialty bio rating experience verificationLevel responseTime')
    .sort({ verificationLevel: -1, rating: -1, experience: -1 })
    .limit(limit);

    return specialists;

  } catch (error) {
    console.error('Get emergency specialists error:', error);
    return [];
  }
};

/**
 * Get verified specialists by specialty
 */
export const getVerifiedSpecialistsBySpecialty = async (specialty, limit = 5) => {
  try {
    const specialists = await Specialist.find({
      specialty: { $regex: specialty, $options: 'i' },
      verificationStatus: 'verified',
      isActive: true
    })
    .select('name specialty subSpecialty bio rating experience verificationLevel verificationDate')
    .sort({ verificationLevel: -1, rating: -1 })
    .limit(limit);

    return specialists;

  } catch (error) {
    console.error('Get verified specialists error:', error);
    return [];
  }
};
