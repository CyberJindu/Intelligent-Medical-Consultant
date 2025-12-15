import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say']
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  allergies: [{
    type: String,
    trim: true
  }],
  medications: [{
    name: String,
    dosage: String,
    frequency: String
  }],
  medicalConditions: [{
    type: String,
    trim: true
  }],
  
  // Conversation Topics Storage
  conversationTopics: [{
    topic: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    category: {
      type: String,
      enum: ['symptom', 'condition', 'treatment', 'prevention', 'wellness', 'nutrition', 'other'],
      default: 'symptom'
    },
    severity: {
      type: String,
      enum: ['critical', 'urgent', 'routine', 'informational'],
      default: 'routine'
    },
    firstMentioned: {
      type: Date,
      default: Date.now
    },
    lastMentioned: {
      type: Date,
      default: Date.now
    },
    mentionCount: {
      type: Number,
      default: 1
    },
    context: String // Brief context/summary from conversation
  }],
  
  // Health Interests derived from conversations
  healthInterests: [{
    topic: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    relevanceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    lastEngaged: {
      type: Date,
      default: Date.now
    },
    contentTypePreferences: [{
      type: String,
      enum: ['article', 'video', 'tips', 'research', 'guide']
    }]
  }],
  
  // Content engagement tracking
  contentEngagement: [{
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthPost'
    },
    contentType: String,
    engagementType: {
      type: String,
      enum: ['viewed', 'saved', 'shared', 'commented']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    duration: Number // seconds spent viewing
  }],
  
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  profileUpdatedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ phoneNumber: 1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ 'conversationTopics.topic': 1 }); // For topic-based queries
userSchema.index({ 'conversationTopics.lastMentioned': -1 }); // For recency
userSchema.index({ 'healthInterests.relevanceScore': -1 }); // For interest ranking

// Virtual for user age
userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Method to update conversation topics
userSchema.methods.updateConversationTopics = async function(newTopics, context = '') {
  const currentTopics = this.conversationTopics || [];
  
  newTopics.forEach(newTopic => {
    const existingIndex = currentTopics.findIndex(
      t => t.topic === newTopic.topic && t.category === newTopic.category
    );
    
    if (existingIndex >= 0) {
      // Update existing topic
      currentTopics[existingIndex].lastMentioned = new Date();
      currentTopics[existingIndex].mentionCount += 1;
      if (context) {
        currentTopics[existingIndex].context = context.substring(0, 100); // Limit context length
      }
    } else {
      // Add new topic
      currentTopics.push({
        ...newTopic,
        firstMentioned: new Date(),
        lastMentioned: new Date(),
        mentionCount: 1,
        context: context ? context.substring(0, 100) : ''
      });
    }
  });
  
  this.conversationTopics = currentTopics;
  return this.save();
};

// Method to get top health interests
userSchema.methods.getTopHealthInterests = function(limit = 5) {
  const topics = this.conversationTopics || [];
  
  // Calculate frequency and recency scores
  const interestMap = {};
  
  topics.forEach(topic => {
    if (!interestMap[topic.topic]) {
      interestMap[topic.topic] = {
        topic: topic.topic,
        mentionCount: 0,
        lastMentioned: topic.lastMentioned,
        category: topic.category,
        severity: topic.severity
      };
    }
    
    interestMap[topic.topic].mentionCount += topic.mentionCount;
    // Keep the most recent date
    if (topic.lastMentioned > interestMap[topic.topic].lastMentioned) {
      interestMap[topic.topic].lastMentioned = topic.lastMentioned;
    }
  });
  
  // Convert to array and calculate relevance scores
  const interests = Object.values(interestMap).map(item => {
    // Calculate score based on frequency and recency
    const recencyScore = Math.max(0, 100 - 
      (Date.now() - new Date(item.lastMentioned).getTime()) / (1000 * 60 * 60 * 24)
    );
    const frequencyScore = Math.min(item.mentionCount * 10, 100);
    
    return {
      ...item,
      relevanceScore: Math.round((recencyScore * 0.4) + (frequencyScore * 0.6))
    };
  });
  
  // Sort by relevance score
  interests.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return interests.slice(0, limit);
};

// Transform output
userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('User', userSchema);
