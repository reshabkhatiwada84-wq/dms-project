const express = require('express');
const router = express.Router();
const fs = require('fs');
const Document = require('../models/Document');
const Version = require('../models/Version');
const { protect, admin } = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');
const path = require('path');

const uploadDir = path.join(__dirname, '../../uploads');

// ─── All trash routes require authentication ────────────────────────────────
router.use(protect);

// ─── GET /api/trash/documents — list deleted documents ──────────────────────
router.get('/documents', async (req, res) => {
  try {
    let query = { isDeleted: true };
    if (req.user.role !== 'admin') {
      query.uploadedBy = req.user._id;
    }

    const docs = await Document.find(query)
      .populate('uploadedBy', 'name email')
      .populate('deletedBy', 'name email')
      .sort({ deletedAt: -1 });

    // Attach version count for each deleted document
    const result = await Promise.all(
      docs.map(async (doc) => {
        const versionCount = await Version.countDocuments({ documentId: doc._id });
        return {
          ...doc.toObject(),
          versionCount,
        };
      })
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET /api/trash/versions — list deleted versions ────────────────────────
router.get('/versions', async (req, res) => {
  try {
    let query = { isDeleted: true };

    // Non-admin users can only see deleted versions from their own documents
    if (req.user.role !== 'admin') {
      const userDocs = await Document.find({ uploadedBy: req.user._id }).select('_id');
      query.documentId = { $in: userDocs.map((d) => d._id) };
    }

    const versions = await Version.find(query)
      .populate('documentId', 'title originalName')
      .populate('uploadedBy', 'name email')
      .populate('deletedBy', 'name email')
      .sort({ deletedAt: -1 });

    res.json(versions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/trash/documents/:id/restore — restore a deleted document ─────
router.post('/documents/:id/restore', async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, isDeleted: true });
    if (!doc) return res.status(404).json({ message: 'Deleted document not found' });

    if (req.user.role !== 'admin' && doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to restore this document' });
    }

    // Restore the document
    doc.isDeleted = false;
    doc.deletedAt = null;
    doc.deletedBy = null;
    await doc.save();

    // Restore all associated versions
    await Version.updateMany(
      { documentId: doc._id },
      { isDeleted: false, deletedAt: null, deletedBy: null }
    );

    res.json({ message: `Document "${doc.title}" restored successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST /api/trash/versions/:id/restore — restore a deleted version ───────
router.post('/versions/:id/restore', async (req, res) => {
  try {
    const version = await Version.findOne({ _id: req.params.id, isDeleted: true }).populate('documentId', 'title uploadedBy');
    if (!version) return res.status(404).json({ message: 'Deleted version not found' });

    // Check if parent document exists and is not deleted
    const parentDoc = await Document.findById(version.documentId._id || version.documentId);
    if (!parentDoc || parentDoc.isDeleted) {
      return res.status(400).json({
        message: 'Cannot restore this version because its document is deleted. Restore the document first.',
      });
    }

    if (req.user.role !== 'admin' && parentDoc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to restore this version' });
    }

    // Restore the version
    version.isDeleted = false;
    version.deletedAt = null;
    version.deletedBy = null;
    version.actionLog.push({ action: 'restored', performedBy: req.user._id, note: 'Restored from trash' });
    await version.save();

    const docTitle = version.documentId?.title || 'Unknown';
    res.json({ message: `Version v${version.versionNumber} of "${docTitle}" restored successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── DELETE /api/trash/documents/:id — permanently delete a document ────────
router.delete('/documents/:id', async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, isDeleted: true });
    if (!doc) return res.status(404).json({ message: 'Deleted document not found' });

    if (req.user.role !== 'admin' && doc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to permanently delete this document' });
    }

    // Permanently delete all associated version files and records
    const versions = await Version.find({ documentId: doc._id });
    for (const version of versions) {
      if (version.cloudinaryId) {
        await cloudinary.uploader.destroy(version.cloudinaryId, { resource_type: 'raw' });
      } else {
        const fullPath = version.filename ? path.join(uploadDir, version.filename) : version.filePath;
        if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      await Version.findByIdAndDelete(version._id);
    }

    // Delete the document physical file
    if (doc.cloudinaryId) {
      // Often the main document's file is just a reference to a version's file,
      // but if it has its own independent Cloudinary ID, destroy it.
      await cloudinary.uploader.destroy(doc.cloudinaryId, { resource_type: 'raw' });
    } else {
      const fullPath = doc.filename ? path.join(uploadDir, doc.filename) : doc.filePath;
      if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    // Delete the document record
    await Document.findByIdAndDelete(doc._id);

    res.json({ message: `Document "${doc.title}" and all versions permanently deleted` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── DELETE /api/trash/versions/:id — permanently delete a version ──────────
router.delete('/versions/:id', async (req, res) => {
  try {
    const version = await Version.findOne({ _id: req.params.id, isDeleted: true }).populate('documentId', 'title uploadedBy');
    if (!version) return res.status(404).json({ message: 'Deleted version not found' });

    const parentDoc = await Document.findById(version.documentId._id || version.documentId);
    if (req.user.role !== 'admin' && parentDoc && parentDoc.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to permanently delete this version' });
    }

    // Delete the physical file
    if (version.cloudinaryId) {
      await cloudinary.uploader.destroy(version.cloudinaryId, { resource_type: 'raw' });
    } else {
      const fullPath = version.filename ? path.join(uploadDir, version.filename) : version.filePath;
      if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    // Delete the version record
    await Version.findByIdAndDelete(version._id);

    const docTitle = version.documentId?.title || 'Unknown';
    res.json({ message: `Version v${version.versionNumber} of "${docTitle}" permanently deleted` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

