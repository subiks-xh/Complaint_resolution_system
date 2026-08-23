/**
 * Cloudinary Configuration
 *
 * This module handles Cloudinary setup for file uploads,
 * including image and document management for the complaint system.
 * Provides upload, delete, and transformation utilities.
 */

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const path = require("path");

/**
 * Cloudinary Configuration
 * Configure Cloudinary with credentials from environment variables
 */
const configureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  // Validate required environment variables
  if (
    !cloudName ||
    !apiKey ||
    !apiSecret ||
    cloudName === "your-cloud-name" ||
    apiKey === "your-api-key" ||
    apiSecret === "your-api-secret"
  ) {
    console.warn("⚠️  Cloudinary credentials not fully configured");
    console.warn("⚠️  File uploads will use local storage as fallback");
    return false;
  }

  // Configure Cloudinary
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true, // Use HTTPS URLs
  });

  console.log("☁️  Cloudinary configured successfully");
  return true;
};

// Initialize Cloudinary on module load
const isCloudinaryConfigured = configureCloudinary();

/**
 * Allowed File Types Configuration
 */
const allowedFileTypes = {
  // Images
  images: {
    mimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ],
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  // Documents
  documents: {
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
    extensions: [".pdf", ".doc", ".docx", ".txt"],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  // All attachments (for complaints)
  attachments: {
    mimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ],
    extensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
};

/**
 * Cloudinary Folder Structure
 */
const cloudinaryFolders = {
  avatars: "complaint-system/avatars",
  complaints: "complaint-system/complaints",
  resolutions: "complaint-system/resolutions",
  documents: "complaint-system/documents",
};

/**
 * Cloudinary Storage Configuration for Multer
 * Creates storage engine for different upload types
 *
 * @param {string} folderType - Type of folder ('avatars', 'complaints', etc.)
 * @returns {CloudinaryStorage} Multer storage engine
 */
const createCloudinaryStorage = (folderType = "complaints") => {
  if (!isCloudinaryConfigured) {
    throw new Error(
      "Cloudinary is not configured. Check environment variables.",
    );
  }

  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      // Get file extension
      const ext = path.extname(file.originalname).toLowerCase();

      // Determine resource type
      let resourceType = "auto";
      if (allowedFileTypes.images.extensions.includes(ext)) {
        resourceType = "image";
      } else {
        resourceType = "raw"; // For documents and other files
      }

      // Generate unique filename
      const timestamp = Date.now();
      const uniqueId = Math.random().toString(36).substring(2, 8);
      const filename = `${folderType}-${timestamp}-${uniqueId}`;

      return {
        folder: cloudinaryFolders[folderType] || cloudinaryFolders.complaints,
        public_id: filename,
        resource_type: resourceType,
        // Image transformations (only applied to images)
        ...(resourceType === "image" && {
          transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
        }),
        // Allowed formats
        allowed_formats: allowedFileTypes.attachments.extensions.map((ext) =>
          ext.replace(".", ""),
        ),
      };
    },
  });
};

/**
 * File Filter Function
 * Validates uploaded files against allowed types
 *
 * @param {string} uploadType - Type of upload ('images', 'documents', 'attachments')
 * @returns {Function} Multer file filter function
 */
const createFileFilter = (uploadType = "attachments") => {
  const config = allowedFileTypes[uploadType] || allowedFileTypes.attachments;

  return (req, file, cb) => {
    // Check MIME type
    if (!config.mimeTypes.includes(file.mimetype)) {
      const error = new Error(
        `Invalid file type. Allowed types: ${config.extensions.join(", ")}`,
      );
      error.code = "INVALID_FILE_TYPE";
      return cb(error, false);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!config.extensions.includes(ext)) {
      const error = new Error(
        `Invalid file extension. Allowed extensions: ${config.extensions.join(", ")}`,
      );
      error.code = "INVALID_FILE_EXTENSION";
      return cb(error, false);
    }

    // File is valid
    cb(null, true);
  };
};

/**
 * Create Multer Upload Instance
 *
 * @param {Object} options - Upload configuration options
 * @param {string} options.folderType - Cloudinary folder type
 * @param {string} options.fileType - Allowed file types ('images', 'documents', 'attachments')
 * @param {number} options.maxFiles - Maximum number of files
 * @param {number} options.maxSize - Maximum file size in bytes
 * @returns {multer.Multer} Configured multer instance
 */
const createUploader = (options = {}) => {
  const {
    folderType = "complaints",
    fileType = "attachments",
    maxFiles = 5,
    maxSize = allowedFileTypes.attachments.maxSize,
  } = options;

  // Use Cloudinary storage if configured, otherwise fall back to memory storage
  const storage = isCloudinaryConfigured
    ? createCloudinaryStorage(folderType)
    : multer.memoryStorage();

  return multer({
    storage,
    fileFilter: createFileFilter(fileType),
    limits: {
      fileSize: maxSize,
      files: maxFiles,
    },
  });
};

