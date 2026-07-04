const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const Document = require('../models/Document');
const Version = require('../models/Version');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');

const { uploadToCloudinary } = require('../config/cloudinary');
const https = require('https');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration - save to disk first
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
  }
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
    console.log('[Upload] Starting file upload');
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    console.log('[Upload] File received:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    const { title, description, category } = req.body;

    if (!title || !category) {
      return res.status(400).json({ message: 'Title and category are required' });
    }

    let cloudResult = null;
    // Try to upload to Cloudinary first
    try {
      console.log('[Upload] Trying Cloudinary upload...');
      const fileBuffer = fs.readFileSync(req.file.path);
      cloudResult = await uploadToCloudinary(fileBuffer, req.file.originalname);
      console.log('[Upload] Cloudinary upload succeeded:', cloudResult.public_id, cloudResult.secure_url);
    } catch (uploadErr) {
      console.warn('[Upload] Cloudinary upload failed, using local storage:', uploadErr.message);
      // Cloudinary failed, we'll use local storage
    }

    // Prepare document data
    // Always save local filename to filePath for backup
    const docData = {
      title,
      description: description || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      category,
      uploadedBy: req.user._id,
      filePath: req.file.filename, // Always store local filename
    };

    // If Cloudinary upload succeeded, add cloudinary fields
    if (cloudResult) {
      docData.cloudinaryId = cloudResult.public_id;
      docData.cloudinaryUrl = cloudResult.secure_url;
      docData.filename = cloudResult.public_id;
    }

    console.log('[Upload] Creating document with data:', docData);
    const document = await Document.create(docData);

    // Auto-create v1 Version record so the original file is always tracked
    let v1Hash = null;
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      v1Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (e) {
      // Non-critical: hash generation failure shouldn't block upload
    }

    // Prepare version data
    const versionData = {
      documentId: document._id,
      versionNumber: 1,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      uploadDate: new Date(),
      expiryDate: null,
      isCurrentVersion: true,
      fileHash: v1Hash,
      filePath: req.file.filename, // Always store local filename for backup
      actionLog: [{ action: 'uploaded', performedBy: req.user._id }],
    };

    if (cloudResult) {
      versionData.cloudinaryId = cloudResult.public_id;
      versionData.cloudinaryUrl = cloudResult.secure_url;
      versionData.filename = cloudResult.public_id;
    }

    await Version.create(versionData);

    console.log('[Upload] Document uploaded successfully!');

    // Log upload activity
    await Activity.create({
      user: req.user._id,
      action: 'upload',
      document: document._id,
      details: `Uploaded document: ${document.title}`,
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('[Upload] Error:', error);
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
    console.log('[Preview] Request for document ID:', req.params.id);
    const document = await Document.findById(req.params.id);

    if (!document) {
      console.log('[Preview] Document not found');
      return res.status(404).json({ message: 'Document not found' });
    }

    console.log('[Preview] Document found:', { 
      _id: document._id, 
      cloudinaryUrl: document.cloudinaryUrl, 
      filename: document.filename,
      mimeType: document.mimeType 
    });

    if (document.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Try Cloudinary first
    if (document.cloudinaryUrl) {
      console.log('[Preview] Streaming from Cloudinary:', document.cloudinaryUrl);
      // Stream from Cloudinary with inline Content-Disposition
      https.get(document.cloudinaryUrl, (cloudinaryRes) => {
        console.log('[Preview] Cloudinary response status:', cloudinaryRes.statusCode);
        // If Cloudinary response is not okay, fall back to local file
        if (cloudinaryRes.statusCode >= 400) {
          console.warn('[Preview] Cloudinary returned error status, falling back to local file');
          streamLocalFile();
          return;
        }
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        cloudinaryRes.pipe(res);
      }).on('error', (e) => {
        console.error('[Preview] Cloudinary error, falling back to local file:', e);
        streamLocalFile();
      });
      return;
    }

    // Local file fallback
    streamLocalFile();

    function streamLocalFile() {
      console.log('[Preview] Using local file fallback');
      let fullPath = null;
      const uploadDir = path.join(__dirname, '../../uploads');
      
      // First try filePath (which should always have local filename)
      if (document.filePath) {
        fullPath = path.join(uploadDir, document.filePath);
      }
      
      // If not found, try filename
      if (!fullPath || !fs.existsSync(fullPath)) {
        if (document.filename) fullPath = path.join(uploadDir, document.filename);
      }
      
      console.log('[Preview] Full path:', fullPath);
      console.log('[Preview] File exists:', fullPath ? fs.existsSync(fullPath) : false);
      
      if (!fullPath || !fs.existsSync(fullPath)) {
        // If headers not sent yet, send error
        if (!res.headersSent) {
          return res.status(404).json({ message: 'Physical file not found on server' });
        }
        return;
      }

      if (!res.headersSent) {
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
      }
      fs.createReadStream(fullPath).pipe(res);
    }
  } catch (error) {
    console.error('[Preview] Error:', error);
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

    // Log download activity
    await Activity.create({
      user: req.user._id,
      action: 'download',
      document: document._id,
      details: `Downloaded document: ${document.title}`,
    });

    // Try Cloudinary first
    if (document.cloudinaryUrl) {
      console.log('[Download] Streaming from Cloudinary:', document.cloudinaryUrl);
      // Stream from Cloudinary
      https.get(document.cloudinaryUrl, (cloudinaryRes) => {
        console.log('[Download] Cloudinary response status:', cloudinaryRes.statusCode);
        // If Cloudinary response is not okay, fall back to local file
        if (cloudinaryRes.statusCode >= 400) {
          console.warn('[Download] Cloudinary returned error status, falling back to local file');
          downloadLocalFile();
          return;
        }
        res.setHeader('Content-Type', document.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
        cloudinaryRes.pipe(res);
      }).on('error', (e) => {
        console.error('[Download] Cloudinary error, falling back to local file:', e);
        downloadLocalFile();
      });
      return;
    }

    // Local file fallback
    downloadLocalFile();

    function downloadLocalFile() {
      console.log('[Download] Using local file fallback');
      let fullPath = null;
      const uploadDir = path.join(__dirname, '../../uploads');
      
      // First try filePath (which should always have local filename)
      if (document.filePath) {
        fullPath = path.join(uploadDir, document.filePath);
      }
      
      // If not found, try filename
      if (!fullPath || !fs.existsSync(fullPath)) {
        if (document.filename) {
          fullPath = path.join(uploadDir, document.filename);
        }
      }
      
      console.log('[Download] Full path:', fullPath);
      console.log('[Download] File exists:', fullPath ? fs.existsSync(fullPath) : false);

      if (!fullPath || !fs.existsSync(fullPath)) {
        if (!res.headersSent) {
          return res.status(404).json({ message: 'Physical file not found on server' });
        }
        return;
      }

      res.download(fullPath, document.originalName, { dotfiles: 'allow' }, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ message: 'Error downloading file' });
        }
      });
    }
  } catch (error) {
    console.error('[Download] Error:', error);
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

    // Log delete activity
    await Activity.create({
      user: req.user._id,
      action: 'delete',
      document: document._id,
      details: `Moved document to trash: ${document.title}`,
    });

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

    // Log share activity
    await Activity.create({
      user: req.user._id,
      action: 'share',
      document: document._id,
      details: `Shared document: ${document.title}`,
    });

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
    let cloudResult = null;
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      cloudResult = await uploadToCloudinary(fileBuffer, req.file.originalname);
    } catch (uploadErr) {
      console.warn('[Public Share Upload] Cloudinary upload failed, using local storage:', uploadErr.message);
      // Cloudinary failed, we'll use local storage
    }

    // Unset current versions
    await Version.updateMany(
      { documentId: document._id },
      { isCurrentVersion: false }
    );

    const versionCount = await Version.countDocuments({ documentId: document._id });

    let vHash = null;
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      vHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (e) {
      // Non-critical
    }

    // Prepare version data
    const versionData = {
      documentId: document._id,
      versionNumber: versionCount + 1,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedBy: document.uploadedBy, // Attribute to the original owner
      isCurrentVersion: true,
      fileHash: vHash,
      filePath: req.file.filename, // Always store local filename
      actionLog: [{ action: 'uploaded', note: 'Uploaded via public share link' }],
    };

    if (cloudResult) {
      versionData.cloudinaryId = cloudResult.public_id;
      versionData.cloudinaryUrl = cloudResult.secure_url;
      versionData.filename = cloudResult.public_id;
    }

    // Create new version
    await Version.create(versionData);

    // Update main document pointer
    document.filename = cloudResult ? cloudResult.public_id : req.file.filename;
    document.filePath = req.file.filename; // Always update local filename
    document.originalName = req.file.originalname;
    document.mimeType = req.file.mimetype;
    document.size = req.file.size;
    if (cloudResult) {
      document.cloudinaryId = cloudResult.public_id;
      document.cloudinaryUrl = cloudResult.secure_url;
    }
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
