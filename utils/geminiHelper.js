import model, { MEDICAL_SYSTEM_PROMPT } from '../config/gemini.js';

/**
 * Generate AI response for medical conversations with optional image support
 */
export const generateAIResponse = async (userMessage, conversationHistory = [], imageData = null) => {
  try {
    if (imageData) {
      const { imageBuffer, imageMimeType } = imageData;
      return await generateImageResponse(userMessage, imageBuffer, imageMimeType, conversationHistory);
    }
    
    const conversationContext = conversationHistory
      .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n');

    const fullPrompt = `
${MEDICAL_SYSTEM_PROMPT}

CONVERSATION HISTORY:
${conversationContext}

CURRENT USER MESSAGE:
${userMessage}

Please provide a helpful, professional response that follows medical guidelines.
`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    return text;

  } catch (error) {
    console.error('Gemini AI Error:', error);
    
    if (error.message.includes('SAFETY')) {
      return "I apologize, but I cannot provide a response to that question due to safety guidelines. For medical concerns, please consult with a healthcare professional.";
    }
    
    if (error.message.includes('QUOTA') || error.message.includes('RATE_LIMIT')) {
      return "I'm currently experiencing high demand. Please try again in a moment, or consult with a healthcare professional for immediate assistance.";
    }
    
    return "I apologize, but I'm having trouble processing your request right now. Please try again shortly or consult with a healthcare professional for medical advice.";
  }
};

/**
 * Generate response for image analysis
 */
const generateImageResponse = async (userMessage, imageBuffer, imageMimeType, conversationHistory = []) => {
  try {
    const conversationContext = conversationHistory
      .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n');

    const prompt = `
${MEDICAL_SYSTEM_PROMPT}

CONVERSATION HISTORY:
${conversationContext}

USER HAS UPLOADED AN IMAGE WITH THIS DESCRIPTION: "${userMessage || 'No description provided'}"

Please analyze this medical image and provide:
1. Professional observation of what you see
2. Possible conditions or issues (if visible)
3. Recommendations for next steps
4. Whether specialist consultation is advised

IMPORTANT MEDICAL DISCLAIMERS:
- I am an AI assistant and cannot provide definitive diagnoses
- My analysis is based on visual patterns only
- Always consult with a healthcare professional for medical advice
- In emergencies, seek immediate medical attention
`;

    const base64Image = imageBuffer.toString('base64');
    
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: imageMimeType || 'image/jpeg'
      }
    };

    const textPart = { text: prompt };

    const result = await model.generateContent([textPart, imagePart]);
    const response = await result.response;
    const text = response.text();

    return text;

  } catch (error) {
    console.error('Gemini Vision Error:', error);
    
    if (error.message.includes('SAFETY') || error.message.includes('blocked')) {
      return "I apologize, but I cannot analyze this image due to safety guidelines. For medical image analysis, please consult with a healthcare professional directly.";
    }
    
    if (error.message.includes('invalid image') || error.message.includes('format')) {
      return "I'm having trouble processing this image format. Please try with a clearer image in JPEG or PNG format, or describe the issue in text.";
    }
    
    return "I apologize, but I'm having trouble analyzing this image right now. Please try uploading a clearer image or describe the issue in text.";
  }
};

