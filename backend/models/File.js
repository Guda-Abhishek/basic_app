// models/File.js
const mongoose = require('mongoose');
const path = require('path');

const ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/json'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const fileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true,
    maxlength: [255, 'Filename is too long']
  },
  filename: {
    type: String,
    required: [true, 'Generated filename is required'],
    unique: true
  },
  mimeType: {
    type: String,
    required: [true, 'File MIME type is required'],
    validate: {
      validator: function(v) {
        return ALLOWED_MIME_TYPES.includes(v);
      },
      message: 'Unsupported file type'
    }
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    validate: {
      validator: function(v) {
        return v > 0 && v <= MAX_FILE_SIZE;
      },
      message: `File size must be between 1 byte and ${MAX_FILE_SIZE} bytes`
    }
  },
  path: {
    type: String,
    required: [true, 'File path is required'],
    validate: {
      validator: function(v) {
        return path.isAbsolute(v);
      },
      message: 'Invalid file path'
    }
  },
  sha256: {
    type: String,
    required: [true, 'File hash is required'],
    match: [/^[a-f0-9]{64}$/, 'Invalid SHA-256 hash'],
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'error', 'deleted'],
    default: 'pending',
    index: true
  },
  processingError: {
    type: String,
    select: false
  },
  metadata: {
    rowCount: Number,
    columnCount: Number,
    headers: [String],
    dataTypes: Map,
    summary: Map
  },
  transformations: [{
    type: {
      type: String,
      enum: ['filter', 'sort', 'aggregate', 'pivot', 'chart'],
      required: true
    },
    parameters: Map,
    appliedAt: { type: Date, default: Date.now },
    resultFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File'
    }
  }],
  originalFileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
fileSchema.virtual('isProcessed').get(function() {
  return this.status === 'processed';
});

fileSchema.virtual('isTransformed').get(function() {
  return this.transformations && this.transformations.length > 0;
});

fileSchema.virtual('derivedFiles', {
  ref: 'File',
  localField: '_id',
  foreignField: 'originalFileId'
});

// Indexes
fileSchema.index({ userId: 1, createdAt: -1 });
fileSchema.index({ sha256: 1 }, { unique: true, sparse: true });
fileSchema.index({ status: 1, createdAt: -1 });

// Middleware
fileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

fileSchema.pre(/^find/, function(next) {
  this.find({ status: { $ne: 'deleted' } });
  next();
});

// Update lastAccessedAt on file access
fileSchema.methods.recordAccess = async function() {
  this.lastAccessedAt = Date.now();
  await this.save();
};

// Method to mark file as processed
fileSchema.methods.markAsProcessed = async function(metadata) {
  this.status = 'processed';
  this.metadata = metadata;
  this.updatedAt = Date.now();
  await this.save();
};

// Method to mark file as error
fileSchema.methods.markAsError = async function(error) {
  this.status = 'error';
  this.processingError = error;
  this.updatedAt = Date.now();
  await this.save();
};

// Error handling
fileSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    next(new Error('A file with the same hash already exists'));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('File', fileSchema);
