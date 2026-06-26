const mongoose = require('mongoose');

const folderSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a folder name'],
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure folder names are unique per user
folderSchema.index({ name: 1, owner: 1 }, { unique: true });

module.exports = mongoose.model('Folder', folderSchema);