// ⚡ NEW: Real-time health state and specialty analysis
export const analyzeHealthStateAndSpecialty = async (conversationText) => {
  try {
    const prompt = `
Analyze this medical conversation in real-time and determine:

1. HEALTH STATE ASSESSMENT (critical/urgent/routine/informational):
   - "critical": Life-threatening, requires immediate emergency care
   - "urgent": Needs professional attention within 24 hours
   - "routine": Can wait for regular appointment
   - "informational": General health questions only

2. SEVERITY SCORE (0-100):
   - 80-100: Critical emergency
   - 60-79: Urgent attention needed
   - 30-59: Routine consultation advised
   - 0-29: Informational only

3. SPECIALTY NEEDED:
   - Most relevant medical specialty (e.g., "Cardiology", "Dermatology", "General Physician")

4. SPECIALIST ADVISED:
   - Should the user consult a healthcare professional? (true/false)

5. KEY SYMPTOMS:
   - Array of main symptoms mentioned

Respond in STRICT JSON format only:
{
  "healthState": "critical" | "urgent" | "routine" | "informational",
  "severityScore": number (0-100),
  "recommendedSpecialty": "string",
  "specialistAdvised": boolean,
  "keySymptoms": ["string", "string"],
  "confidence": number (0-1)
}

CONVERSATION:
${conversationText.substring(0, 3000)} // Limit to 3000 chars for token efficiency
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize response
      return {
        healthState: ['critical', 'urgent', 'routine', 'informational'].includes(analysis.healthState) 
          ? analysis.healthState 
          : 'routine',
        severityScore: Math.min(100, Math.max(0, analysis.severityScore || 0)),
        recommendedSpecialty: analysis.recommendedSpecialty || 'General Physician',
        specialistAdvised: Boolean(analysis.specialistAdvised),
        keySymptoms: Array.isArray(analysis.keySymptoms) ? analysis.keySymptoms : [],
        confidence: Math.min(1, Math.max(0, analysis.confidence || 0.7))
      };
    }

    return fallbackHealthAnalysis(conversationText);

  } catch (error) {
    console.error('Health state analysis error:', error);
    
    // Don't break chat if analysis fails
    if (error.message.includes('503') || error.message.includes('overloaded')) {
      console.log('⚠️ Gemini overloaded, using fallback analysis');
    }
    
    return fallbackHealthAnalysis(conversationText);
  }
};

const fallbackHealthAnalysis = (conversationText) => {
  const text = conversationText.toLowerCase();
  
  // Default analysis
  let healthState = 'routine';
  let severityScore = 20;
  let specialistAdvised = false;
  const keySymptoms = [];
  
  // Critical patterns
  const criticalPatterns = [
    'chest pain', 'heart attack', 'stroke', 'difficulty breathing', 
    'severe bleeding', 'unconscious', 'choking', 'suicidal', 'overdose'
  ];
  
  // Urgent patterns
  const urgentPatterns = [
    'fever over 103', 'severe pain', 'broken bone', 'deep cut', 
    'burn', 'allergic reaction', 'poisoning', 'head injury'
  ];
  
  if (criticalPatterns.some(pattern => text.includes(pattern))) {
    healthState = 'critical';
    severityScore = 90;
    specialistAdvised = true;
  } else if (urgentPatterns.some(pattern => text.includes(pattern))) {
    healthState = 'urgent';
    severityScore = 65;
    specialistAdvised = true;
  }
  
  // Extract symptoms
  const symptomPatterns = [
    { pattern: /headache|migraine/, symptom: 'headache' },
    { pattern: /fever|temperature/, symptom: 'fever' },
    { pattern: /cough/, symptom: 'cough' },
    { pattern: /pain|hurt|ache/, symptom: 'pain' },
    { pattern: /nausea|vomit/, symptom: 'nausea' },
    { pattern: /dizziness/, symptom: 'dizziness' },
    { pattern: /rash/, symptom: 'rash' }
  ];
  
  symptomPatterns.forEach(({ pattern, symptom }) => {
    if (pattern.test(text)) {
      keySymptoms.push(symptom);
    }
  });
  
  // Determine specialty based on symptoms
  let recommendedSpecialty = 'General Physician';
  if (text.includes('chest') || text.includes('heart')) {
    recommendedSpecialty = 'Cardiology';
  } else if (text.includes('skin') || text.includes('rash')) {
    recommendedSpecialty = 'Dermatology';
  } else if (text.includes('mental') || text.includes('depression')) {
    recommendedSpecialty = 'Psychiatry';
  }
  
  return {
    healthState,
    severityScore,
    recommendedSpecialty,
    specialistAdvised,
    keySymptoms: [...new Set(keySymptoms)],
    confidence: 0.6
  };
};

/**
 * Extract health topics from conversation text
 */
export const extractHealthTopicsFromConversation = async (conversationText) => {
  try {
    const prompt = `
Analyze this medical conversation and extract ALL health-related topics, symptoms, conditions, treatments, and health concerns mentioned.

CONVERSATION:
${conversationText}

Respond with a JSON array of topics, each with:
- topic: string (the health topic/symptom/condition in lowercase)
- category: string (symptom, condition, treatment, prevention, wellness, nutrition, mental, other)
- severity: string (critical, urgent, routine, informational)
- confidence: number (0-1 how confident you are this is a health topic)

Example response:
[
  {
    "topic": "migraine headache",
    "category": "symptom", 
    "severity": "urgent",
    "confidence": 0.9
  }
]
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const topics = JSON.parse(jsonMatch[0]);
      
      return topics
        .filter(topic => topic.confidence > 0.6)
        .map(topic => ({
          topic: topic.topic.toLowerCase().trim(),
          category: topic.category || 'symptom',
          severity: topic.severity || 'routine',
          confidence: topic.confidence
        }));
    }

    return fallbackTopicExtraction(conversationText);

  } catch (error) {
    console.error('Topic extraction error:', error);

    // ✅ ADD: If Gemini is overloaded, return empty array instead of trying fallback
    if (error.message.includes('503') || error.message.includes('overloaded')) {
      console.log('⚠️ Gemini overloaded, skipping topic extraction');
      return []; // Return empty instead of calling fallback
    }
    
    return fallbackTopicExtraction(conversationText);
  }
};

