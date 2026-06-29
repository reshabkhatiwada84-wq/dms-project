const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');

// All favorites routes require authentication
router.use(protect);

// @desc    Get all favorite documents for the logged-in user
// @route   GET /api/favorites
// @access  Private
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('favorites');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch the actual documents that are favorited and not deleted
    const docs = await Document.find({
      _id: { $in: user.favorites },
      isDeleted: { $ne: true },
    })
      .populate('uploadedBy', 'name email')
      .populate('folder', 'name')
      .sort({ createdAt: -1 });

    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Toggle a document as favorite / unfavorite
// @route   POST /api/favorites/:documentId
// @access  Private
router.post('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    // Ensure the document exists and is not deleted
    const document = await Document.findOne({ _id: documentId, isDeleted: { $ne: true } });
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const user = await User.findById(req.user._id).select('favorites');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const alreadyFavorited = user.favorites.some(
      (favId) => favId.toString() === documentId
    );

    if (alreadyFavorited) {
      // Remove from favorites
      user.favorites = user.favorites.filter(
        (favId) => favId.toString() !== documentId
      );
    } else {
      // Add to favorites
      user.favorites.push(documentId);
    }

    await user.save();

    res.json({ isFavorite: !alreadyFavorited });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
