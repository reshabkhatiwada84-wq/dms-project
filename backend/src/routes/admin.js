const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Document = require('../models/Document');
const Version = require('../models/Version');
const { protect, admin } = require('../middleware/auth');
const fs = require('fs');

router.use(protect);
router.use(admin);

// @desc    Get system stats
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDocuments = await Document.countDocuments({ isDeleted: { $ne: true } });
    
    const docs = await Document.find({ isDeleted: { $ne: true } });
    let totalStorage = 0;
    const categoryBreakdown = {
      Invoice: 0,
      Contract: 0,
      Resume: 0,
      Report: 0,
      Other: 0,
    };

    docs.forEach(doc => {
      totalStorage += doc.size || 0;
      if (categoryBreakdown.hasOwnProperty(doc.category)) {
        categoryBreakdown[doc.category]++;
      }
    });

    res.json({
      totalUsers,
      totalDocuments,
      totalStorage,
      categoryBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
router.put('/users/:id/role', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.email === 'rishabh@gmail.com') {
      return res.status(403).json({ message: 'The main administrator account cannot be modified.' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    const requestedRole = req.body ? req.body.role : undefined;
    user.role = requestedRole || (user.role === 'admin' ? 'user' : 'admin');
    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a user and their documents
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.email === 'rishabh@gmail.com') {
      return res.status(403).json({ message: 'The main administrator account cannot be deleted.' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete yourself' });
    }

    const documents = await Document.find({ uploadedBy: user._id });
    for (const doc of documents) {
      // Delete all associated version files and records
      const versions = await Version.find({ documentId: doc._id });
      for (const version of versions) {
        if (fs.existsSync(version.filePath)) fs.unlinkSync(version.filePath);
        await Version.findByIdAndDelete(version._id);
      }
      if (fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
      }
      await Document.findByIdAndDelete(doc._id);
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User and their documents & versions deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
