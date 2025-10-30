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

// Transform output
userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('User', userSchema);