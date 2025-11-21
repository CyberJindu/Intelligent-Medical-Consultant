import model from '../config/gemini.js';

export const generateMedicalContent = async (options) => {
  try {
    const { topic, contentType, tone, keywords, title, customInstructions } = options;

    // SIMPLE PROMPT - Let Gemini be smart
    const prompt = `
Write a detailed ${contentType} about "${topic}".

Tone: ${tone}
${keywords.length > 0 ? `Include: ${keywords.join(', ')}` : ''}
${customInstructions ? `Instructions: ${customInstructions}` : ''}

Write a comprehensive, well-structured article that's practical and useful.
`;

    console.log('📝 Calling Gemini with simple prompt');
    console.log('Prompt:', prompt);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    console.log('✅ Gemini response received, length:', content.length);

    // Just use whatever Gemini returns
    return {
      title: title || `${topic} - Guide`,
      content: content,
      summary: `Content about ${topic}`,
      keyPoints: keywords.length > 0 ? keywords : ['Practical guidance']
    };

  } catch (error) {
    console.error('❌ Gemini failed:', error);
    
    // Simple fallback
    return {
      title: title || `${topic} - Guide`,
      content: `# ${title || topic}\n\nContent about ${topic}. ${keywords.length > 0 ? `Focus on: ${keywords.join(', ')}` : ''}`,
      summary: `Content about ${topic}`,
      keyPoints: keywords.length > 0 ? keywords : ['Information']
    };
  }
};
