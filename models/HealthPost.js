import mongoose from 'mongoose';

const healthPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true
  },
  excerpt: {
    type: String,
    trim: true,
    maxlength: 300
  },
  author: {
    type: String,
    required: true,
    trim: true,
    default: 'MediGuide Health Team'
  },
  publishDate: {
    type: Date,
    default: Date.now
  },
  readTime: {
    type: String, // e.g., "5 min read"
    default: '5 min read'
  },
  topics: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  image: {
    type: String, // URL to featured image
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  shareCount: {
    type: Number,
    default: 0
  },
  saveCount: {
    type: Number,
    default: 0
  },
  targetAudience: {
    ageRange: {
      min: Number,
      max: Number
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'all']
    },
    conditions: [String]
  },
  medicalDisclaimer: {
    type: String,
    default: 'This content is for informational purposes only and is not a substitute for professional medical advice.'
  },
  sources: [{
    title: String,
    url: String
  }]
}, {
  timestamps: true
});

// Index for faster queries
healthPostSchema.index({ publishDate: -1 });
healthPostSchema.index({ topics: 1, publishDate: -1 });
healthPostSchema.index({ isActive: 1 });
healthPostSchema.index({ title: 'text', content: 'text', topics: 'text' });

// Virtual for formatted date
healthPostSchema.virtual('formattedDate').get(function() {
  return this.publishDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Pre-save middleware to generate excerpt if not provided
healthPostSchema.pre('save', function(next) {
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 250) + 
                  (this.content.length > 250 ? '...' : '');
  }
  
  // Calculate read time (assuming 200 words per minute)
  if (this.content && !this.readTime) {
    const wordCount = this.content.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / 200);
    this.readTime = `${minutes} min read`;
  }
  
  next();
});

// Method to increment share count
healthPostSchema.methods.incrementShareCount = function() {
  this.shareCount += 1;
  return this.save();
};

// Method to increment save count
healthPostSchema.methods.incrementSaveCount = function() {
  this.saveCount += 1;
  return this.save();
};

// Transform output
healthPostSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('HealthPost', healthPostSchema);