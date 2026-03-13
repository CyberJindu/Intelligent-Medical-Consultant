import mongoose from 'mongoose';

const specialistSchema = new mongoose.Schema({
  // Authentication fields
  email: {
    type: String,
    required: true,
    unique: true,  
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  profilePicture: {
    type: String,
    trim: true
  },
  cloudinaryId: {
    type: String,
    trim: true
  },
  accountStatus: {
    type: String,
    enum: ['pending', 'approved', 'blocked'],
    default: 'pending'
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'rejected'],
    default: 'unverified'
  },
  verificationDocuments: [{
    documentType: String,
    documentUrl: String,
    uploadedAt: Date
  }],
  // Professional fields
  name: {
    type: String,
    required: true,
    trim: true
  },
  specialty: {
    type: String,
    required: true,
    trim: true
  },
  subSpecialty: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  experience: {
    type: Number,
    min: 0
  },
  languages: [{
    type: String,
    trim: true
  }],
  availability: {
    type: String,
    trim: true
  },
  responseTime: {
    type: String,
    trim: true
  },
  consultationFee: {
    type: String,
    trim: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    trim: true
  },
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number
  }],
  services: [{
    type: String,
    trim: true
  }],
  medicalLicenseNumber: {
    type: String,
    trim: true
  },
  licenseExpiry: {
    type: Date
  },
  isAvailableForConsultation: {
    type: Boolean,
    default: true
  },
  consultationTypes: [{
    type: String,
    enum: ['in-person', 'video', 'phone', 'chat']
  }],
  
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Keep ONLY these indexes (remove duplicates)
specialistSchema.index({ isActive: 1, isOnline: 1 });
specialistSchema.index({ name: 'text', specialty: 'text', bio: 'text' });
specialistSchema.index({ accountStatus: 1 });

// Virtual for formatted experience
specialistSchema.virtual('formattedExperience').get(function() {
  if (!this.experience) return null;
  return `${this.experience} year${this.experience !== 1 ? 's' : ''} experience`;
});

// Method to update rating
specialistSchema.methods.updateRating = async function(newRating) {
  const totalRating = (this.rating * this.reviewCount) + newRating;
  this.reviewCount += 1;
  this.rating = totalRating / this.reviewCount;
  return this.save();
};

// Transform output
specialistSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Specialist', specialistSchema);

