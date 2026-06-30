const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configuration is automatically picked up from process.env.CLOUDINARY_URL

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
