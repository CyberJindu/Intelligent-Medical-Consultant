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
      .select('name specialty rating reviewCount verificationStatus experience');

    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    // Get content statistics (total content, last 30 days, avg word count)
    const contentStats = await GeneratedContent.aggregate([
      {
        $match: {
          specialistId: new mongoose.Types.ObjectId(specialistId),
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

    // Get total views (sum of all views)
    const viewsStats = await GeneratedContent.aggregate([
      {
        $match: {
          specialistId: new mongoose.Types.ObjectId(specialistId),
          isPublished: true
        }
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$views" },
          totalLikes: { $sum: "$likes" },
          totalShares: { $sum: "$shares" }
        }
      }
    ]);

    // Get UNIQUE PATIENTS REACHED (unique viewers across all content)
    // First, get all uniqueViewers arrays and combine them
    const allContent = await GeneratedContent.find({
      specialistId: specialistId,
      isPublished: true
    }).select('uniqueViewers');

    // Collect all unique user IDs across all content
    const uniqueViewerIds = new Set();
    allContent.forEach(content => {
      if (content.uniqueViewers && Array.isArray(content.uniqueViewers)) {
        content.uniqueViewers.forEach(viewerId => {
          uniqueViewerIds.add(viewerId.toString());
        });
      }
    });

    const uniquePatientsReached = uniqueViewerIds.size;

    const stats = contentStats[0] || {
      totalContent: 0,
      last30DaysContent: 0,
      avgWordCount: 0
    };

    const views = viewsStats[0] || {
      totalViews: 0,
      totalLikes: 0,
      totalShares: 0
    };

    // Calculate engagement rate based on total views
    const engagementRate = views.totalViews > 0 
      ? ((views.totalLikes + views.totalShares) / views.totalViews * 100).toFixed(1)
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
          // Core metrics - NOW CORRECTLY SEPARATED
          patientsReached: uniquePatientsReached,  // ← Unique users who viewed any content
          contentViews: views.totalViews,          // ← Total views across all content
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
