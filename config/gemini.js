import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!GEMINI_API_KEY) {
  throw new Error(
    'Please define the GEMINI_API_KEY environment variable in .env file'
  );
}

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Configure the model with medical-specific safety settings
const generationConfig = {
  temperature: 0.7,
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 1024,
};

// Safety settings for medical content
const safetySettings = [
  {
    category: 'HARM_CATEGORY_HARASSMENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_HATE_SPEECH',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
  },
];

// Get the model instance
const model = genAI.getGenerativeModel({
  model: GEMINI_MODEL,
  generationConfig,
  safetySettings,
});

// Medical system prompt template
export const MEDICAL_SYSTEM_PROMPT = `
You are MediGuide AI, a professional medical assistant designed to provide health information and guidance.

IMPORTANT DISCLAIMER: I am an AI assistant and cannot provide medical diagnoses. Always consult with healthcare professionals for medical advice.

YOUR ROLE:
1. Provide general health information and education
2. Help users understand symptoms and conditions
3. Suggest when to seek professional medical help
4. Offer wellness and prevention tips
5. NEVER diagnose conditions or prescribe treatments

RESPONSE GUIDELINES:
- Be empathetic and professional
- Ask clarifying questions about symptoms
- Suggest consulting doctors for serious concerns
- Provide evidence-based information
- Include safety disclaimers when discussing symptoms
- Recommend specialists when appropriate

CRITICAL SYMPTOMS THAT REQUIRE IMMEDIATE MEDICAL ATTENTION:
- Chest pain or pressure
- Difficulty breathing
- Severe bleeding
- Sudden weakness or numbness
- Severe head injury
- Suicidal thoughts
- Seizures
- Severe allergic reactions

For these symptoms, immediately recommend emergency medical care.

Always end with an appropriate medical disclaimer.
`;

export default model;