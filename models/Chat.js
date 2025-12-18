import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  isUser: {
    type: Boolean,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  messages: [messageSchema],
  tags: [{
    type: String,
    trim: true
  }],
  // ⚡ UPDATED: Enhanced health state tracking
  healthState: {
    type: String,
    enum: ['critical', 'urgent', 'routine', 'informational'],
    default: 'routine'
  },
  severityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  specialistAdvised: {
    type: Boolean,
    default: false
  },
  recommendedSpecialty: {
    type: String,
    trim: true
  },
  // Original fields (kept for backward compatibility)
  hasEmergency: {
    type: Boolean,
    default: false
  },
  specialistRecommended: {
    type: Boolean,
    default: false
  },
  // New: Analysis metadata
  lastAnalysisAt: {
    type: Date
  },
  keySymptoms: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Index for faster queries
chatSchema.index({ userId: 1, updatedAt: -1 });
chatSchema.index({ userId: 1, healthState: 1 }); // ⚡ NEW: Health state index
chatSchema.index({ healthState: 1, updatedAt: -1 }); // ⚡ NEW: For admin monitoring
chatSchema.index({ 'messages.timestamp': -1 });

// Virtual for last message
chatSchema.virtual('lastMessage').get(function() {
  if (this.messages.length === 0) return null;
  return this.messages[this.messages.length - 1];
});

// Virtual for message count
chatSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

// ⚡ NEW: Method to update health state
chatSchema.methods.updateHealthState = function(healthState, severityScore, specialty = null) {
  this.healthState = healthState;
  this.severityScore = severityScore;
  
  if (healthState === 'critical' || healthState === 'urgent') {
    this.specialistAdvised = true;
    this.hasEmergency = true;
    this.specialistRecommended = true;
  }
  
  if (specialty) {
    this.recommendedSpecialty = specialty;
  }
  
  this.lastAnalysisAt = new Date();
  return this.save();
};

// Method to add message
chatSchema.methods.addMessage = function(text, isUser) {
  this.messages.push({
    text: text.trim(),
    isUser,
    timestamp: new Date()
  });
  this.updatedAt = new Date();
  return this.save();
};

// Transform output
chatSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Chat', chatSchema);
