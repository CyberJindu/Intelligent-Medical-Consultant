import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import specialistRoutes from './routes/specialists.js';
import feedRoutes from './routes/feed.js';
import specialistAuthRoutes from './routes/specialistAuth.js';
import contentRoutes from './routes/content.js';
import specialistProfileRoutes from './routes/specialistProfile.js';

// Import middleware
import { corsMiddleware, errorHandler, notFoundHandler } from './middleware/validation.js';

// Import database connection
import connectDB from './config/database.js';

// Import utils for initial setup
import { createSampleHealthContent } from './utils/contentGenerator.js';

// Load environment variables
dotenv.config();

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins temporarily
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'MediGuide API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to MediGuide API',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'Phone number login/registration',
        'GET /api/auth/profile': 'Get user profile (protected)',
        'PUT /api/auth/profile': 'Update user profile (protected)'
      },
      chat: {
        'POST /api/chat/send': 'Send message to AI (protected)',
        'GET /api/chat/conversations': 'Get user conversations (protected)',
        'GET /api/chat/conversations/:id': 'Get specific conversation (protected)',
        'DELETE /api/chat/conversations/:id': 'Delete conversation (protected)'
      },
      specialists: {
        'POST /api/specialists/recommend': 'Get recommended specialists (protected)',
        'GET /api/specialists': 'Get all specialists (protected)',
        'GET /api/specialists/:id': 'Get specific specialist (protected)'
      },
      feed: {
        'GET /api/feed/personalized': 'Get personalized health feed (protected)',
        'GET /api/feed/by-topics': 'Get feed by topics (protected)',
        'POST /api/feed/articles/:id/save': 'Save article (protected)',
        'POST /api/feed/articles/:id/share': 'Share article (protected)'
      }
    },
    documentation: 'See README for detailed API documentation'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/specialists', specialistRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/auth/specialist', specialistAuthRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/specialist', specialistProfileRoutes);

// 404 handler for undefined API routes
app.use('/api/*', notFoundHandler);

// Error handling middleware (should be last)
app.use(errorHandler);

// Initialize database and sample data
const initializeApp = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Create sample health content if needed
    await createSampleHealthContent();
    
    console.log('✅ MediGuide backend initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    process.exit(1);
  }
};

// Call initialization
initializeApp();


export default app;



