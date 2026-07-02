const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const Document = require('../models/Document');
const Version = require('../models/Version');
const { protect } = require('../middleware/auth');

const { uploadToCloudinary } = require('../config/cloudinary');
const https = require('https');

const storage = multer.memoryStorage();

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
      return res.status(400).json({ message: 'Title and category are required' });
    }

    // Upload to Cloudinary
    let cloudResult;
    try {
      cloudResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    } catch (uploadErr) {
      return res.status(500).json({ message: 'Failed to upload file to cloud storage' });
    }

    const document = await Document.create({
      title,
      description: description || '',
      filename: cloudResult.public_id, // Store public_id as filename for reference
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      category,
      uploadedBy: req.user._id,
      cloudinaryId: cloudResult.public_id,
      cloudinaryUrl: cloudResult.secure_url,
    });

    // Auto-create v1 Version record so the original file is always tracked
    let v1Hash = null;
    try {
      v1Hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    } catch (e) {
      // Non-critical: hash generation failure shouldn't block upload
    }
    await Version.create({
      documentId: document._id,
      versionNumber: 1,
      filename: cloudResult.public_id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      uploadDate: new Date(),
      expiryDate: null,
      isCurrentVersion: true,
      fileHash: v1Hash,
      cloudinaryId: cloudResult.public_id,
      cloudinaryUrl: cloudResult.secure_url,
      actionLog: [{ action: 'uploaded', performedBy: req.user._id }],
    });

    res.status(201).json(document);
  } catch (error) {
    console.error(error);
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
    
    if (req.query.favoritesOnly !== 'true' && req.user.role !== 'admin') {
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

    if (req.query.favoritesOnly === 'true') {
      query.favoritedBy = req.user._id;
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
// @desc    Preview a document inline in the browser
// @route   GET /api/documents/preview/:id
// @access  Private
router.get('/preview/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (document.cloudinaryUrl) {
      // Stream from Cloudinary with inline Content-Disposition
      https.get(document.cloudinaryUrl, (cloudinaryRes) => {
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        cloudinaryRes.pipe(res);
      }).on('error', (e) => {
        res.status(500).json({ message: 'Error streaming file from cloud storage' });
      });
      return;
    }

    // Local file fallback
    let fullPath = null;
    const uploadDir = path.join(__dirname, '../../uploads');
    if (document.filename) fullPath = path.join(uploadDir, document.filename);
    if (!fullPath || !fs.existsSync(fullPath)) {
      if (document.filePath) fullPath = document.filePath;
    }
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Physical file not found on server' });
    }

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
    fs.createReadStream(fullPath).pipe(res);
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

    if (document.cloudinaryUrl) {
      // Stream from Cloudinary
      https.get(document.cloudinaryUrl, (cloudinaryRes) => {
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
        cloudinaryRes.pipe(res);
      }).on('error', (e) => {
        res.status(500).json({ message: 'Error streaming file from cloud storage' });
      });
      return;
    }

    // Try filename first, fall back to filePath for backward compatibility (local files)
    let fullPath = null;
    const uploadDir = path.join(__dirname, '../../uploads');
    if (document.filename) {
      fullPath = path.join(uploadDir, document.filename);
    }
    if (!fullPath || !fs.existsSync(fullPath)) {
      if (document.filePath) {
        fullPath = document.filePath;
      }
    }

    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Physical file not found on server' });
    }

    res.download(fullPath, document.originalName, { dotfiles: 'allow' }, (err) => {
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

    const { permission } = req.body;
    if (permission && ['view', 'edit'].includes(permission)) {
      document.sharePermission = permission;
    }

    if (!document.shareToken) {
      document.shareToken = crypto.randomBytes(16).toString('hex');
    }
    
    await document.save();

    res.json({ shareToken: document.shareToken, permission: document.sharePermission });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get public info about a shared document
// @route   GET /api/documents/public-info/:shareToken
// @access  Public
router.get('/public-info/:shareToken', async (req, res) => {
  try {
    const document = await Document.findOne({ shareToken: req.params.shareToken, isDeleted: { $ne: true } });

    if (!document) {
      return res.status(404).json({ message: 'Invalid or expired share link' });
    }

    res.json({
      title: document.title,
      description: document.description,
      size: document.size,
      category: document.category,
      originalName: document.originalName,
      sharePermission: document.sharePermission,
      createdAt: document.createdAt
    });
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

    if (document.cloudinaryUrl) {
      // Stream from Cloudinary
      https.get(document.cloudinaryUrl, (cloudinaryRes) => {
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
        cloudinaryRes.pipe(res);
      }).on('error', (e) => {
        res.status(500).json({ message: 'Error streaming file from cloud storage' });
      });
      return;
    }

    // Try filename first, fall back to filePath for backward compatibility
    let fullPath = null;
    const uploadDir = path.join(__dirname, '../../uploads');
    if (document.filename) {
      fullPath = path.join(uploadDir, document.filename);
    }
    if (!fullPath || !fs.existsSync(fullPath)) {
      if (document.filePath) {
        fullPath = document.filePath;
      }
    }

    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Physical file not found on server' });
    }

    res.download(fullPath, document.originalName, { dotfiles: 'allow' }, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Upload a new version to a shared document
// @route   POST /api/documents/public/:shareToken/upload
// @access  Public (with valid edit token)
router.post('/public/:shareToken/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const document = await Document.findOne({ shareToken: req.params.shareToken, isDeleted: { $ne: true } });

    if (!document) {
      return res.status(404).json({ message: 'Invalid share link' });
    }

    if (document.sharePermission !== 'edit') {
      return res.status(403).json({ message: 'This share link does not have edit permissions' });
    }

    // Upload to Cloudinary
    let cloudResult;
    try {
      cloudResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    } catch (uploadErr) {
      return res.status(500).json({ message: 'Failed to upload new version to cloud storage' });
    }

    // Unset current versions
    await Version.updateMany(
      { documentId: document._id },
      { isCurrentVersion: false }
    );

    const versionCount = await Version.countDocuments({ documentId: document._id });

    let vHash = null;
    try {
      vHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    } catch (e) {
      // Non-critical
    }

    // Create new version
    await Version.create({
      documentId: document._id,
      versionNumber: versionCount + 1,
      filename: cloudResult.public_id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: document.uploadedBy, // Attribute to the original owner
      isCurrentVersion: true,
      fileHash: vHash,
      cloudinaryId: cloudResult.public_id,
      cloudinaryUrl: cloudResult.secure_url,
      actionLog: [{ action: 'uploaded', note: 'Uploaded via public share link' }],
    });

    // Update main document pointer
    document.filename = cloudResult.public_id;
    document.originalName = req.file.originalname;
    document.mimeType = req.file.mimetype;
    document.size = req.file.size;
    document.cloudinaryId = cloudResult.public_id;
    document.cloudinaryUrl = cloudResult.secure_url;
    await document.save();

    res.status(200).json({ message: 'New version uploaded successfully' });
  } catch (error) {
    console.error(error);
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

// @desc    Toggle favorite status of a document
// @route   PUT /api/documents/:id/favorite
// @access  Private
router.put('/:id/favorite', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const isFavorite = document.favoritedBy.some(id => id.toString() === req.user._id.toString());
    if (isFavorite) {
      document.favoritedBy = document.favoritedBy.filter(id => id.toString() !== req.user._id.toString());
    } else {
      document.favoritedBy.push(req.user._id);
    }

    await document.save();

    res.json({ message: isFavorite ? 'Removed from Favorites' : 'Added to Favorites', isFavorite: !isFavorite });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get user's favorite documents
// @route   GET /api/documents/favorites
// @access  Private
router.get('/favorites', protect, async (req, res) => {
  try {
    const documents = await Document.find({
      favoritedBy: req.user._id,
      isDeleted: { $ne: true }
    })
      .populate('uploadedBy', 'name email')
      .populate('folder', 'name')
      .sort({ createdAt: -1 });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
