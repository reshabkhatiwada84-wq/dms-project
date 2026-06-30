const mongoose = require('mongoose');

const versionSchema = mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: false, // Not required anymore, for backward compatibility
    },
    cloudinaryId: {
      type: String,
      required: false,
    },
    cloudinaryUrl: {
      type: String,
      required: false,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    isCurrentVersion: {
      type: Boolean,
      default: false,
    },
    // SHA-256 hash for duplicate detection
    fileHash: {
      type: String,
      default: null,
    },
    // Trash / Soft-delete fields
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Action log: track restore/delete events
    actionLog: [
      {
        action: { type: String, enum: ['uploaded', 'restored', 'deleted'] },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        performedAt: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
versionSchema.index({ documentId: 1, versionNumber: 1 });
versionSchema.index({ expiryDate: 1 }); // for cleanup scheduler

module.exports = mongoose.model('Version', versionSchema);
