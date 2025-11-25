import Specialist from '../models/Specialist.js';
import cloudinary from '../config/cloudinary.js';

// Upload profile picture to Cloudinary
const uploadToCloudinary = async (base64Image) => {
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'mediguide/specialists',
      width: 500,
      height: 500,
      crop: 'fill'
    });
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image');
  }
};

// Update specialist profile with image handling
export const updateSpecialistProfile = async (req, res) => {
  try {
    const specialistId = req.specialistId;
    const updateData = { ...req.body };

    // Remove sensitive fields
    delete updateData.password;
    delete updateData.email;
    delete updateData.accountStatus;

    // Handle profile picture upload
    if (updateData.profilePicture && updateData.profilePicture.startsWith('data:image')) {
      try {
        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(updateData.profilePicture);
        
        // Update with Cloudinary URLs
        updateData.profilePicture = uploadResult.secure_url;
        updateData.cloudinaryId = uploadResult.public_id;
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: 'Failed to upload profile picture',
          error: uploadError.message
        });
      }
    }

    // Handle languages string conversion
    if (updateData.languages && typeof updateData.languages === 'string') {
      updateData.languages = updateData.languages.split(',').map(lang => lang.trim()).filter(lang => lang);
    }

    const specialist = await Specialist.findByIdAndUpdate(
      specialistId,
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-password -__v');

    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { specialist }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// Delete profile picture
export const deleteProfilePicture = async (req, res) => {
  try {
    const specialistId = req.specialistId;
    
    const specialist = await Specialist.findById(specialistId);
    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    // Delete from Cloudinary if exists
    if (specialist.cloudinaryId) {
      await cloudinary.uploader.destroy(specialist.cloudinaryId);
    }

    // Remove from database
    specialist.profilePicture = undefined;
    specialist.cloudinaryId = undefined;
    await specialist.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully',
      data: { specialist }
    });

  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove profile picture',
      error: error.message
    });
  }
};
