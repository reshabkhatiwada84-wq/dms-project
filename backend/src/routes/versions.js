const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const Version = require('../models/Version');
const Document = require('../models/Document');
const { protect, admin } = require('../middleware/auth');

const { uploadToCloudinary } = require('../config/cloudinary');
const https = require('https');

const EXPIRY_DAYS = 7;

const storage = multer.memoryStorage();

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ─── Helper ──────────────────────────────────────────────────────────────────
const calcExpiry = () => {
  const d = new Date();
  d.setDate(d.getDate() + EXPIRY_DAYS);
  return d;
};

// ─── GET /api/versions/:documentId  — list all versions ──────────────────────
router.get('/:documentId', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.documentId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Non-admins can only view their own document versions
    if (req.user.role !== 'admin' && doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view versions of this document' });
    }

    const versions = await Version.find({ documentId: req.params.documentId, isDeleted: { $ne: true } })
      .populate('uploadedBy', 'name email')
      .populate('actionLog.performedBy', 'name email')
      .sort({ versionNumber: -1 });

    res.json(versions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/versions/:documentId  — upload a new version ──────────────────
router.post('/:documentId', protect, upload.single('file'), async (req, res) => {
  try {
    const doc = await Document.findById(req.params.documentId);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (req.user.role !== 'admin' && doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to upload a version of this document' });
    }

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // ── SHA-256 hash generation for duplicate detection ───────────────────
    let fileHash;
    try {
      fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    } catch (hashErr) {
      return res.status(500).json({ message: 'Failed to generate file hash. Upload cancelled.' });
    }

    // Compare with the latest version's hash to detect duplicates
    const currentVersion = await Version.findOne({ documentId: doc._id, isCurrentVersion: true });
    if (currentVersion && currentVersion.fileHash && currentVersion.fileHash === fileHash) {
      // Identical file — reject
      return res.status(409).json({
        message: 'No changes detected. This file is identical to the latest version.',
      });
    }

    // Upload to Cloudinary
    let cloudResult;
    try {
      cloudResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    } catch (uploadErr) {
      return res.status(500).json({ message: 'Failed to upload version to cloud storage' });
    }

    // Get existing non-deleted versions sorted ascending
    const existingVersions = await Version.find({ documentId: doc._id, isDeleted: { $ne: true } }).sort({ versionNumber: 1 });

    // Determine next version number
    const nextVersionNumber = existingVersions.length > 0
      ? existingVersions[existingVersions.length - 1].versionNumber + 1
      : 1;

    // Mark all previous non-deleted versions as archived: not current, with 7-day expiry
    await Version.updateMany(
      { documentId: doc._id, isDeleted: { $ne: true } },
      { isCurrentVersion: false, expiryDate: calcExpiry() }
    );

    // Create new version (current version never expires)
    const newVersion = await Version.create({
      documentId: doc._id,
      versionNumber: nextVersionNumber,
      filename: cloudResult.public_id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      uploadDate: new Date(),
      expiryDate: null,
      isCurrentVersion: true,
      fileHash,
      cloudinaryId: cloudResult.public_id,
      cloudinaryUrl: cloudResult.secure_url,
      actionLog: [{ action: 'uploaded', performedBy: req.user._id }],
    });

    // Update the main Document record to reflect the latest version file
    doc.filename = cloudResult.public_id;
    doc.originalName = req.file.originalname;
    doc.mimeType = req.file.mimetype;
    doc.size = req.file.size;
    doc.cloudinaryId = cloudResult.public_id;
    doc.cloudinaryUrl = cloudResult.secure_url;
    await doc.save();

    const populated = await Version.findById(newVersion._id).populate('uploadedBy', 'name email');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET /api/versions/:documentId/download/:versionId ───────────────────────
router.get('/:documentId/download/:versionId', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.documentId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (req.user.role !== 'admin' && doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to download this version' });
    }

    const version = await Version.findOne({ _id: req.params.versionId, documentId: req.params.documentId });
    if (!version) return res.status(404).json({ message: 'Version not found' });

    if (version.cloudinaryUrl) {
      // Stream from Cloudinary
      https.get(version.cloudinaryUrl, (cloudinaryRes) => {
        res.setHeader('Content-Type', version.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${version.originalName}"`);
        cloudinaryRes.pipe(res);
      }).on('error', (e) => {
        res.status(500).json({ message: 'Error streaming file from cloud storage' });
      });
      return;
    }

    // Try filename first, fall back to filePath for backward compatibility
    let fullPath = null;
    const uploadDir = path.join(__dirname, '../../uploads');
    if (version.filename) {
      fullPath = path.join(uploadDir, version.filename);
    }
    if (!fullPath || !fs.existsSync(fullPath)) {
      if (version.filePath) {
        fullPath = version.filePath;
      }
    }

    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Physical file not found on server' });
    }

    res.download(fullPath, version.originalName, { dotfiles: 'allow' }, (err) => {
      if (err && !res.headersSent) res.status(500).json({ message: 'Error downloading file' });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/versions/:documentId/restore/:versionId ───────────────────────
router.post('/:documentId/restore/:versionId', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.documentId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (req.user.role !== 'admin' && doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to restore versions of this document' });
    }

    const targetVersion = await Version.findOne({ _id: req.params.versionId, documentId: req.params.documentId });
    if (!targetVersion) return res.status(404).json({ message: 'Version not found' });

    // Try filename first, fall back to filePath for backward compatibility
    let fullPath = null;
    if (targetVersion.filename) {
      fullPath = path.join(uploadDir, targetVersion.filename);
    }
    if (!fullPath || !fs.existsSync(fullPath)) {
      if (targetVersion.filePath) {
        fullPath = targetVersion.filePath;
      }
    }

    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Physical file for this version is no longer available' });
    }

    // Unset current on all non-deleted
    await Version.updateMany({ documentId: doc._id, isDeleted: { $ne: true } }, { isCurrentVersion: false });

    // Set target as current (never expires) and refresh
    targetVersion.isCurrentVersion = true;
    targetVersion.expiryDate = null;
    targetVersion.actionLog.push({ action: 'restored', performedBy: req.user._id });
    await targetVersion.save();

    // Archive any other non-deleted version that was previously current
    await Version.updateMany(
      { documentId: doc._id, _id: { $ne: targetVersion._id }, isDeleted: { $ne: true } },
      { isCurrentVersion: false, expiryDate: calcExpiry() }
    );

    // Update the Document record to point to restored version's file
    doc.filename = targetVersion.filename;
    doc.originalName = targetVersion.originalName;
    doc.mimeType = targetVersion.mimeType;
    doc.size = targetVersion.fileSize;
    if (targetVersion.cloudinaryId) {
      doc.cloudinaryId = targetVersion.cloudinaryId;
      doc.cloudinaryUrl = targetVersion.cloudinaryUrl;
    }
    await doc.save();

    const populated = await Version.findById(targetVersion._id).populate('uploadedBy', 'name email');
    res.json({ message: `Restored to v${targetVersion.versionNumber} successfully`, version: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── DELETE /api/versions/:documentId/:versionId ─────────────────────────────
router.delete('/:documentId/:versionId', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.documentId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (req.user.role !== 'admin' && doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this version' });
    }

    const version = await Version.findOne({ _id: req.params.versionId, documentId: req.params.documentId });
    if (!version) return res.status(404).json({ message: 'Version not found' });

    // Soft-delete the version
    version.isDeleted = true;
    version.deletedAt = new Date();
    version.deletedBy = req.user._id;
    version.actionLog.push({ action: 'deleted', performedBy: req.user._id, note: 'Moved to trash' });
    await version.save();

    // If the deleted version was the current one, promote the latest remaining non-deleted version
    if (version.isCurrentVersion) {
      const nextCurrent = await Version.findOne({
        documentId: doc._id,
        _id: { $ne: version._id },
        isDeleted: { $ne: true },
      }).sort({ versionNumber: -1 });

      if (nextCurrent) {
        nextCurrent.isCurrentVersion = true;
        await nextCurrent.save();

        doc.filename = nextCurrent.filename;
        doc.originalName = nextCurrent.originalName;
        doc.mimeType = nextCurrent.mimeType;
        doc.size = nextCurrent.fileSize;
        if (nextCurrent.cloudinaryId) {
          doc.cloudinaryId = nextCurrent.cloudinaryId;
          doc.cloudinaryUrl = nextCurrent.cloudinaryUrl;
        }
        await doc.save();
      }
    }

    res.json({
      message: `Version v${version.versionNumber} moved to trash successfully`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET /api/versions/stats/summary — version stats for dashboard ────────────
router.get('/stats/summary', protect, async (req, res) => {
  try {
    const matchQuery = req.user.role === 'admin' ? {} : {};

    // Total versions
    let docQuery = req.user.role === 'admin' ? {} : { uploadedBy: req.user._id };
    const userDocs = await Document.find(docQuery).select('_id');
    const docIds = userDocs.map(d => d._id);

    const totalVersions = await Version.countDocuments({ documentId: { $in: docIds }, isDeleted: { $ne: true } });

    // Documents with multiple versions
    const multiVersionAgg = await Version.aggregate([
      { $match: { documentId: { $in: docIds }, isDeleted: { $ne: true } } },
      { $group: { _id: '$documentId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'total' },
    ]);
    const docsWithMultipleVersions = multiVersionAgg[0]?.total || 0;

    // Recent version activity (last 5 uploads/restores)
    const recentVersions = await Version.find({ documentId: { $in: docIds }, isDeleted: { $ne: true } })
      .populate('documentId', 'title')
      .populate('uploadedBy', 'name')
      .sort({ uploadDate: -1 })
      .limit(5);

    res.json({ totalVersions, docsWithMultipleVersions, recentVersions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
