// routes/fileRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { existsSync, createReadStream } = require('fs');
const crypto = require('crypto');
const { promisify } = require('util');
const rateLimit = require('express-rate-limit');
const File = require('../models/File');
const User = require('../models/User');
const auth = require('../middleware/auth');
const calculateSha256 = require('../utils/calculateSha256');

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/json'
];

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Rate limiting
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 uploads per windowMs
  message: 'Too many file uploads from this IP, please try again after 15 minutes'
});

// File filter
const fileFilter = (req, file, cb) => {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only Excel, CSV, and JSON files are allowed.'), false);
  }
  cb(null, true);
};

// Multer config
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const userDir = req.user
        ? path.join(UPLOAD_DIR, 'users', req.user.id)
        : path.join(UPLOAD_DIR, 'guests', crypto.randomBytes(8).toString('hex'));

      if (!existsSync(userDir)) {
        await fs.mkdir(userDir, { recursive: true });
      }
      cb(null, userDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${random}-${sanitizedFilename}`);
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

// Error handler middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }
  }
  next(error);
};

// Upload (authenticated)
router.post(
  '/upload',
  auth,
  uploadLimiter,
  upload.single('file'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          error: 'No file provided'
        });
      }

      // Calculate file hash
      const sha256 = await calculateSha256(req.file.path);

      // Check for duplicate file
      const existingFile = await File.findOne({
        userId: req.user.id,
        sha256: sha256,
        status: { $ne: 'deleted' }
      });

      if (existingFile) {
        // Remove uploaded file
        await fs.unlink(req.file.path);
        
        return res.status(409).json({
          status: 'error',
          error: 'Duplicate file',
          existingFile: {
            id: existingFile._id,
            name: existingFile.originalName,
            uploadedAt: existingFile.createdAt
          }
        });
      }

      // Create file document
      const fileDoc = await File.create({
        userId: req.user.id,
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        sha256: sha256,
        status: 'pending'
      });

      // Start async processing (you would implement this based on your needs)
      // processFile(fileDoc._id).catch(console.error);

      res.status(201).json({
        status: 'success',
        message: 'File uploaded successfully',
        data: {
          file: {
            id: fileDoc._id,
            name: fileDoc.originalName,
            size: fileDoc.size,
            uploadedAt: fileDoc.createdAt
          }
        }
      });
    } catch (error) {
      // Clean up uploaded file if something goes wrong
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }

      console.error('File upload error:', error);
      res.status(500).json({
        status: 'error',
        error: 'File upload failed',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Guest upload (no auth, but with stricter limits)
router.post(
  '/upload-guest',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: 'Too many uploads from this IP. Please try again after 15 minutes or log in for higher limits.'
  }),
  upload.single('file'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          error: 'No file provided'
        });
      }

      // Calculate file hash
      const sha256 = await calculateSha256(req.file.path);

      // Create file document with guest flag
      const fileDoc = await File.create({
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        sha256: sha256,
        status: 'pending',
        metadata: {
          isGuest: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });

      // Start async processing
      // processFile(fileDoc._id).catch(console.error);

      res.status(201).json({
        status: 'success',
        message: 'File uploaded successfully (guest mode)',
        data: {
          file: {
            id: fileDoc._id,
            name: fileDoc.originalName,
            size: fileDoc.size,
            uploadedAt: fileDoc.createdAt,
            expiresAt: fileDoc.metadata.expiresAt
          }
        },
        note: 'Guest files are automatically deleted after 24 hours. Sign up to keep your files permanently.'
      });
    } catch (error) {
      // Clean up uploaded file if something goes wrong
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }

      console.error('Guest file upload error:', error);
      res.status(500).json({
        status: 'error',
        error: 'File upload failed',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// List files with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    // Build query
    const query = {
      userId: req.user.id,
      status: { $ne: 'deleted' }
    };

    // Add filters if provided
    if (req.query.type) {
      query.mimeType = req.query.type;
    }
    if (req.query.search) {
      query.originalName = new RegExp(req.query.search, 'i');
    }

    // Get total count for pagination
    const totalFiles = await File.countDocuments(query);

    // Execute query with pagination and sorting
    const files = await File.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate('transformations.resultFileId', 'originalName status createdAt');

    // Calculate pagination info
    const totalPages = Math.ceil(totalFiles / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      status: 'success',
      data: {
        files: files.map(file => ({
          id: file._id,
          name: file.originalName,
          size: file.size,
          type: file.mimeType,
          status: file.status,
          uploadedAt: file.createdAt,
          transformations: file.transformations,
          metadata: file.metadata
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalFiles,
          hasNextPage,
          hasPrevPage,
          limit
        }
      }
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve files',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get file details
router.get('/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    }).populate('transformations.resultFileId');

    if (!file) {
      return res.status(404).json({
        status: 'error',
        error: 'File not found'
      });
    }

    // Update last accessed timestamp
    await file.recordAccess();

    res.status(200).json({
      status: 'success',
      data: {
        file: {
          id: file._id,
          name: file.originalName,
          size: file.size,
          type: file.mimeType,
          status: file.status,
          uploadedAt: file.createdAt,
          lastAccessed: file.lastAccessedAt,
          transformations: file.transformations,
          metadata: file.metadata
        }
      }
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to retrieve file details'
    });
  }
});

// Download file
router.get('/:id/download', auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!file) {
      return res.status(404).json({
        status: 'error',
        error: 'File not found'
      });
    }

    if (!existsSync(file.path)) {
      return res.status(404).json({
        status: 'error',
        error: 'File not found on disk'
      });
    }

    // Update last accessed timestamp
    await file.recordAccess();

    // Set appropriate headers
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Length', file.size);

    // Stream the file
    const fileStream = createReadStream(file.path);
    fileStream.pipe(res);

    // Handle errors during streaming
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          status: 'error',
          error: 'Failed to download file'
        });
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to download file'
    });
  }
});

// Delete file (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: { $ne: 'deleted' }
    });

    if (!file) {
      return res.status(404).json({
        status: 'error',
        error: 'File not found'
      });
    }

    // Soft delete - update status and keep the file for potential recovery
    file.status = 'deleted';
    file.updatedAt = Date.now();
    await file.save();

    // Schedule physical deletion after 30 days
    setTimeout(async () => {
      try {
        // Double check file is still marked as deleted
        const deletedFile = await File.findById(file._id);
        if (deletedFile && deletedFile.status === 'deleted') {
          // Delete file from disk
          if (existsSync(deletedFile.path)) {
            await fs.unlink(deletedFile.path);
          }
          // Delete from database
          await File.findByIdAndDelete(deletedFile._id);
        }
      } catch (error) {
        console.error('Physical file deletion error:', error);
      }
    }, 30 * 24 * 60 * 60 * 1000); // 30 days

    res.status(200).json({
      status: 'success',
      message: 'File marked for deletion'
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to delete file'
    });
  }
});

// Restore deleted file
router.post('/:id/restore', auth, async (req, res) => {
  try {
    const file = await File.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: 'deleted'
    });

    if (!file) {
      return res.status(404).json({
        status: 'error',
        error: 'Deleted file not found'
      });
    }

    file.status = 'pending';
    file.updatedAt = Date.now();
    await file.save();

    res.status(200).json({
      status: 'success',
      message: 'File restored successfully',
      data: {
        file: {
          id: file._id,
          name: file.originalName,
          size: file.size,
          type: file.mimeType,
          status: file.status,
          restoredAt: file.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Restore file error:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to restore file'
    });
  }
});

module.exports = router;
