import Specialist from '../models/Specialist.js';
import { findMatchingSpecialists, getVerifiedSpecialistsBySpecialty } from '../utils/specialistMatching.js';

// Get recommended specialists based on conversation WITH VERIFICATION PRIORITY
export const getRecommendedSpecialists = async (req, res) => {
  try {
    const { conversationContext } = req.body;

    if (!conversationContext) {
      return res.status(400).json({
        success: false,
        message: 'Conversation context is required'
      });
    }

    // Use updated matching function with verification priority
    const specialists = await findMatchingSpecialists({ 
      recommendedSpecialty: 'General Physician', // Default
      severity: 'routine',
      conversationContext 
    }, 5);

    // Format response with verification highlights
    const formattedSpecialists = specialists.map(specialist => ({
      _id: specialist._id,
      name: specialist.name,
      specialty: specialist.specialty,
      subSpecialty: specialist.subSpecialty,
      bio: specialist.bio,
      rating: specialist.rating,
      experience: specialist.experience,
      verificationStatus: specialist.verificationStatus,
      verificationLevel: specialist.verificationLevel,
      isVerified: specialist.verificationStatus === 'verified',
      matchScore: specialist.matchScore,
      verificationBoost: specialist.verificationBoost,
      totalScore: specialist.totalScore,
      languages: specialist.languages,
      responseTime: specialist.responseTime,
      consultationTypes: specialist.consultationTypes,
      rank: specialists.indexOf(specialist) + 1
    }));

    res.status(200).json({
      success: true,
      data: {
        specialists: formattedSpecialists,
        verificationImpact: true, // Indicates verification affected ranking
        topSpecialistVerified: formattedSpecialists[0]?.isVerified || false,
        verifiedCount: formattedSpecialists.filter(s => s.isVerified).length
      }
    });

  } catch (error) {
    console.error('Specialist recommendation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get specialist recommendations',
      error: error.message
    });
  }
};

// Get all specialists with verification filtering
export const getAllSpecialists = async (req, res) => {
  try {
    const { specialty, search, verifiedOnly } = req.query;
    
    let filter = { isActive: true };
    
    if (specialty) {
      filter.specialty = { $regex: specialty, $options: 'i' };
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } },
        { bio: { $regex: search, $options: 'i' } }
      ];
    }
    
    // VERIFICATION FILTER
    if (verifiedOnly === 'true') {
      filter.verificationStatus = 'verified';
    }

    const specialists = await Specialist.find(filter)
      .select('name specialty bio rating experience verificationStatus verificationLevel verificationDate languages isAvailableForConsultation')
      .sort({ 
        verificationStatus: -1, // Verified first
        verificationLevel: -1, // Expert first
        rating: -1 
      });

    res.status(200).json({
      success: true,
      data: { 
        specialists,
        verifiedCount: specialists.filter(s => s.verificationStatus === 'verified').length,
        totalCount: specialists.length
      }
    });

  } catch (error) {
    console.error('Get specialists error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch specialists',
      error: error.message
    });
  }
};

// Get specific specialist details
export const getSpecialist = async (req, res) => {
  try {
    const { specialistId } = req.params;

    const specialist = await Specialist.findOne({ 
      _id: specialistId, 
      isActive: true 
    }).select('-password');

    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    // Add verification highlights
    const specialistWithHighlights = {
      ...specialist.toObject(),
      isVerified: specialist.verificationStatus === 'verified',
      verificationBadge: specialist.verificationStatus === 'verified' ? 
        `${specialist.verificationLevel || 'basic'} verified` : null,
      verificationDateFormatted: specialist.verificationDate ? 
        specialist.verificationDate.toLocaleDateString() : null
    };

    res.status(200).json({
      success: true,
      data: { specialist: specialistWithHighlights }
    });

  } catch (error) {
    console.error('Get specialist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch specialist details',
      error: error.message
    });
  }
};

// Get only verified specialists
export const getVerifiedSpecialists = async (req, res) => {
  try {
    const { specialty } = req.query;
    
    let filter = { 
      isActive: true,
      verificationStatus: 'verified'
    };
    
    if (specialty) {
      filter.specialty = { $regex: specialty, $options: 'i' };
    }

    const specialists = await Specialist.find(filter)
      .select('name specialty bio rating experience verificationLevel verificationDate languages')
      .sort({ verificationLevel: -1, rating: -1 })
      .limit(20);

    res.status(200).json({
      success: true,
      data: { 
        specialists,
        count: specialists.length,
        levels: {
          expert: specialists.filter(s => s.verificationLevel === 'expert').length,
          advanced: specialists.filter(s => s.verificationLevel === 'advanced').length,
          basic: specialists.filter(s => s.verificationLevel === 'basic').length
        }
      }
    });

  } catch (error) {
    console.error('Get verified specialists error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch verified specialists',
      error: error.message
    });
  }
};