const fallbackTopicExtraction = (conversationText) => {
  const text = conversationText.toLowerCase();
  const topics = [];
  
  const topicPatterns = [
    { pattern: /headache|migraine|head pain/, topic: 'headache', category: 'symptom' },
    { pattern: /stress|anxiety|worry|overwhelmed/, topic: 'stress', category: 'mental' },
    { pattern: /sleep|insomnia|tired|fatigue/, topic: 'sleep issues', category: 'wellness' },
    { pattern: /pain|hurt|ache|sore/, topic: 'pain', category: 'symptom' },
    { pattern: /fever|temperature|hot|chills/, topic: 'fever', category: 'symptom' },
    { pattern: /cough|coughing|throat/, topic: 'cough', category: 'symptom' },
    { pattern: /stomach|nausea|digest|gut/, topic: 'digestion', category: 'condition' },
    { pattern: /heart|chest|blood pressure/, topic: 'heart health', category: 'condition' },
    { pattern: /skin|rash|acne/, topic: 'skin condition', category: 'condition' },
    { pattern: /diet|nutrition|food|weight/, topic: 'nutrition', category: 'nutrition' },
    { pattern: /exercise|workout|fitness/, topic: 'exercise', category: 'wellness' },
    { pattern: /allergy|allergic|sneeze/, topic: 'allergy', category: 'condition' },
    { pattern: /depression|mental|mood|sad/, topic: 'mental health', category: 'mental' }
  ];
  
  topicPatterns.forEach(({ pattern, topic, category }) => {
    if (pattern.test(text)) {
      topics.push({
        topic: topic,
        category: category,
        severity: 'routine',
        confidence: 0.8
      });
    }
  });
  
  return topics;
};

/**
 * Analyze conversation to determine medical specialty needed
 */
