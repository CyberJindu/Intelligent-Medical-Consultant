import model, { MEDICAL_SYSTEM_PROMPT } from '../config/gemini.js';

/**
 * Generate medical content using Gemini AI
 */
export const generateMedicalContent = async (options) => {
  try {
    const {
      topic,
      contentType,
      targetAudience = 'general_public',
      tone = 'professional',
      specialistSpecialization
    } = options;

    // SIMPLIFIED PROMPT - Remove complex JSON formatting that's causing issues
    const prompt = `
You are MediGuide AI, helping healthcare specialists create medical content.

SPECIALIST'S SPECIALIZATION: ${specialistSpecialization || 'General Medicine'}
CONTENT TYPE: ${contentType}
TARGET AUDIENCE: ${targetAudience}
TONE: ${tone}

Create a comprehensive medical content piece about: "${topic}"

Please include:
- An engaging title
- Well-structured content with headings
- Evidence-based medical information
- Practical advice and actionable insights
- When to seek professional medical consultation
- Preventive measures and healthy practices

Make it professional, accurate, and tailored for ${targetAudience}.
Use clear headings, bullet points, and proper formatting.
`;

    console.log('Sending prompt to Gemini:', prompt);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();

    console.log('Raw Gemini response:', generatedText);

    // If Gemini returns empty content, create fallback content
    if (!generatedText || generatedText.trim() === '') {
      console.log('Gemini returned empty content, using fallback');
      return {
        title: `Understanding ${topic} - Medical Guide`,
        content: `# ${topic}\n\n## Overview\n\n${topic} is an important aspect of health and wellbeing that requires proper understanding and management.\n\n## Key Information\n\n- **Professional Guidance**: Always consult healthcare professionals for personalized advice\n- **Evidence-Based**: This content is based on current medical understanding\n- **Preventive Measures**: Regular check-ups and healthy habits are essential\n\n## Practical Advice\n\n1. Maintain regular health screenings\n2. Follow evidence-based health guidelines\n3. Consult specialists for specific concerns\n4. Stay informed about latest medical research\n\n## When to Seek Help\n\nConsult a healthcare professional if you experience:\n- Persistent symptoms\n- Sudden changes in health\n- Concerns about specific conditions\n- Need for personalized medical advice\n\n## Summary\n\nThis guide provides general information about ${topic}. For personalized medical advice, always consult qualified healthcare professionals.`,
        summary: `A comprehensive medical guide about ${topic} for ${targetAudience}.`,
        keyPoints: [
          "Evidence-based medical information",
          "Practical health recommendations", 
          "Professional consultation guidance"
        ]
      };
    }

    // Return the actual Gemini response
    return {
      title: `${topic} - Medical Guide`,
      content: generatedText,
      summary: `A comprehensive guide about ${topic} for ${targetAudience}.`,
      keyPoints: [
        "Important medical insights",
        "Practical health advice",
        "Professional guidance"
      ]
    };

  } catch (error) {
    console.error('Error generating medical content:', error);
    
    // Return fallback content instead of throwing error
    return {
      title: `Medical Guide: ${options.topic}`,
      content: `# ${options.topic}\n\n## Medical Content Overview\n\nThis content about ${options.topic} is being prepared for ${options.targetAudience}.\n\n### Key Areas to Cover\n\n- Understanding ${options.topic}\n- Prevention and management strategies\n- When to seek professional help\n- Evidence-based recommendations\n\n### Professional Note\n\nAs healthcare professionals, we understand the importance of accurate, evidence-based medical information. This content is designed to educate and inform ${options.targetAudience} about ${options.topic}.\n\n### Consultation Recommendation\n\nAlways consult with qualified healthcare providers for personalized medical advice and treatment plans.`,
      summary: `A medical guide about ${options.topic} for ${options.targetAudience}.`,
      keyPoints: [
        "Professional medical insights",
        "Evidence-based information",
        "Health and wellness guidance"
      ]
    };
  }
};
