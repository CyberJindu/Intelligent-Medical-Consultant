import model, { MEDICAL_SYSTEM_PROMPT } from '../config/gemini.js';

/**
 * Generate AI response for medical conversations with optional image support
 */
export const generateAIResponse = async (userMessage, conversationHistory = [], imageData = null) => {
  try {
    // If image is provided, use vision model
    if (imageData) {
      const { imageBuffer, imageMimeType } = imageData;
      return await generateImageResponse(userMessage, imageBuffer, imageMimeType, conversationHistory);
    }
    
    // Otherwise use text-only model
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

    // Analyze if specialist recommendation is needed
    const needsSpecialist = analyzeForSpecialistRecommendation(userMessage, text);

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
    // Build conversation context
    const conversationContext = conversationHistory
      .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.text}`)
      .join('\n');

    // Prepare the prompt for image analysis
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

    // Convert image buffer to base64
    const base64Image = imageBuffer.toString('base64');
    
    // Prepare the image part for Gemini
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: imageMimeType || 'image/jpeg'
      }
    };

    // Prepare text part
    const textPart = { text: prompt };

    // Generate content with image
    const result = await model.generateContent([textPart, imagePart]);
    const response = await result.response;
    const text = response.text();

    return text;

  } catch (error) {
    console.error('Gemini Vision Error:', error);
    
    // Special handling for vision model errors
    if (error.message.includes('SAFETY') || error.message.includes('blocked')) {
      return "I apologize, but I cannot analyze this image due to safety guidelines. For medical image analysis, please consult with a healthcare professional directly.";
    }
    
    if (error.message.includes('invalid image') || error.message.includes('format')) {
      return "I'm having trouble processing this image format. Please try with a clearer image in JPEG or PNG format, or describe the issue in text.";
    }
    
    return "I apologize, but I'm having trouble analyzing this image right now. Please try uploading a clearer image or describe the issue in text.";
  }
};

/**
 * Analyze conversation to determine if specialist recommendation is needed
 */
const analyzeForSpecialistRecommendation = (userMessage, aiResponse) => {
  const criticalKeywords = [
    'emergency', 'urgent', 'severe', 'critical', 'intense pain',
    'chest pain', 'difficulty breathing', 'bleeding', 'fainting',
    'heart attack', 'stroke', 'allergic reaction', 'broken bone'
  ];

  const specialistKeywords = [
    'specialist', 'doctor', 'physician', 'hospital', 'clinic',
    'appointment', 'consult', 'referral', 'diagnose', 'prescription'
  ];

  const userMessageLower = userMessage.toLowerCase();
  const aiResponseLower = aiResponse.toLowerCase();

  // Check for critical issues that need immediate attention
  const hasCriticalIssue = criticalKeywords.some(keyword => 
    userMessageLower.includes(keyword) || aiResponseLower.includes(keyword)
  );

  // Check if specialist consultation is mentioned
  const needsSpecialist = hasCriticalIssue || 
    specialistKeywords.some(keyword => aiResponseLower.includes(keyword)) ||
    userMessageLower.includes('see a doctor') ||
    userMessageLower.includes('should i see');

  return needsSpecialist;
};

/**
 * Analyze conversation to determine medical specialty needed
 */
export const analyzeConversationForSpecialty = async (conversationText) => {
  try {
    const analysisPrompt = `
Analyze this medical conversation and determine:
1. What medical specialty is most relevant?
2. How urgent is the situation? (critical, urgent, routine)
3. Key symptoms mentioned

CONVERSATION:
${conversationText}

Respond in JSON format:
{
  "recommendedSpecialty": "General Physician" or specific specialty,
  "severity": "critical" | "urgent" | "routine",
  "confidence": 0.85,
  "keySymptoms": ["symptom1", "symptom2"]
}
`;

    const result = await model.generateContent(analysisPrompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback analysis
    return fallbackConversationAnalysis(conversationText);

  } catch (error) {
    console.error('Conversation analysis error:', error);
    return fallbackConversationAnalysis(conversationText);
  }
};

/**
 * Fallback analysis when AI fails
 */
const fallbackConversationAnalysis = (conversationText) => {
  const text = conversationText.toLowerCase();
  
  let recommendedSpecialty = 'General Physician';
  let severity = 'routine';
  const keySymptoms = [];

  // Determine specialty based on keywords
  if (text.includes('heart') || text.includes('chest') || text.includes('blood pressure')) {
    recommendedSpecialty = 'Cardiology';
  } else if (text.includes('skin') || text.includes('rash') || text.includes('acne')) {
    recommendedSpecialty = 'Dermatology';
  } else if (text.includes('mental') || text.includes('anxiety') || text.includes('depression')) {
    recommendedSpecialty = 'Psychiatry';
  } else if (text.includes('stomach') || text.includes('digest') || text.includes('gut')) {
    recommendedSpecialty = 'Gastroenterology';
  } else if (text.includes('child') || text.includes('baby') || text.includes('pediatric')) {
    recommendedSpecialty = 'Pediatrics';
  }

  // Determine severity
  if (text.includes('emergency') || text.includes('severe') || text.includes('critical')) {
    severity = 'critical';
  } else if (text.includes('urgent') || text.includes('pain') || text.includes('fever')) {
    severity = 'urgent';
  }

  // Extract symptoms (simplified)
  const symptomKeywords = ['headache', 'fever', 'pain', 'cough', 'rash', 'nausea', 'dizziness'];
  symptomKeywords.forEach(symptom => {
    if (text.includes(symptom)) {
      keySymptoms.push(symptom);
    }
  });

  return {
    recommendedSpecialty,
    severity,
    confidence: 0.7,
    keySymptoms
  };
};
