import model from '../config/gemini.js';

export const generateMedicalContent = async (options) => {
  try {
    const { topic, contentType, tone, keywords, title, customInstructions } = options;

    // SIMPLE PROMPT - Let Gemini be smart
    const prompt = `
Write a detailed ${contentType} about "${topic}".

Tone: ${tone}
${keywords && keywords.length > 0 ? `Include: ${keywords.join(', ')}` : ''}
${customInstructions ? `Instructions: ${customInstructions}` : ''}

Write a comprehensive, well-structured article that's practical and useful.
`;

    console.log('📝 Calling Gemini with simple prompt');
    console.log('Prompt:', prompt);

    const result = await model.generateContent(prompt);
    
    // FIX 1: Proper Gemini response handling
    const response = await result.response;
    const content = response.text();

    console.log('✅ Gemini response received, length:', content.length);

    // FIX 2: Use provided title or fallback
    const contentTitle = title || `${topic} - ${contentType}`;

    return {
      title: contentTitle,
      content: content,
      summary: `Content about ${topic}`,
      keyPoints: keywords && keywords.length > 0 ? keywords : ['Practical guidance']
    };

  } catch (error) {
    console.error('❌ Gemini failed:', error);
    
    // FIX 3: Proper fallback with safe variable access
    const fallbackTitle = options.title || `${options.topic} - Guide`;
    const fallbackKeywords = options.keywords || [];
    
    return {
      title: fallbackTitle,
      content: `# ${fallbackTitle}\n\nContent about ${options.topic}. ${fallbackKeywords.length > 0 ? `Focus on: ${fallbackKeywords.join(', ')}` : ''}`,
      summary: `Content about ${options.topic}`,
      keyPoints: fallbackKeywords.length > 0 ? fallbackKeywords : ['Information']
    };
  }
};
