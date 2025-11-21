import model from '../config/gemini.js';

/**
 * Generate specialized content using Gemini AI
 */
export const generateMedicalContent = async (options) => {
  try {
    const {
      topic,
      contentType,
      targetAudience = 'general_public',
      tone = 'professional',
      specialistSpecialization,
      keywords = [],
      title,
      customInstructions
    } = options;

    // CONTENT-FOCUSED PROMPT - Completely different from medical chatbot
    const contentPrompt = `
You are a professional health content creator for MediGuide. Your role is to create engaging, well-structured articles and guides for healthcare specialists to share with their patients.

SPECIALIST'S BACKGROUND: ${specialistSpecialization || 'Healthcare Professional'}
CONTENT TYPE: ${contentType}
TOPIC: "${topic}"
TARGET READERS: ${targetAudience}
DESIRED TONE: ${tone}
${title ? `PREFERRED TITLE: ${title}` : ''}
${keywords.length > 0 ? `KEY POINTS TO COVER: ${keywords.join(', ')}` : ''}
${customInstructions ? `SPECIFIC INSTRUCTIONS: ${customInstructions}` : ''}

CONTENT CREATION GUIDELINES:
1. Write as a comprehensive article/guide, NOT as a chatbot response
2. Use proper article structure with headings, subheadings, and sections
3. Provide specific, actionable advice and step-by-step guidance
4. Include practical examples and real-world applications
5. Use bullet points and numbered lists for clarity
6. Make it engaging and easy to read
7. Focus on education and empowerment
8. Include evidence-based information when relevant

ARTICLE STRUCTURE:
- Engaging introduction that hooks the reader
- Clear, informative headings and subheadings
- Detailed explanations with examples
- Actionable steps and recommendations
- Summary of key takeaways
- Professional yet approachable tone

IMPORTANT: Do NOT write like a chatbot. Write like a professional article that would be published on a health website or shared with patients.

Now create a ${contentType} about "${topic}" that follows these guidelines:
`;

    console.log('Sending content creation prompt to Gemini');

    const result = await model.generateContent(contentPrompt);
    const response = await result.response;
    const generatedText = response.text();

    console.log('Generated content length:', generatedText.length);

    // If content is too short or generic, enhance it
    if (!generatedText || generatedText.trim().length < 300) {
      console.log('Content too short, creating enhanced version');
      return createEnhancedContent(topic, contentType, keywords, title, customInstructions);
    }

    // Extract title from content if not provided
    let contentTitle = title;
    if (!contentTitle && generatedText.includes('#')) {
      const titleMatch = generatedText.match(/^#\s*(.+)$/m);
      if (titleMatch) {
        contentTitle = titleMatch[1].trim();
      }
    }

    return {
      title: contentTitle || `${topic} - Complete Guide`,
      content: generatedText,
      summary: `A comprehensive ${contentType.toLowerCase()} about ${topic}.`,
      keyPoints: keywords.length > 0 ? keywords : [
        "Practical, actionable information",
        "Evidence-based recommendations", 
        "Step-by-step guidance"
      ]
    };

  } catch (error) {
    console.error('Error generating content:', error);
    return createEnhancedContent(options.topic, options.contentType, options.keywords, options.title, options.customInstructions);
  }
};

// Enhanced fallback content creator
const createEnhancedContent = (topic, contentType, keywords, title, customInstructions) => {
  const baseTitle = title || `${topic} - Complete ${contentType.replace('_', ' ').toUpperCase()}`;
  
  let enhancedContent = '';
  
  if (contentType === 'medical_guide' || contentType === 'detailed_guide') {
    enhancedContent = `# ${baseTitle}

## Introduction

${topic} is an important aspect of health and fitness that many people seek to improve. This comprehensive guide provides detailed, actionable information to help you achieve your goals effectively and safely.

## Understanding the Basics

Before diving into specific techniques, it's important to understand the fundamental principles behind ${topic}. This foundation will help you make informed decisions and avoid common pitfalls.

${keywords.length > 0 ? `
## Key Focus Areas

Based on your specific interests, this guide covers:
${keywords.map(keyword => `- **${keyword.trim()}**: Detailed strategies and techniques`).join('\n')}
` : ''}

## Step-by-Step Implementation

### Phase 1: Getting Started
1. **Assessment**: Evaluate your current situation and set realistic goals
2. **Preparation**: Gather necessary resources and create your plan
3. **Initial Actions**: Begin with foundational practices

### Phase 2: Building Consistency
1. **Daily Practices**: Incorporate sustainable habits into your routine
2. **Progress Tracking**: Monitor your improvements and adjust as needed
3. **Troubleshooting**: Address common challenges and obstacles

### Phase 3: Advanced Techniques
1. **Optimization**: Fine-tune your approach for better results
2. **Prevention**: Avoid common mistakes and injuries
3. **Long-term Maintenance**: Establish practices for sustained success

## Practical Tips and Strategies

- **Start Small**: Begin with manageable steps and gradually increase intensity
- **Stay Consistent**: Regular practice yields better results than occasional intense efforts
- **Listen to Your Body**: Pay attention to feedback and adjust accordingly
- **Seek Professional Guidance**: Consult experts when needed for personalized advice

## Common Mistakes to Avoid

1. **Rushing Progress**: Allow adequate time for adaptation and improvement
2. **Neglecting Fundamentals**: Don't skip basic principles in pursuit of advanced techniques
3. **Ignoring Warning Signs**: Address discomfort or concerns promptly
4. **Inconsistent Approach**: Maintain regular practice for optimal results

## Expected Timeline and Results

- **Short-term (2-4 weeks)**: Initial adaptation and habit formation
- **Medium-term (1-3 months)**: Noticeable improvements and increased confidence
- **Long-term (3+ months)**: Significant progress and established expertise

## Frequently Asked Questions

**Q: How quickly can I expect to see results?**
A: Most people notice initial improvements within 2-4 weeks of consistent practice, with more significant results appearing after 2-3 months.

**Q: What if I encounter difficulties?**
A: Challenges are normal. Review the fundamentals, adjust your approach if needed, and consider consulting a professional for personalized guidance.

**Q: How can I maintain motivation?**
A: Set clear goals, track your progress, celebrate small victories, and remember why you started this journey.

## Conclusion

${topic} is an achievable goal with the right approach and consistent effort. This guide provides the foundation you need to get started and make meaningful progress. Remember that individual results may vary, and it's always wise to consult with healthcare or fitness professionals for personalized advice.

*This content is provided for educational purposes. Always consult with qualified professionals for advice tailored to your specific circumstances.*`;
  }

  return {
    title: baseTitle,
    content: enhancedContent,
    summary: `A detailed ${contentType.replace('_', ' ')} about ${topic} with practical guidance.`,
    keyPoints: keywords.length > 0 ? keywords : [
      "Step-by-step implementation guide",
      "Practical strategies and techniques",
      "Common challenges and solutions",
      "Realistic timeline and expectations"
    ]
  };
};
