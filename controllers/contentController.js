import GeneratedContent from '../models/GeneratedContent.js';
import HealthPost from '../models/HealthPost.js';
import Specialist from '../models/Specialist.js';
import { generateMedicalContent } from '../utils/specialistContent.js'; 
import mongoose from 'mongoose';

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

    const specialistId = req.specialistId; 

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

    if (!generatedContent || !generatedContent.content || generatedContent.content.trim().length === 0) {
        return res.status(424).json({ 
            success: false, 
            message: 'AI failed to generate content or returned an empty response. Please try again or modify your parameters.', 
            error: 'Empty content returned by AI.'
        });
    }

    res.status(200).json({ 
      success: true,
      message: 'Content generated successfully. Awaiting specialist review.',
      data: generatedContent
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
 * 2. Approve and Save Generated Content (SYNC TO FEED IMMEDIATELY)
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

        if (!title || !content || !contentType || !topic) {
            return res.status(400).json({
                success: false,
                message: 'Title, content, content type, and topic are required for approval.'
            });
        }

        const specialist = await Specialist.findById(specialistId).select('name specialty');
        if (!specialist) {
            return res.status(404).json({
                success: false,
                message: 'Specialist not found'
            });
        }

        console.log('📝 Approving content for specialist:', specialist.name);

        // Save to GeneratedContent collection
        const newContent = new GeneratedContent({
            specialistId,
            title,
            content,
            contentType,
            topic,
            targetAudience: targetAudience || 'general_public',
            tone: tone || 'professional',
            wordCount: wordCount || content.length,
            keywords: keywords || [],
            isPublished: true,
            generatedAt: new Date(),
            // Add feed-specific fields
            authorName: `Dr. ${specialist.name}`,
            authorSpecialty: specialist.specialty,
            excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            readTime: `${Math.ceil(content.length / 1000)} min read`,
            feedTopics: generateFeedTopics(topic, keywords, contentType)
        });

        await newContent.save();
        console.log('✅ Content saved to GeneratedContent with ID:', newContent._id);

        // MIGRATION: Also save to HealthPost for backward compatibility
        try {
            const newHealthPost = new HealthPost({
                title,
                content,
                excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
                author: `Dr. ${specialist.name}`,
                publishDate: new Date(),
                readTime: `${Math.ceil(content.length / 1000)} min read`,
                topics: generateFeedTopics(topic, keywords, contentType),
                isActive: true,
                shareCount: 0,
                saveCount: 0,
                originalContentId: newContent._id,
                specialistId: specialistId,
                specialistSpecialty: specialist.specialty,
                isSpecialistContent: true
            });

            await newHealthPost.save();
            console.log('✅ Also saved to HealthPost for backward compatibility');
        } catch (healthPostError) {
            console.warn('⚠️ Could not save to HealthPost (may not exist):', healthPostError.message);
        }

        res.status(201).json({
            success: true,
            message: 'Content approved and published successfully! Now visible in public feed.',
            data: newContent
        });

    } catch (error) {
        console.error('Content approval and save error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve and publish content',
            error: error.message
        });
    }
};

/**
 * 3. MIGRATE EXISTING CONTENT TO FEED FORMAT
 */
export const migrateExistingContent = async (req, res) => {
    try {
        const specialistId = req.specialistId;
        
        // Get all existing content for this specialist
        const existingContent = await GeneratedContent.find({ 
            specialistId,
            isPublished: true 
        });

        console.log(`📦 Found ${existingContent.length} existing contents to migrate`);

        let migratedCount = 0;
        
        for (const content of existingContent) {
            // Update with feed fields if missing
            if (!content.authorName || !content.excerpt || !content.feedTopics) {
                const specialist = await Specialist.findById(content.specialistId).select('name specialty');
                
                content.authorName = specialist ? `Dr. ${specialist.name}` : 'Healthcare Specialist';
                content.authorSpecialty = specialist?.specialty || '';
                content.excerpt = content.content.substring(0, 200) + (content.content.length > 200 ? '...' : '');
                content.readTime = `${Math.ceil(content.content.length / 1000)} min read`;
                content.feedTopics = generateFeedTopics(content.topic, content.keywords, content.contentType);
                
                await content.save();
                migratedCount++;
                
                console.log(`✅ Migrated: ${content.title}`);
            }
        }

        res.status(200).json({
            success: true,
            message: `Migration completed. ${migratedCount} contents updated for feed display.`,
            data: { migratedCount, totalContent: existingContent.length }
        });

    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to migrate existing content',
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
    const { page = 1, limit = 50, contentType, isPublished } = req.query;

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

    if (title) existingContent.title = title;
    if (content) {
      existingContent.content = content;
      existingContent.excerpt = content.substring(0, 200) + (content.length > 200 ? '...' : '');
      existingContent.readTime = `${Math.ceil(content.length / 1000)} min read`;
    }
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

/**
 * HELPER: Generate topics for feed display
 */
const generateFeedTopics = (topic, keywords, contentType) => {
    const topics = new Set();
    
    topics.add(topic.toLowerCase());
    
    if (keywords && Array.isArray(keywords)) {
        keywords.forEach(keyword => {
            if (keyword && typeof keyword === 'string') {
                topics.add(keyword.toLowerCase());
            }
        });
    }
    
    if (contentType) {
        topics.add(contentType.toLowerCase().replace('_', ' '));
    }
    
    const healthCategories = ['health', 'wellness', 'medical', 'doctor', 'advice', 'education'];
    healthCategories.forEach(category => topics.add(category));
    
    return Array.from(topics).slice(0, 8);
};
