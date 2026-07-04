const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');
const { cloudinary, uploadProfileImage } = require('../config/cloudinary');

// Multer memory storage for profile photo uploads
const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'jwtsecretkey123', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { name, password } = req.body;
  const email = req.body.email?.toLowerCase();

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: 'user',
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto || { url: null, publicId: null },
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { password } = req.body;
  const email = req.body.email?.toLowerCase();

  try {
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      // Log login activity
      await Activity.create({
        user: user._id,
        action: 'login',
        details: 'User logged in successfully',
      });

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhoto: user.profilePhoto || { url: null, publicId: null },
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Request a password reset token
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const email = req.body.email?.toLowerCase();

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether the email exists — always respond success
      return res.json({
        message: 'If an account exists with this email, a reset token has been generated.',
        resetToken: null,
      });
    }

    // Generate a 6-digit numeric token (easy to read/copy)
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    res.json({
      message: 'Reset token generated. It is valid for 15 minutes.',
      resetToken, // Returned in dev (no email service configured). Replace with email send in production.
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Reset password using the reset token
// @route   POST /api/auth/reset-password
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const email = req.body.email?.toLowerCase();

  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: 'Email, token, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const user = await User.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password (the pre-save hook will hash it)
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// @desc    Upload or replace profile photo
// @route   PUT /api/auth/profile-photo
// @access  Private
router.put('/profile-photo', protect, profileUpload.single('profilePhoto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Delete old photo from Cloudinary if one exists
    if (user.profilePhoto && user.profilePhoto.publicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePhoto.publicId, { resource_type: 'image' });
      } catch (e) {
        console.error('[ProfilePhoto] Failed to delete old photo:', e.message);
      }
    }

    // Upload new photo
    const result = await uploadProfileImage(req.file.buffer);

    user.profilePhoto = {
      url: result.secure_url,
      publicId: result.public_id,
    };
    await user.save();

    res.json({
      message: 'Profile photo updated successfully',
      profilePhoto: user.profilePhoto,
    });
  } catch (error) {
    console.error('[ProfilePhoto] Upload error:', error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Remove profile photo
// @route   DELETE /api/auth/profile-photo
// @access  Private
router.delete('/profile-photo', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Delete from Cloudinary
    if (user.profilePhoto && user.profilePhoto.publicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePhoto.publicId, { resource_type: 'image' });
      } catch (e) {
        console.error('[ProfilePhoto] Failed to delete from Cloudinary:', e.message);
      }
    }

    user.profilePhoto = { url: null, publicId: null };
    await user.save();

    res.json({ message: 'Profile photo removed successfully', profilePhoto: user.profilePhoto });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
