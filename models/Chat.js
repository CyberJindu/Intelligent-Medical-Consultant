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
  hasEmergency: {
    type: Boolean,
    default: false
  },
  specialistRecommended: {
    type: Boolean,
    default: false
  },
  recommendedSpecialty: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
chatSchema.index({ userId: 1, updatedAt: -1 });
chatSchema.index({ userId: 1, hasEmergency: 1 });
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