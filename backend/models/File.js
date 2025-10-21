// models/File.js
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { collection: 'files' }
);

// Update the updatedAt field before saving
fileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('File', fileSchema);
