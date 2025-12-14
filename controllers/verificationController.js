import Specialist from '../models/Specialist.js';
import cloudinary from '../config/cloudinary.js';

// Upload document to Cloudinary (using base64 like your profile picture upload)
const uploadDocumentToCloudinary = async (base64File, specialistId, documentType) => {
  try {
    const result = await cloudinary.uploader.upload(base64File, {
      folder: `mediguide/verification/${specialistId}`,
      resource_type: 'auto', // Handles both images and PDFs
      public_id: `${documentType}_${Date.now()}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf']
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
    const { idProof, license, experience } = req.body; // These are base64 strings
    
    // Validate required documents
    if (!idProof || !license || !experience) {
      return res.status(400).json({
        success: false,
        message: 'All three documents are required: ID Proof, License, and Experience Certificate'
      });
    }

    // Check if specialist exists
    const specialist = await Specialist.findById(specialistId);
    if (!specialist) {
      return res.status(404).json({
        success: false,
        message: 'Specialist not found'
      });
    }

    // Check verification status
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
    
    try {
      // Upload ID Proof
      const idResult = await uploadDocumentToCloudinary(idProof, specialistId, 'id_proof');
      verificationDocuments.push({
        documentType: 'id_proof',
        documentUrl: idResult.secure_url,
        uploadedAt: new Date()
      });

      // Upload License
      const licenseResult = await uploadDocumentToCloudinary(license, specialistId, 'license');
      verificationDocuments.push({
        documentType: 'license',
        documentUrl: licenseResult.secure_url,
        uploadedAt: new Date()
      });

      // Upload Experience
      const experienceResult = await uploadDocumentToCloudinary(experience, specialistId, 'experience');
      verificationDocuments.push({
        documentType: 'experience',
        documentUrl: experienceResult.secure_url,
        uploadedAt: new Date()
      });
    } catch (uploadError) {
      return res.status(400).json({
        success: false,
        message: 'Failed to upload documents',
        error: uploadError.message
      });
    }

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
      .select('verificationStatus verificationDocuments verificationDate verificationNotes');

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
        verificationDate: specialist.verificationDate,
        verificationNotes: specialist.verificationNotes
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
    const { status, notes, verificationLevel = 'basic' } = req.body;

    if (!['verified', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "verified", "pending", or "rejected"'
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
    
    if (status === 'verified') {
      specialist.verificationDate = new Date();
      specialist.verificationLevel = verificationLevel;
    }
    
    await specialist.save();

    res.status(200).json({
      success: true,
      message: `Verification status updated to ${status}`,
      data: { 
        specialist: {
          _id: specialist._id,
          name: specialist.name,
          email: specialist.email,
          verificationStatus: specialist.verificationStatus,
          verificationLevel: specialist.verificationLevel,
          verificationDate: specialist.verificationDate,
          verificationNotes: specialist.verificationNotes
        }
      }
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
