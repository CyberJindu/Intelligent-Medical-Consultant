import GeneratedContent from '../models/GeneratedContent.js';
import Specialist from '../models/Specialist.js';
import { generateMedicalContent } from '../utils/specialistContent.js'; 

/**
 * 1. Generate new medical content (FOR REVIEW ONLY - NO DATABASE SAVE)
 */
export const generateContent = async (req, res) => {
  try {
    const { 
      topic, 
      contentType, 
      targetAudience, 
      tone, 
      wordCount, 
      keywords 
    } = req.body;

    // Assuming specialistId is attached by specialistAuth middleware
    const specialistId = req.specialistId; 

    // --- Validation Checks ---
    if (!topic || !contentType) {
      return res.status(400).json({
        success: false,
        message: 'Topic and content type are required'
      });
    }

    const validContentTypes = ['article', 'social_media', 'patient_education', 'blog_post', 'medical_guide'];
    const validAudiences = ['general_public', 'patients', 'medical_students', 'healthcare_professionals'];

    if (!validContentTypes.includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid content type. Must be one of: ${validContentTypes.join(', ')}`
      });
    }

    if (targetAudience && !validAudiences.includes(targetAudience)) {
      return res.status(400).json({
        success: false,
        message: `Invalid target audience. Must be one of: ${validAudiences.join(', ')}`
      });
    }

    // Get specialist details to pass specialty to AI helper
    const specialist = await Specialist.findById(specialistId);
    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    console.log('Generating content with params:', {
      topic, contentType, targetAudience, tone, specialistSpecialization: specialist.specialty
    });

    // Generate content using AI
    const generatedContent = await generateMedicalContent({
      topic,
      contentType,
      targetAudience: targetAudience || 'general_public',
      tone: tone || 'professional',
      wordCount: wordCount || 500,
      keywords: keywords || [],
      specialistSpecialization: specialist.specialty
    });

    console.log('Generated content received:', {
      title: generatedContent.title,
      contentLength: generatedContent.content?.length
    });

    // --- FIX 1: Check for empty content and return for review (DO NOT SAVE) ---
    if (!generatedContent || !generatedContent.content || generatedContent.content.trim().length === 0) {
        // Return a 424 Failed Dependency error if AI returns no content
        return res.status(424).json({ 
            success: false, 
            message: 'AI failed to generate content or returned an empty response. Please try again or modify your parameters.', 
            error: 'Empty content returned by AI.'
        });
    }

    // Return the generated content to the client for review/editing.
    res.status(200).json({ 
      success: true,
      message: 'Content generated successfully. Awaiting specialist review.',
      data: generatedContent // Send the full generated content object back
    });

  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate content',
      error: error.message
    });
  }
};

/**
 * 2. Approve and Save Generated Content (New Endpoint for Approval)
 */
export const approveAndSaveContent = async (req, res) => {
    try {
        const {
            title,
            content,
            contentType,
            topic,
            targetAudience,
            tone,
            wordCount,
            keywords
        } = req.body;
        
        const specialistId = req.specialistId;

        // Basic validation for required fields before saving
        if (!title || !content || !contentType || !topic) {
            return res.status(400).json({
                success: false,
                message: 'Title, content, content type, and topic are required for approval.'
            });
        }

        console.log('📝 Saving content for specialist:', specialistId);
        console.log('📝 Content title:', title);
        console.log('📝 Word count:', content.length);

        // Create a new instance of the model with the reviewed/edited data
        const newContent = new GeneratedContent({
            specialistId,
            title,
            content,
            contentType,
            topic,
            targetAudience: targetAudience || 'general_public',
            tone: tone || 'professional',
            wordCount: wordCount || content.length, // Recalculate word count based on final content
            keywords: keywords || [],
            isPublished: true,
            generatedAt: new Date()
        });
            
        console.log('📝 New content object:', newContent);

        // Save the approved content to the database
        await newContent.save();
        console.log('✅ Content saved with ID:', newContent._id);

        res.status(201).json({
            success: true,
            message: 'Content approved and published successfully!',
            data: newContent
        });

    } catch (error) {
        // This will catch the Mongoose validation errors (like content is required)
        console.error('Content approval and save error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve and publish content',
            error: error.message
        });
    }
};


/**
 * Get specialist's content history
 */
export const getContentHistory = async (req, res) => {
  // ... (CONTENT REMAINS THE SAME)
  try {
    const specialistId = req.specialistId;
    const { page = 1, limit = 100, contentType, isPublished } = req.query;

    const filter = { specialistId };
    if (contentType) filter.contentType = contentType;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

    const content = await GeneratedContent.find(filter)
      .sort({ generatedAt: -1 })
      .limit(limit * 100)
      .skip((page - 1) * limit)
      .exec();

    const total = await GeneratedContent.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        content,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    console.error('Get content history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch content history',
      error: error.message
    });
  }
};

/**
 * Update generated content
 */
export const updateContent = async (req, res) => {
  // ... (CONTENT REMAINS THE SAME)
  try {
    const { id } = req.params;
    const { title, content, isPublished } = req.body;
    const specialistId = req.specialistId;

    const existingContent = await GeneratedContent.findOne({
      _id: id,
      specialistId
    });

    if (!existingContent) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    // Update fields
    if (title) existingContent.title = title;
    if (content) existingContent.content = content;
    if (isPublished !== undefined) existingContent.isPublished = isPublished;
    
    existingContent.lastModified = new Date();

    await existingContent.save();

    res.status(200).json({
      success: true,
      message: 'Content updated successfully',
      data: existingContent
    });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update content',
      error: error.message
    });
  }
};

/**
 * Delete content
 */
export const deleteContent = async (req, res) => {
  // ... (CONTENT REMAINS THE SAME)
  try {
    const { id } = req.params;
    const specialistId = req.specialistId;

    const content = await GeneratedContent.findOneAndDelete({
      _id: id,
      specialistId
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete content',
      error: error.message
    });
  }
};

/**
 * Get content statistics for specialist
 */
export const getContentStats = async (req, res) => {
  try {
    const specialistId = req.specialistId;

    const stats = await GeneratedContent.aggregate([
      {
        $match: {
          specialistId: new mongoose.Types.ObjectId(specialistId)
        }
      },
      {
        $group: {
          _id: "$contentType",
          count: { $sum: 1 },
          published: {
            $sum: { $cond: [{ $eq: ["$isPublished", true] }, 1, 0] }
          },
          avgWordCount: { $avg: "$wordCount" }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Calculate totals
    const totalContent = await GeneratedContent.countDocuments({ specialistId });
    const publishedContent = await GeneratedContent.countDocuments({ 
      specialistId, 
      isPublished: true 
    });

    res.status(200).json({
      success: true,
      data: {
        totalContent,
        publishedContent,
        draftContent: totalContent - publishedContent,
        byType: stats,
        publicationRate: totalContent > 0 ? ((publishedContent / totalContent) * 100).toFixed(1) : 0
      }
    });

  } catch (error) {
    console.error('Get content stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch content statistics',
      error: error.message
    });
  }
};
