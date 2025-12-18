// controllers/specialistDashboardController.js
import Specialist from '../models/Specialist.js';
import GeneratedContent from '../models/GeneratedContent.js';
import mongoose from 'mongoose';

// Get performance statistics for dashboard
export const getPerformanceStats = async (req, res) => {
  try {
    const specialistId = req.specialistId;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get specialist basic info
    const specialist = await Specialist.findById(specialistId)
      .select('name specialty rating reviewCount verificationStatus');

    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    // Get content statistics
    const contentStats = await GeneratedContent.aggregate([
      {
        $match: {
          specialistId: new mongoose.Types.ObjectId(specialistId),
          isPublished: true
        }
      },
      {
        $group: {
          _id: null,
          totalContent: { $sum: 1 },
          last30DaysContent: {
            $sum: {
              $cond: [{ $gte: ["$generatedAt", thirtyDaysAgo] }, 1, 0]
            }
          },
          avgWordCount: { $avg: "$wordCount" }
        }
      }
    ]);

    // Calculate engagement metrics (you'll need to add these fields to GeneratedContent model)
    const engagementStats = await GeneratedContent.aggregate([
      {
        $match: {
          specialistId: new mongoose.Types.ObjectId(specialistId),
          isPublished: true
        }
      },
      {
        $group: {
          _id: null,
          // TODO: Add these fields to GeneratedContent model
          // totalViews: { $sum: "$views" },
          // totalLikes: { $sum: "$likes" },
          // totalShares: { $sum: "$shares" }
          totalViews: { $sum: 0 }, // Placeholder
          totalLikes: { $sum: 0 }, // Placeholder
          totalShares: { $sum: 0 }  // Placeholder
        }
      }
    ]);

    const stats = contentStats[0] || {
      totalContent: 0,
      last30DaysContent: 0,
      avgWordCount: 0
    };

    const engagement = engagementStats[0] || {
      totalViews: 0,
      totalLikes: 0,
      totalShares: 0
    };

    // Calculate engagement rate (if we have views)
    const engagementRate = engagement.totalViews > 0 
      ? ((engagement.totalLikes + engagement.totalShares) / engagement.totalViews * 100).toFixed(1)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        specialist: {
          name: specialist.name,
          specialty: specialist.specialty,
          rating: specialist.rating,
          reviewCount: specialist.reviewCount,
          verificationStatus: specialist.verificationStatus
        },
        metrics: {
          // Core metrics requested
          patientsReached: engagement.totalViews, // Using views as proxy for now
          contentViews: engagement.totalViews,
          engagementRate: `${engagementRate}%`,
          contentCreated: stats.totalContent,
          
          // Additional professional metrics
          averageRating: specialist.rating.toFixed(1),
          reviewsCount: specialist.reviewCount,
          last30DaysContent: stats.last30DaysContent,
          averageWordCount: Math.round(stats.avgWordCount || 0)
        }
      }
    });

  } catch (error) {
    console.error('Get performance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance statistics',
      error: error.message
    });
  }
};

// Get detailed analytics (optional - for future enhancement)
export const getAnalytics = async (req, res) => {
  try {
    const specialistId = req.specialistId;
    const { timeframe = '30days' } = req.query;
    
    // Implementation for detailed analytics
    // This can be expanded later
    
    res.status(200).json({
      success: true,
      message: 'Analytics endpoint - to be implemented',
      data: {}
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
};
