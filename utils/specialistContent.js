import model from '../config/gemini.js';

export const generateMedicalContent = async (options) => {
  try {
    const { topic, contentType, tone, keywords, title, customInstructions } = options;

    console.log('🎯 Gemini Options:', options);

    // SIMPLE PROMPT - Let Gemini be smart
    const prompt = `
Write a detailed ${contentType} about "${topic}".

Tone: ${tone}
${keywords && keywords.length > 0 ? `Include: ${keywords.join(', ')}` : ''}
${customInstructions ? `Instructions: ${customInstructions}` : ''}

Write a comprehensive, well-structured article that's practical and useful.
`;

    console.log('📝 Final Prompt:', prompt);

    const result = await model.generateContent(prompt);
    
    // ADD DEBUGGING: Check the full result object
    console.log('🔍 Full Gemini Result:', result);
    console.log('🔍 Result Response:', result.response);
    
    const response = await result.response;
    const content = response.text();

    console.log('✅ Gemini RAW Content:', content);
    console.log('📏 Content Length:', content.length);

    // Check if content is empty
    if (!content || content.trim().length === 0) {
      console.log('🚨 EMPTY CONTENT - Checking for safety blocks...');
      
      // Check if there are safety blocks in the response
      if (result.response.promptFeedback) {
        console.log('🚨 Safety Block Reason:', result.response.promptFeedback);
      }
      
      throw new Error('Gemini returned empty content - likely safety filter');
    }

    const contentTitle = title || `${topic} - ${contentType}`;

    return {
      title: contentTitle,
      content: content,
      summary: `Content about ${topic}`,
      keyPoints: keywords && keywords.length > 0 ? keywords : ['Practical guidance']
    };

  } catch (error) {
    console.error('❌ Gemini Generation Failed:', error);
    console.error('❌ Error Stack:', error.stack);
    
    // Better error reporting
    const fallbackTitle = options.title || `${options.topic} - Guide`;
    const fallbackKeywords = options.keywords || [];
    
    return {
      title: fallbackTitle,
      content: `# ${fallbackTitle}\n\nContent generation failed: ${error.message}\n\nPlease try again with different parameters or topic.`,
      summary: `Content generation issue for ${options.topic}`,
      keyPoints: fallbackKeywords.length > 0 ? fallbackKeywords : ['Information']
    };
  }
};
