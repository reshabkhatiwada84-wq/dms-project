const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Document = require('../models/Document');
const Version = require('../models/Version');
const Activity = require('../models/Activity');
const { protect, adminOrSuperAdmin, superAdminOnly } = require('../middleware/auth');
const fs = require('fs');

// All admin routes require protection and at least admin or superadmin
router.use(protect);
router.use(adminOrSuperAdmin);

// @desc    Get system stats
// @route   GET /api/admin/stats
// @access  Private (Admin/SuperAdmin)
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
// @access  Private (Admin/SuperAdmin)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a new admin (superadmin only)
// @route   POST /api/admin/users
// @access  Private (SuperAdmin)
router.post('/users', superAdminOnly, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin'
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private (SuperAdmin only can modify admins/users; admin can modify users)
router.put('/users/:id/role', async (req, res) => {
  try {
    const userToModify = await User.findById(req.params.id);

    if (!userToModify) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Can't modify superadmin
    if (userToModify.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify super admin' });
    }

    // Can't modify yourself
    if (userToModify._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    // Admin can only modify users; superadmin can modify admins and users
    if (req.user.role === 'admin' && userToModify.role === 'admin') {
      return res.status(403).json({ message: 'Admin cannot modify other admins' });
    }

    const requestedRole = req.body.role;
    // Validate role
    if (requestedRole && !['user', 'admin'].includes(requestedRole)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    // Can't make someone superadmin
    if (requestedRole === 'superadmin') {
      return res.status(403).json({ message: 'Cannot create super admin' });
    }

    userToModify.role = requestedRole || (userToModify.role === 'admin' ? 'user' : 'admin');
    await userToModify.save();

    res.json(userToModify);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a user and their documents
// @route   DELETE /api/admin/users/:id
// @access  Private (SuperAdmin only can delete admins; admin can delete users)
router.delete('/users/:id', async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);

    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Can't delete superadmin
    if (userToDelete.role === 'superadmin') {
      return res.status(403).json({ message: 'Cannot delete super admin' });
    }

    // Can't delete yourself
    if (userToDelete._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    // Admin can only delete users; superadmin can delete admins and users
    if (req.user.role === 'admin' && userToDelete.role === 'admin') {
      return res.status(403).json({ message: 'Admin cannot delete other admins' });
    }

    const documents = await Document.find({ uploadedBy: userToDelete._id });
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

// @desc    Get activity logs
// @route   GET /api/admin/activities
// @access  Private (Admin/SuperAdmin)
router.get('/activities', async (req, res) => {
  try {
    const activities = await Activity.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('user', 'name email')
      .populate('document', 'name')
      .populate('folder', 'name');

    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
