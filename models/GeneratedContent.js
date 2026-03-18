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
  
  // Engagement tracking
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
  saveCount: {
    type: Number,
    default: 0
  },
  uniqueViewers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Feed display fields
  authorName: {
    type: String,
    trim: true
  },
  authorSpecialty: {
    type: String,
    trim: true
  },
  excerpt: {
    type: String,
    trim: true,
    maxlength: 300
  },
  readTime: {
    type: String,
    default: '5 min read'
  },
  feedTopics: [{
    type: String,
    trim: true,
    lowercase: true
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
  },
  
  // Admin audit fields
  isActive: {
    type: Boolean,
    default: true
  },
  needsReview: {
    type: Boolean,
    default: false
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
generatedContentSchema.index({ specialistId: 1, generatedAt: -1 });
generatedContentSchema.index({ contentType: 1, isPublished: 1 });
generatedContentSchema.index({ isPublished: 1, generatedAt: -1 });
generatedContentSchema.index({ topic: 1, isPublished: 1 });
generatedContentSchema.index({ keywords: 1, isPublished: 1 });
generatedContentSchema.index({ isActive: 1, isPublished: 1 });
generatedContentSchema.index({ title: 'text', content: 'text', topic: 'text', keywords: 'text' });

// Pre-save middleware
generatedContentSchema.pre('save', function(next) {
  // Auto-generate excerpt if not provided
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 200) + 
                  (this.content.length > 200 ? '...' : '');
  }
  
  // Auto-calculate read time
  if (this.content && !this.readTime) {
    const wordCount = this.content.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 200);
    this.readTime = `${minutes} min read`;
  }
  
  // Auto-generate feed topics if not provided
  if ((!this.feedTopics || this.feedTopics.length === 0) && this.topic) {
    const topics = new Set();
    topics.add(this.topic.toLowerCase());
    
    if (this.keywords && Array.isArray(this.keywords)) {
      this.keywords.forEach(keyword => {
        if (keyword && typeof keyword === 'string') {
          topics.add(keyword.toLowerCase());
        }
      });
    }
    
    if (this.contentType) {
      topics.add(this.contentType.toLowerCase().replace('_', ' '));
    }
    
    const healthCategories = ['health', 'wellness', 'medical', 'doctor', 'advice'];
    healthCategories.forEach(category => topics.add(category));
    
    this.feedTopics = Array.from(topics).slice(0, 8);
  }
  
  this.lastModified = new Date();
  next();
});

// Method to increment view count
generatedContentSchema.methods.incrementView = function(userId) {
  this.views += 1;
  
  if (userId && !this.uniqueViewers.includes(userId)) {
    this.uniqueViewers.push(userId);
  }
  
  return this.save();
};

// Method to increment like count
generatedContentSchema.methods.incrementLike = function() {
  this.likes += 1;
  return this.save();
};

// Transform output
generatedContentSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.uniqueViewers;
    return ret;
  }
});

export default mongoose.model('GeneratedContent', generatedContentSchema);
