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
      wordCount = 500,
      keywords = [],
      specialistSpecialization
    } = options;

    // Content-specific system prompt
    const contentSystemPrompt = `
${MEDICAL_SYSTEM_PROMPT}

CONTENT GENERATION MODE:
You are now helping healthcare specialists create medical content for their patients and the public.

SPECIALIST'S SPECIALIZATION: ${specialistSpecialization || 'General Medicine'}

CONTENT TYPE: ${contentType}
TARGET AUDIENCE: ${targetAudience}
TONE: ${tone}
WORD COUNT: Approximately ${wordCount} words
TOPIC: ${topic}
${keywords.length > 0 ? `KEYWORDS TO INCLUDE: ${keywords.join(', ')}` : ''}

CONTENT CREATION GUIDELINES:
1. Create accurate, evidence-based medical content
2. Tailor complexity to the target audience
3. Maintain the specified tone throughout
4. Include practical advice and actionable insights
5. Highlight when professional medical consultation is needed
6. Avoid making definitive diagnoses in educational content
7. Include relevant preventive measures when applicable

RESPONSE FORMAT:
Return a JSON object with:
{
  "title": "Engaging, SEO-friendly title",
  "content": "Full generated content with proper formatting",
  "summary": "Brief 2-3 sentence summary",
  "keyPoints": ["array", "of", "key", "takeaways"]
}

Ensure the content is well-structured with headings, paragraphs, and bullet points where appropriate.
`;

    const prompt = `Generate ${contentType} about "${topic}" for ${targetAudience} with a ${tone} tone.`;

    const result = await model.generateContent([
      { role: "user", parts: [{ text: contentSystemPrompt }] },
      { role: "user", parts: [{ text: prompt }] }
    ]);

    const response = await result.response;
    const generatedText = response.text();

    // Parse the JSON response from Gemini
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        // Fallback if no JSON found
        return {
          title: `Medical Guide: ${topic}`,
          content: generatedText,
          summary: `A comprehensive guide about ${topic} for ${targetAudience}.`,
          keyPoints: [
            "Important medical information",
            "Practical health advice",
            "When to seek professional help"
          ]
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return {
        title: `Medical Guide: ${topic}`,
        content: generatedText,
        summary: `A comprehensive guide about ${topic} for ${targetAudience}.`,
        keyPoints: [
          "Important medical information",
          "Practical health advice",
          "When to seek professional help"
        ]
      };
    }
  } catch (error) {
    console.error('Error generating medical content:', error);
    throw new Error(`Content generation failed: ${error.message}`);
  }
};
