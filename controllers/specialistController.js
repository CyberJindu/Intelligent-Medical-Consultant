import Specialist from '../models/Specialist.js';
import { analyzeConversationForSpecialist } from '../utils/specialistMatching.js';

// Get recommended specialists based on conversation
export const getRecommendedSpecialists = async (req, res) => {
  try {
    const { conversationContext } = req.body;

    if (!conversationContext) {
      return res.status(400).json({
        success: false,
        message: 'Conversation context is required'
      });
    }

    // Analyze conversation to determine needed specialty
    const analysis = await analyzeConversationForSpecialist(conversationContext);
    
    let specialists = [];
    
    if (analysis.recommendedSpecialty) {
      // Find specialists matching the recommended specialty
      specialists = await Specialist.find({
        specialty: { $regex: analysis.recommendedSpecialty, $options: 'i' },
        isActive: true
      })
      .select('name specialty bio rating experience phone availability')
      .limit(5)
      .sort({ rating: -1, experience: -1 });
    }

    // If no specific specialty found or no specialists, return general physicians
    if (specialists.length === 0) {
      specialists = await Specialist.find({
        specialty: { $regex: 'general|physician', $options: 'i' },
        isActive: true
      })
      .select('name specialty bio rating experience phone availability')
      .limit(3)
      .sort({ rating: -1 });
    }

    res.status(200).json({
      success: true,
      data: {
        specialists,
        analysis: {
          recommendedSpecialty: analysis.recommendedSpecialty,
          severity: analysis.severity,
          confidence: analysis.confidence
        }
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

// Get all specialists (for browsing)
export const getAllSpecialists = async (req, res) => {
  try {
    const { specialty, search } = req.query;
    
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

    const specialists = await Specialist.find(filter)
      .select('name specialty bio rating experience phone availability languages isOnline')
      .sort({ rating: -1, isOnline: -1 });

    res.status(200).json({
      success: true,
      data: { specialists }
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
    });

    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { specialist }
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