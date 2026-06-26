const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const Document = require('../models/Document');
const Version = require('../models/Version');
const { protect } = require('../middleware/auth');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB size limit
});

// @desc    Upload a document
// @route   POST /api/documents/upload
// @access  Private
router.post('/upload', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, description, category } = req.body;

    if (!title || !category) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: 'Title and category are required' });
    }

    const document = await Document.create({
      title,
      description: description || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      category,
      uploadedBy: req.user._id,
      filePath: req.file.path,
    });

    // Auto-create v1 Version record so the original file is always tracked
    let v1Hash = null;
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      v1Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (e) {
      // Non-critical: hash generation failure shouldn't block upload
    }
    await Version.create({
      documentId: document._id,
      versionNumber: 1,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      uploadDate: new Date(),
      expiryDate: null,
      isCurrentVersion: true,
      fileHash: v1Hash,
      actionLog: [{ action: 'uploaded', performedBy: req.user._id }],
    });

    res.status(201).json(document);
  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get dashboard stats for current user
// @route   GET /api/documents/stats
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    let query = { isDeleted: { $ne: true } };
    if (req.user.role !== 'admin') {
      query.uploadedBy = req.user._id;
    }

    const allDocs = await Document.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    // Basic counts
    const totalDocuments = allDocs.length;
    let totalStorage = 0;
    const categoryBreakdown = { Invoice: 0, Contract: 0, Resume: 0, Report: 0, Other: 0 };

    allDocs.forEach(doc => {
      totalStorage += doc.size || 0;
      if (categoryBreakdown.hasOwnProperty(doc.category)) {
        categoryBreakdown[doc.category]++;
      }
    });

    // Recent uploads (last 5)
    const recentUploads = allDocs.slice(0, 5);

    // Upload activity last 7 days
    const activity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      const count = allDocs.filter(doc => {
        const created = new Date(doc.createdAt);
        return created >= dayStart && created <= dayEnd;
      }).length;
      activity.push({
        date: dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        uploads: count,
      });
    }

    // Version stats
    const docIds = allDocs.map(d => d._id);
    const totalVersions = await Version.countDocuments({ documentId: { $in: docIds } });
    const multiVersionAgg = await Version.aggregate([
      { $match: { documentId: { $in: docIds } } },
      { $group: { _id: '$documentId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'total' },
    ]);
    const docsWithMultipleVersions = multiVersionAgg[0]?.total || 0;

    // Latest version uploaded (for the dashboard card)
    const latestVersion = await Version.findOne({ documentId: { $in: docIds } })
      .sort({ uploadDate: -1 })
      .populate('documentId', 'title')
      .select('versionNumber originalName uploadDate documentId');

    const latestVersionInfo = latestVersion
      ? {
          documentTitle: latestVersion.documentId?.title || 'Unknown',
          versionNumber: latestVersion.versionNumber,
          originalName: latestVersion.originalName,
          uploadDate: latestVersion.uploadDate,
        }
      : null;

    res.json({
      totalDocuments,
      totalStorage,
      categoryBreakdown,
      recentUploads,
      activity,
      versionStats: { totalVersions, docsWithMultipleVersions, latestVersion: latestVersionInfo },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all documents for a user (or all if admin)
// @route   GET /api/documents
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { search, category } = req.query;
    
    let query = { isDeleted: { $ne: true } };
    
    if (req.user.role !== 'admin') {
      query.uploadedBy = req.user._id;
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // folder filter: 'none' = unorganized, a folder id = that folder
    if (req.query.folder === 'none') {
      query.folder = null;
    } else if (req.query.folder) {
      query.folder = req.query.folder;
    }

    const documents = await Document.find(query)
      .populate('uploadedBy', 'name email')
      .populate('folder', 'name')
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Download a document
// @route   GET /api/documents/download/:id
// @access  Private
router.get('/download/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to download this document' });
    }

    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({ message: 'Physical file not found on server' });
    }

    res.download(document.filePath, document.originalName, { dotfiles: 'allow' }, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Soft-delete a document (move to trash)
// @route   DELETE /api/documents/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this document' });
    }

    // Soft-delete the document
    document.isDeleted = true;
    document.deletedAt = new Date();
    document.deletedBy = req.user._id;
    await document.save();

    // Soft-delete all associated versions
    await Version.updateMany(
      { documentId: document._id },
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.user._id }
    );

    res.json({ message: 'Document moved to trash successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Generate a shareable link
// @route   POST /api/documents/:id/share
// @access  Private
router.post('/:id/share', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to share this document' });
    }

    if (!document.shareToken) {
      document.shareToken = crypto.randomBytes(16).toString('hex');
      await document.save();
    }

    const shareLink = `http://127.0.0.1:5000/api/documents/public/${document.shareToken}`;
    res.json({ shareLink, shareToken: document.shareToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Download a shared document
// @route   GET /api/documents/public/:shareToken
// @access  Public
router.get('/public/:shareToken', async (req, res) => {
  try {
    const document = await Document.findOne({ shareToken: req.params.shareToken });

    if (!document) {
      return res.status(404).json({ message: 'Invalid or expired share link' });
    }

    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({ message: 'Physical file not found on server' });
    }

    res.download(document.filePath, document.originalName, { dotfiles: 'allow' }, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Assign (or unassign) a document to a folder
// @route   PUT /api/documents/:id/folder
// @access  Private
router.put('/:id/folder', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to move this document' });
    }

    // folderId = null to unassign
    document.folder = req.body.folderId || null;
    await document.save();

    const updated = await Document.findById(document._id)
      .populate('uploadedBy', 'name email')
      .populate('folder', 'name');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
