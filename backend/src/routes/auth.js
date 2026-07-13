const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { protect } = require('../middleware/auth');
const { cloudinary, uploadProfileImage } = require('../config/cloudinary');

// Ensure uploads directory exists for profile photos too
const profileUploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(profileUploadsDir)) {
  fs.mkdirSync(profileUploadsDir, { recursive: true });
}

// Multer disk storage for profile photo uploads (local fallback)
const profileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, profileUploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    },
  }),
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
        profilePhoto: user.profilePhoto || { url: null, publicId: null, fileName: null },
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
        profilePhoto: user.profilePhoto || { url: null, publicId: null, fileName: null },
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
  // Ensure profilePhoto has all fields
  const userData = {
    ...req.user.toObject(),
    profilePhoto: req.user.profilePhoto || { url: null, publicId: null, fileName: null }
  };
  res.json(userData);
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
        console.error('[ProfilePhoto] Failed to delete old photo from Cloudinary:', e.message);
      }
    }
    // Also delete old local file if exists
    if (user.profilePhoto && user.profilePhoto.fileName) {
      const oldLocalPath = path.join(profileUploadsDir, user.profilePhoto.fileName);
      try {
        if (fs.existsSync(oldLocalPath)) {
          fs.unlinkSync(oldLocalPath);
        }
      } catch (e) {
        console.error('[ProfilePhoto] Failed to delete old local file:', e.message);
      }
    }

    let result;
    // Try to upload new photo to Cloudinary first
    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      result = await uploadProfileImage(fileBuffer);
      user.profilePhoto = {
        url: result.secure_url,
        publicId: result.public_id,
        fileName: null,
      };
    } catch (cloudErr) {
      console.warn('[ProfilePhoto] Cloudinary upload failed, using local storage:', cloudErr.message);
      // Fallback to local storage — dynamically build the URL from the incoming request
      // so it works on any server (localhost, company LAN IP, etc.)
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      user.profilePhoto = {
        url: `${baseUrl}/uploads/${req.file.filename}`,
        publicId: null,
        fileName: req.file.filename,
      };
    }

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

    // Delete local file if exists
    if (user.profilePhoto && user.profilePhoto.fileName) {
      const oldLocalPath = path.join(profileUploadsDir, user.profilePhoto.fileName);
      try {
        if (fs.existsSync(oldLocalPath)) {
          fs.unlinkSync(oldLocalPath);
        }
      } catch (e) {
        console.error('[ProfilePhoto] Failed to delete local file:', e.message);
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
