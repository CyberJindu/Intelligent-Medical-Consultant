import mongoose from 'mongoose';

const generatedContentSchema = new mongoose.Schema({
  specialistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Specialist',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ['article', 'social_media', 'patient_education', 'blog_post', 'medical_guide'],
    required: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  targetAudience: {
    type: String,
    enum: ['general_public', 'patients', 'medical_students', 'healthcare_professionals'],
    default: 'general_public'
  },
  tone: {
    type: String,
    enum: ['professional', 'friendly', 'educational', 'empathetic', 'authoritative', 'encouraging'],
    default: 'professional'
  },
  wordCount: {
    type: Number,
    default: 500
  },
  keywords: [{
    type: String,
    trim: true
  }],
  
  // NEW FIELDS FOR ENGAGEMENT TRACKING
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  uniqueViewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  isPublished: {
    type: Boolean,
    default: false
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
generatedContentSchema.index({ specialistId: 1, generatedAt: -1 });
generatedContentSchema.index({ contentType: 1, isPublished: 1 });

export default mongoose.model('GeneratedContent', generatedContentSchema);