/**
 * Pre-configured Upload Instances
 */
const uploaders = {
  // Avatar upload (single image)
  avatar: createUploader({
    folderType: "avatars",
    fileType: "images",
    maxFiles: 1,
    maxSize: 2 * 1024 * 1024, // 2MB
  }),

  // Complaint attachments (multiple files)
  complaintAttachments: createUploader({
    folderType: "complaints",
    fileType: "attachments",
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB per file
  }),

  // Resolution evidence (multiple files)
  resolutionEvidence: createUploader({
    folderType: "resolutions",
    fileType: "attachments",
    maxFiles: 5,
    maxSize: 10 * 1024 * 1024, // 10MB per file
  }),
};

/**
 * Upload File to Cloudinary (Direct Upload)
 *
 * @param {string|Buffer} file - File path or buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadToCloudinary = async (file, options = {}) => {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured");
  }

  const {
    folder = cloudinaryFolders.complaints,
    resourceType = "auto",
    transformation = [],
  } = options;

  try {
    const result = await cloudinary.uploader.upload(file, {
      folder,
      resource_type: resourceType,
      transformation,
    });

    return {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      size: result.bytes,
      width: result.width,
      height: result.height,
      resourceType: result.resource_type,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Upload Multiple Files to Cloudinary
 *
 * @param {Array} files - Array of file paths or buffers
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} Array of upload results
 */
const uploadMultipleToCloudinary = async (files, options = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const uploadPromises = files.map((file) => uploadToCloudinary(file, options));
  return Promise.all(uploadPromises);
};

/**
 * Delete File from Cloudinary
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type ('image', 'raw', 'video')
 * @returns {Promise<Object>} Deletion result
 */
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured");
  }

  if (!publicId) {
    throw new Error("Public ID is required for deletion");
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return {
      success: result.result === "ok",
      result: result.result,
    };
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Delete Multiple Files from Cloudinary
 *
 * @param {Array<string>} publicIds - Array of Cloudinary public IDs
 * @param {string} resourceType - Resource type
 * @returns {Promise<Object>} Deletion results
 */
const deleteMultipleFromCloudinary = async (
  publicIds,
  resourceType = "image",
) => {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured");
  }

  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return { deleted: {}, failed: [] };
  }

  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
    });

    return {
      deleted: result.deleted,
      deletedCount: Object.keys(result.deleted).length,
    };
  } catch (error) {
    console.error("Cloudinary bulk deletion error:", error);
    throw new Error(`Failed to delete files: ${error.message}`);
  }
};

/**
 * Get Optimized Image URL
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Transformation options
 * @returns {string} Optimized image URL
 */
const getOptimizedUrl = (publicId, options = {}) => {
  if (!isCloudinaryConfigured) {
    return publicId; // Return as-is if not configured
  }

  const {
    width,
    height,
    crop = "fill",
    quality = "auto",
    format = "auto",
  } = options;

  const transformation = [{ quality }, { fetch_format: format }];

  if (width) transformation.push({ width });
  if (height) transformation.push({ height });
  if (width || height) transformation.push({ crop });

  return cloudinary.url(publicId, {
    transformation,
    secure: true,
  });
};

/**
 * Get Thumbnail URL
 *
 * @param {string} publicId - Cloudinary public ID
 * @param {number} size - Thumbnail size (default 150)
 * @returns {string} Thumbnail URL
 */
const getThumbnailUrl = (publicId, size = 150) => {
  return getOptimizedUrl(publicId, {
    width: size,
    height: size,
    crop: "thumb",
  });
};

/**
 * Extract Public ID from Cloudinary URL
 *
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID or null
 */
const extractPublicId = (url) => {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    // Match Cloudinary URL pattern
    const regex = /\/v\d+\/(.+)\.[a-zA-Z]+$/;
    const match = url.match(regex);

    if (match && match[1]) {
      return match[1];
    }

    // Try alternate pattern (without version)
    const altRegex = /\/image\/upload\/(.+)\.[a-zA-Z]+$/;
    const altMatch = url.match(altRegex);

    return altMatch ? altMatch[1] : null;
  } catch (error) {
    return null;
  }
};

// Export all functions and instances
module.exports = {
  // Cloudinary instance
  cloudinary,

  // Configuration status
  isCloudinaryConfigured,

  // Pre-configured uploaders (Multer instances)
  uploaders,

  // Storage and filter creators
  createCloudinaryStorage,
  createFileFilter,
  createUploader,

  // Direct upload functions
  uploadToCloudinary,
  uploadMultipleToCloudinary,

  // Deletion functions
  deleteFromCloudinary,
  deleteMultipleFromCloudinary,

  // URL utilities
  getOptimizedUrl,
  getThumbnailUrl,
  extractPublicId,

  // Configuration constants
  allowedFileTypes,
  cloudinaryFolders,
};
