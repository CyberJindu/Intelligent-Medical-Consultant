import GeneratedContent from '../models/GeneratedContent.js';
import Specialist from '../models/Specialist.js';
import { generateMedicalContent } from '../utils/contentGenerator.js';

/**
 * Generate new medical content
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

    const specialistId = req.specialistId;

    // Validation
    if (!topic || !contentType) {
      return res.status(400).json({
        success: false,
        message: 'Topic and content type are required'
      });
    }

    // Get specialist details
    const specialist = await Specialist.findById(specialistId);
    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    // Generate content using AI
    const generatedContent = await generateMedicalContent({
      topic,
      contentType,
      targetAudience: targetAudience || 'general_public',
      tone: tone || 'professional',
      wordCount: wordCount || 500,
      keywords: keywords || [],
      specialistSpecialization: specialist.specialty // Using 'specialty' from your Specialist model
    });

    // Save to database
    const newContent = new GeneratedContent({
      specialistId,
      title: generatedContent.title,
      content: generatedContent.content,
      contentType,
      topic,
      targetAudience: targetAudience || 'general_public',
      tone: tone || 'professional',
      wordCount: wordCount || 500,
      keywords: keywords || [],
      generatedAt: new Date()
    });

    await newContent.save();

    res.status(201).json({
      success: true,
      message: 'Content generated successfully',
      data: {
        content: newContent,
        aiResponse: {
          summary: generatedContent.summary,
          keyPoints: generatedContent.keyPoints
        }
      }
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
 * Get specialist's content history
 */
export const getContentHistory = async (req, res) => {
  try {
    const specialistId = req.specialistId;
    const { page = 1, limit = 10, contentType, isPublished } = req.query;

    const filter = { specialistId };
    if (contentType) filter.contentType = contentType;
    if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

    const content = await GeneratedContent.find(filter)
      .sort({ generatedAt: -1 })
      .limit(limit * 1)
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
