import Specialist from '../models/Specialist.js';
import { analyzeConversationForSpecialty } from './geminiHelper.js';

/**
 * Analyze conversation and recommend specialists
 */
export const analyzeConversationForSpecialist = async (conversationContext) => {
  try {
    // Use AI to analyze conversation and determine needed specialty
    const analysis = await analyzeConversationForSpecialty(conversationContext);
    
    return analysis;

  } catch (error) {
    console.error('Specialist matching analysis error:', error);
    
    // Fallback to basic analysis
    return {
      recommendedSpecialty: 'General Physician',
      severity: 'routine',
      confidence: 0.6,
      keySymptoms: []
    };
  }
};

/**
 * Find specialists based on analysis results
 */
export const findMatchingSpecialists = async (analysis, limit = 5) => {
  try {
    const { recommendedSpecialty, severity } = analysis;
    
    let query = { isActive: true };
    
    // Build search query based on recommended specialty
    if (recommendedSpecialty && recommendedSpecialty !== 'General Physician') {
      query.$or = [
        { specialty: { $regex: recommendedSpecialty, $options: 'i' } },
        { subSpecialty: { $regex: recommendedSpecialty, $options: 'i' } }
      ];
    } else {
      // Default to general physicians
      query.specialty = { $regex: 'general|physician|family', $options: 'i' };
    }

    // For critical cases, prioritize availability
    let sortCriteria = { rating: -1, experience: -1 };
    if (severity === 'critical') {
      sortCriteria = { isOnline: -1, rating: -1, experience: -1 };
    }

    const specialists = await Specialist.find(query)
      .select('name specialty subSpecialty bio rating experience phone availability responseTime isOnline languages')
      .sort(sortCriteria)
      .limit(limit);

    return specialists;

  } catch (error) {
    console.error('Find specialists error:', error);
    return [];
  }
};

/**
 * Get emergency specialists (available immediately)
 */
export const getEmergencySpecialists = async (limit = 3) => {
  try {
    const specialists = await Specialist.find({
      isActive: true,
      isOnline: true,
      availability: { $regex: '24/7|emergency', $options: 'i' }
    })
    .select('name specialty bio rating experience phone availability responseTime')
    .sort({ rating: -1, experience: -1 })
    .limit(limit);

    return specialists;

  } catch (error) {
    console.error('Get emergency specialists error:', error);
    return [];
  }
};

/**
 * Calculate match score between specialist and user needs
 */
export const calculateMatchScore = (specialist, userAnalysis) => {
  let score = 0;
  
  // Specialty match (50 points)
  if (specialist.specialty.toLowerCase().includes(userAnalysis.recommendedSpecialty.toLowerCase())) {
    score += 50;
  }
  
  // Sub-specialty match (30 points)
  if (specialist.subSpecialty && userAnalysis.keySymptoms.some(symptom => 
    specialist.subSpecialty.toLowerCase().includes(symptom.toLowerCase()))) {
    score += 30;
  }
  
  // Rating (10 points scaled)
  score += (specialist.rating / 5) * 10;
  
  // Experience (5 points scaled - max 20 years = 5 points)
  score += Math.min((specialist.experience / 20) * 5, 5);
  
  // Availability for urgent cases (5 points)
  if (userAnalysis.severity === 'urgent' || userAnalysis.severity === 'critical') {
    if (specialist.isOnline) score += 5;
    if (specialist.responseTime && specialist.responseTime.includes('< 30')) score += 2;
  }
  
  return Math.min(score, 100); // Cap at 100
};