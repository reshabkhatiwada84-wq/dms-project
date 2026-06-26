const express = require('express');
const router = express.Router();
const Folder = require('../models/Folder');
const Document = require('../models/Document');
const { protect } = require('../middleware/auth');

router.use(protect);

// @desc    Get all folders for the current user
// @route   GET /api/folders
// @access  Private
router.get('/', async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { owner: req.user._id };
    const folders = await Folder.find(query).sort({ name: 1 });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create a new folder
// @route   POST /api/folders
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const folder = await Folder.create({ name: name.trim(), owner: req.user._id });
    res.status(201).json(folder);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A folder with this name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// @desc    Rename a folder
// @route   PUT /api/folders/:id
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (folder.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to rename this folder' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    folder.name = name.trim();
    await folder.save();
    res.json(folder);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A folder with this name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a folder (documents inside become unorganized)
// @route   DELETE /api/folders/:id
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);

    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (folder.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this folder' });
    }

    // Unlink all documents from this folder
    await Document.updateMany({ folder: folder._id }, { $unset: { folder: '' } });

    await Folder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Folder deleted successfully. Documents have been moved to Uncategorized.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
