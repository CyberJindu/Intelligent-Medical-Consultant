
import express from 'express';
import multer from 'multer';
import { 
  submitVerification, 
  getVerificationStatus,
  updateVerificationStatus 
} from '../controllers/verificationController.js';
import { specialistAuthMiddleware } from '../middleware/specialistAuth.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/verification/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 3 // Max 3 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, PNG allowed.'));
    }
  }
});

// Specialist routes (requires authentication)
router.use(specialistAuthMiddleware);

// Submit verification documents
router.post('/submit', 
  upload.fields([
    { name: 'idProof', maxCount: 1 },
    { name: 'license', maxCount: 1 },
    { name: 'experience', maxCount: 1 }
  ]), 
  submitVerification
);

// Get verification status
router.get('/status', getVerificationStatus);

// Admin routes (requires admin authentication)
router.use(adminAuthMiddleware);

// Update verification status (admin only)
router.put('/:specialistId/status', updateVerificationStatus);

export default router;
