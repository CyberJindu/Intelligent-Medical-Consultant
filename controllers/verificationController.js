import Specialist from '../models/Specialist.js';
import cloudinary from '../config/cloudinary.js';

// Upload document to Cloudinary
const uploadDocumentToCloudinary = async (file, specialistId, documentType) => {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: `mediguide/verification/${specialistId}`,
      resource_type: 'auto',
      public_id: `${documentType}_${Date.now()}`
    });
    return result;
  } catch (error) {
    console.error('Cloudinary document upload error:', error);
    throw new Error(`Failed to upload ${documentType}`);
  }
};

// Submit verification documents
export const submitVerification = async (req, res) => {
  try {
    const specialistId = req.specialistId;
    const files = req.files;
    
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No documents uploaded'
      });
    }

    // Check if already verified or pending
    const specialist = await Specialist.findById(specialistId);
    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    if (specialist.verificationStatus === 'verified') {
      return res.status(400).json({
        success: false,
        message: 'You are already verified'
      });
    }

    if (specialist.verificationStatus === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Verification request already pending'
      });
    }

    const verificationDocuments = [];
    const uploadPromises = [];

    // Process ID Proof
    if (files.idProof) {
      uploadPromises.push(
        uploadDocumentToCloudinary(files.idProof[0].path, specialistId, 'id_proof')
          .then(result => {
            verificationDocuments.push({
              documentType: 'id_proof',
              documentUrl: result.secure_url,
              uploadedAt: new Date()
            });
          })
      );
    }

    // Process License
    if (files.license) {
      uploadPromises.push(
        uploadDocumentToCloudinary(files.license[0].path, specialistId, 'license')
          .then(result => {
            verificationDocuments.push({
              documentType: 'license',
              documentUrl: result.secure_url,
              uploadedAt: new Date()
            });
          })
      );
    }

    // Process Experience
    if (files.experience) {
      uploadPromises.push(
        uploadDocumentToCloudinary(files.experience[0].path, specialistId, 'experience')
          .then(result => {
            verificationDocuments.push({
              documentType: 'experience',
              documentUrl: result.secure_url,
              uploadedAt: new Date()
            });
          })
      );
    }

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    // Update specialist with verification data
    specialist.verificationStatus = 'pending';
    specialist.verificationDocuments = verificationDocuments;
    specialist.verificationDate = new Date();
    
    await specialist.save();

    res.status(200).json({
      success: true,
      message: 'Verification submitted successfully',
      data: {
        verificationStatus: specialist.verificationStatus,
        verificationDocuments: specialist.verificationDocuments
      }
    });

  } catch (error) {
    console.error('Verification submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit verification',
      error: error.message
    });
  }
};

// Get verification status
export const getVerificationStatus = async (req, res) => {
  try {
    const specialistId = req.specialistId;
    
    const specialist = await Specialist.findById(specialistId)
      .select('verificationStatus verificationDocuments verificationDate');

    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        verificationStatus: specialist.verificationStatus,
        verificationDocuments: specialist.verificationDocuments,
        verificationDate: specialist.verificationDate
      }
    });

  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get verification status',
      error: error.message
    });
  }
};

// Admin: Update verification status
export const updateVerificationStatus = async (req, res) => {
  try {
    const { specialistId } = req.params;
    const { status, notes } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "verified" or "rejected"'
      });
    }

    const specialist = await Specialist.findById(specialistId);
    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    specialist.verificationStatus = status;
    if (notes) specialist.verificationNotes = notes;
    if (status === 'verified') specialist.verificationDate = new Date();
    
    await specialist.save();

    res.status(200).json({
      success: true,
      message: `Verification status updated to ${status}`,
      data: { specialist }
    });

  } catch (error) {
    console.error('Update verification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update verification status',
      error: error.message
    });
  }
};
