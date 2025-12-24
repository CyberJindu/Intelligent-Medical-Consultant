import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Find semantic matches between user topics and content topics using Gemini
 */
export const findSemanticTopicMatches = async (userTopics, contentTopicsArray) => {
  try {
    const prompt = `
    Analyze these medical topics and find semantic relationships:
    
    USER TOPICS: ${JSON.stringify(userTopics)}
    
    CONTENT TOPICS: ${JSON.stringify(contentTopicsArray)}
    
    For each user topic, find all content topics that are:
    1. Exact matches
    2. Medical synonyms
    3. Related conditions
    4. Symptoms of the condition
    5. Treatments for the condition
    6. Broader/narrower terms
    
    Return JSON array with format:
    [
      {
        "userTopic": "headache",
        "matchedContentTopics": [
          {
            "topic": "migraine management",
            "relationship": "specific_condition",
            "confidence": 0.9,
            "explanation": "Headache is a symptom of migraine"
          }
        ]
      }
    ]
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON from Gemini response
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON:', parseError);
    }
    
    // Fallback
    return [];
    
  } catch (error) {
    console.error('Gemini topic matching error:', error);
    return [];
  }
};

/**
 * Get expanded related topics for a given medical topic
 */
export const expandMedicalTopic = async (topic) => {
  try {
    const prompt = `
    Given this medical topic: "${topic}"
    
    Provide related medical topics in these categories:
    1. Synonyms
    2. Specific conditions
    3. Common symptoms  
    4. Treatments
    5. Risk factors
    6. Prevention methods
    
    Return as a JSON array of strings.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return [topic]; // Fallback to original topic
    
  } catch (error) {
    console.error('Gemini topic expansion error:', error);
    return [topic];
  }
};