export const analyzeConversationForSpecialty = async (conversationText) => {
  try {
    const prompt = `
Analyze this medical conversation and determine:
1. What medical specialty is most relevant?
2. How urgent is the situation? (critical, urgent, routine)
3. Key symptoms mentioned
4. Health topics discussed

CONVERSATION:
${conversationText}

Respond in JSON format:
{
  "recommendedSpecialty": "General Physician" or specific specialty,
  "severity": "critical" | "urgent" | "routine",
  "confidence": 0.85,
  "keySymptoms": ["symptom1", "symptom2"],
  "healthTopics": ["topic1", "topic2"]
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      
      if (!analysis.healthTopics) {
        analysis.healthTopics = analysis.keySymptoms || [];
      }
      
      return analysis;
    }

    return fallbackConversationAnalysis(conversationText);

  } catch (error) {
    console.error('Conversation analysis error:', error);
    return fallbackConversationAnalysis(conversationText);
  }
};

const fallbackConversationAnalysis = (conversationText) => {
  const text = conversationText.toLowerCase();
  
  let recommendedSpecialty = 'General Physician';
  let severity = 'routine';
  const keySymptoms = [];
  const healthTopics = [];

  const specialtyMap = [
    { keywords: ['heart', 'chest', 'blood pressure'], specialty: 'Cardiology' },
    { keywords: ['skin', 'rash', 'acne'], specialty: 'Dermatology' },
    { keywords: ['mental', 'anxiety', 'depression'], specialty: 'Psychiatry' },
    { keywords: ['stomach', 'digest', 'gut'], specialty: 'Gastroenterology' },
    { keywords: ['child', 'baby', 'pediatric'], specialty: 'Pediatrics' },
    { keywords: ['brain', 'nerve', 'neurology'], specialty: 'Neurology' },
    { keywords: ['bone', 'joint', 'orthopedic'], specialty: 'Orthopedics' },
    { keywords: ['eye', 'vision', 'ophthalmology'], specialty: 'Ophthalmology' },
    { keywords: ['ear', 'nose', 'throat', 'ent'], specialty: 'ENT' },
    { keywords: ['women', 'female', 'gynecology'], specialty: 'Gynecology' }
  ];

  specialtyMap.forEach(({ keywords, specialty }) => {
    if (keywords.some(keyword => text.includes(keyword))) {
      recommendedSpecialty = specialty;
    }
  });

  if (text.includes('emergency') || text.includes('severe') || text.includes('critical')) {
    severity = 'critical';
  } else if (text.includes('urgent') || text.includes('pain') || text.includes('fever')) {
    severity = 'urgent';
  }

  const symptoms = ['headache', 'fever', 'pain', 'cough', 'rash', 'nausea', 'dizziness', 'fatigue'];
  symptoms.forEach(symptom => {
    if (text.includes(symptom)) {
      keySymptoms.push(symptom);
      healthTopics.push(symptom);
    }
  });

  const topics = ['sleep', 'stress', 'diet', 'nutrition', 'exercise', 'fitness', 'allergy'];
  topics.forEach(topic => {
    if (text.includes(topic)) {
      healthTopics.push(topic);
    }
  });

  return {
    recommendedSpecialty,
    severity,
    confidence: 0.7,
    keySymptoms,
    healthTopics: [...new Set(healthTopics)]
  };
};

/**
 * Check if specialist recommendation is needed (Legacy - kept for backward compatibility)
 */
export const analyzeForSpecialistRecommendation = (userMessage, aiResponse) => {
  const criticalKeywords = [
    'emergency', 'urgent', 'severe', 'critical', 'intense pain',
    'chest pain', 'difficulty breathing', 'bleeding', 'fainting',
    'heart attack', 'stroke', 'allergic reaction', 'broken bone'
  ];

  const userMessageLower = userMessage.toLowerCase();
  const aiResponseLower = aiResponse.toLowerCase();

  const hasCriticalIssue = criticalKeywords.some(keyword => 
    userMessageLower.includes(keyword) || aiResponseLower.includes(keyword)
  );

  const needsSpecialist = hasCriticalIssue || 
    aiResponseLower.includes('specialist') ||
    aiResponseLower.includes('doctor') ||
    aiResponseLower.includes('hospital') ||
    userMessageLower.includes('see a doctor') ||
    userMessageLower.includes('should i see');

  return needsSpecialist;
};
