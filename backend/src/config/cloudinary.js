const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
require('dotenv').config();

// Parse CLOUDINARY_URL manually for maximum compatibility
// Format: cloudinary://api_key:api_secret@cloud_name
const cloudinaryUrl = process.env.CLOUDINARY_URL;
if (cloudinaryUrl) {
  try {
    const url = new URL(cloudinaryUrl);
    cloudinary.config({
      cloud_name: url.host,
      api_key: url.username,
      api_secret: decodeURIComponent(url.password),
      secure: true,
    });
    console.log('[Cloudinary] Configured via URL with cloud_name:', url.host);
  } catch (e) {
    console.error('[Cloudinary] Failed to parse CLOUDINARY_URL:', e.message);
  }
} else if (process.env.CLOUDINARY_CLOUD_NAME) {
  // Fallback: use individual env vars
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('[Cloudinary] Configured via individual env vars, cloud_name:', process.env.CLOUDINARY_CLOUD_NAME);
} else {
  console.warn('[Cloudinary] No Cloudinary credentials found!');
}

/**
 * Uploads a file buffer to Cloudinary using a stream.
 * @param {Buffer} buffer - The file buffer to upload.
 * @param {String} originalName - The original file name.
 * @returns {Promise<Object>} - The Cloudinary upload result.
 */
const uploadToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw', // Support for documents (pdf, docx, etc.)
        use_filename: true,
        filename_override: originalName,
        folder: 'dms_documents'
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] Upload error:', error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary
};
