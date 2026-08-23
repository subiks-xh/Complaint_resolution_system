/**
 * Upload Middleware
 *
 * Handles file upload processing:
 * - Multer configuration
 * - File type validation
 * - Size limits
 * - Storage configuration (local/cloud)
 * - Error handling
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const {
  cloudinary,
  isCloudinaryConfigured,
  allowedFileTypes,
} = require("../config/cloudinary");

/**
 * Ensure upload directory exists (for local storage)
 */
const ensureUploadDir = (dir) => {
  const uploadPath = path.join(__dirname, "..", dir);
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
  return uploadPath;
};

/**
 * Generate unique filename
 */
const generateFilename = (originalname) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const ext = path.extname(originalname).toLowerCase();
  const baseName = path
    .basename(originalname, ext)
    .replace(/[^a-zA-Z0-9]/g, "-")
    .substring(0, 20);
  return `${baseName}-${timestamp}-${randomString}${ext}`;
};

/**
 * Local Storage Configuration
 */
const createLocalStorage = (destination = "uploads") => {
  const uploadPath = ensureUploadDir(destination);

  return multer.diskStorage({
    destination: (req, file, cb) => {
      // Create subdirectory based on file type
      let subDir = "misc";
      if (file.mimetype.startsWith("image/")) {
        subDir = "images";
      } else if (file.mimetype === "application/pdf") {
        subDir = "documents";
      }

      const fullPath = path.join(uploadPath, subDir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }

      cb(null, fullPath);
    },
    filename: (req, file, cb) => {
      cb(null, generateFilename(file.originalname));
    },
  });
};

/**
 * Cloudinary Storage Configuration
 */
const createCloudinaryStorage = (folder = "complaint-system/uploads") => {
  if (!isCloudinaryConfigured) {
    console.warn("Cloudinary not configured, falling back to local storage");
    return createLocalStorage();
  }

  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const ext = path.extname(file.originalname).toLowerCase();

      // Determine resource type
      let resourceType = "auto";
      let folder_path = folder;

      if (allowedFileTypes.images.extensions.includes(ext)) {
        resourceType = "image";
        folder_path = `${folder}/images`;
      } else {
        resourceType = "raw";
        folder_path = `${folder}/documents`;
      }

      return {
        folder: folder_path,
        public_id: generateFilename(file.originalname).replace(ext, ""),
        resource_type: resourceType,
        allowed_formats: allowedFileTypes.attachments.extensions.map((e) =>
          e.replace(".", ""),
        ),
        transformation:
          resourceType === "image"
            ? [{ quality: "auto:good" }, { fetch_format: "auto" }]
            : undefined,
      };
    },
  });
};

/**
 * File Filter Factory
 * Creates file filter for specific upload types
 *
 * @param {string} type - 'images', 'documents', or 'attachments'
 * @returns {Function} Multer file filter function
 */
const createFileFilter = (type = "attachments") => {
  const config = allowedFileTypes[type] || allowedFileTypes.attachments;

  return (req, file, cb) => {
    // Check MIME type
    if (!config.mimeTypes.includes(file.mimetype)) {
      const error = new Error(
        `Invalid file type: ${file.mimetype}. Allowed types: ${config.extensions.join(", ")}`,
      );
      error.code = "INVALID_FILE_TYPE";
      return cb(error, false);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!config.extensions.includes(ext)) {
      const error = new Error(
        `Invalid file extension: ${ext}. Allowed extensions: ${config.extensions.join(", ")}`,
      );
      error.code = "INVALID_FILE_EXTENSION";
      return cb(error, false);
    }

    cb(null, true);
  };
};

/**
 * Create Multer Upload Instance
 *
 * @param {Object} options - Configuration options
 * @returns {multer.Multer} Configured multer instance
 */
const createUploader = (options = {}) => {
  const {
    destination = "uploads",
    cloudinaryFolder = "complaint-system/uploads",
    fileType = "attachments",
    maxSize = allowedFileTypes.attachments.maxSize,
    maxFiles = 5,
    useCloudinary = isCloudinaryConfigured,
  } = options;

  // Choose storage
  const storage = useCloudinary
    ? createCloudinaryStorage(cloudinaryFolder)
    : createLocalStorage(destination);

  return multer({
    storage,
    fileFilter: createFileFilter(fileType),
    limits: {
      fileSize: maxSize,
      files: maxFiles,
      fields: 10,
      fieldNameSize: 100,
      fieldSize: 1024 * 1024, // 1MB for text fields
    },
  });
};

/**
 * Pre-configured Upload Instances
 */

// Avatar upload (single image, 2MB max)
const avatarUpload = createUploader({
  cloudinaryFolder: "complaint-system/avatars",
  destination: "uploads/avatars",
  fileType: "images",
  maxSize: 2 * 1024 * 1024, // 2MB
  maxFiles: 1,
});

// Complaint attachments (multiple files, 10MB each, max 5 files)
const complaintAttachmentsUpload = createUploader({
  cloudinaryFolder: "complaint-system/complaints",
  destination: "uploads/complaints",
  fileType: "attachments",
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
});

// Resolution evidence (multiple files, 10MB each, max 5 files)
const resolutionEvidenceUpload = createUploader({
  cloudinaryFolder: "complaint-system/resolutions",
  destination: "uploads/resolutions",
  fileType: "attachments",
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
});

// Document upload (PDFs and docs, 10MB max)
const documentUpload = createUploader({
  cloudinaryFolder: "complaint-system/documents",
  destination: "uploads/documents",
  fileType: "documents",
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 3,
});

/**
 * Upload Middleware Wrappers
 * These provide additional error handling and processing
 */

/**
 * Single file upload middleware
 *
 * @param {string} fieldName - Form field name
 * @param {Object} options - Upload options
 * @returns {Function} Express middleware
 */
const uploadSingle = (fieldName, options = {}) => {
  const uploader = options.uploader || createUploader(options);

  return (req, res, next) => {
    uploader.single(fieldName)(req, res, (err) => {
      if (err) {
        return handleUploadError(err, res);
      }

      // Process uploaded file
      if (req.file) {
        req.file = processUploadedFile(req.file);
      }

      next();
    });
  };
};

/**
 * Multiple files upload middleware (same field)
 *
 * @param {string} fieldName - Form field name
 * @param {number} maxCount - Maximum number of files
 * @param {Object} options - Upload options
 * @returns {Function} Express middleware
 */
const uploadMultiple = (fieldName, maxCount = 5, options = {}) => {
  const uploader =
    options.uploader || createUploader({ ...options, maxFiles: maxCount });

  return (req, res, next) => {
    uploader.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        return handleUploadError(err, res);
      }

      // Process uploaded files
      if (req.files && req.files.length > 0) {
        req.files = req.files.map(processUploadedFile);
      }

      next();
    });
  };
};

/**
 * Multiple fields upload middleware
 *
 * @param {Array<{name: string, maxCount: number}>} fields - Field configurations
 * @param {Object} options - Upload options
 * @returns {Function} Express middleware
 */
const uploadFields = (fields, options = {}) => {
  const uploader = options.uploader || createUploader(options);

  return (req, res, next) => {
    uploader.fields(fields)(req, res, (err) => {
      if (err) {
        return handleUploadError(err, res);
      }

      // Process uploaded files
      if (req.files) {
        Object.keys(req.files).forEach((fieldName) => {
          req.files[fieldName] = req.files[fieldName].map(processUploadedFile);
        });
      }

      next();
    });
  };
};

/**
 * Process uploaded file - normalize file object
 */
const processUploadedFile = (file) => {
  return {
    fieldname: file.fieldname,
    originalname: file.originalname,
    encoding: file.encoding,
    mimetype: file.mimetype,
    size: file.size,
    // Local storage
    filename: file.filename,
    path: file.path,
    destination: file.destination,
    // Cloudinary storage
    public_id: file.public_id || file.filename,
    url: file.path || file.secure_url || file.url,
    secure_url: file.secure_url,
    // Metadata
    uploadedAt: new Date(),
  };
};

/**
 * Handle upload errors
 */
const handleUploadError = (err, res) => {
  console.error("Upload error:", err);

  // Multer specific errors
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: "File size exceeds the maximum allowed limit",
          code: "FILE_TOO_LARGE",
          maxSize: err.field,
        });

      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many files uploaded",
          code: "TOO_MANY_FILES",
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: `Unexpected file field: ${err.field}`,
          code: "UNEXPECTED_FILE_FIELD",
        });

      case "LIMIT_PART_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many parts in multipart form",
          code: "TOO_MANY_PARTS",
        });

      case "LIMIT_FIELD_KEY":
        return res.status(400).json({
          success: false,
          message: "Field name too long",
          code: "FIELD_NAME_TOO_LONG",
        });

      case "LIMIT_FIELD_VALUE":
        return res.status(400).json({
          success: false,
          message: "Field value too long",
          code: "FIELD_VALUE_TOO_LONG",
        });

      case "LIMIT_FIELD_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many fields",
          code: "TOO_MANY_FIELDS",
        });

      default:
        return res.status(400).json({
          success: false,
          message: "File upload error",
          code: "UPLOAD_ERROR",
          details: err.message,
        });
    }
  }

  // Custom validation errors
  if (
    err.code === "INVALID_FILE_TYPE" ||
    err.code === "INVALID_FILE_EXTENSION"
  ) {
    return res.status(400).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }

  // Cloudinary errors
  if (err.message && err.message.includes("cloudinary")) {
    return res.status(500).json({
      success: false,
      message: "Error uploading to cloud storage",
      code: "CLOUD_UPLOAD_ERROR",
    });
  }

  // Generic error
  return res.status(500).json({
    success: false,
    message: "Error processing file upload",
    code: "UPLOAD_ERROR",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};

/**
 * Specific Upload Middlewares
 */

// Avatar upload middleware
const uploadAvatar = (req, res, next) => {
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err) {
      return handleUploadError(err, res);
    }

    if (req.file) {
      req.file = processUploadedFile(req.file);
    }

    next();
  });
};

// Complaint attachments middleware
const uploadComplaintAttachments = (req, res, next) => {
  complaintAttachmentsUpload.array("attachments", 5)(req, res, (err) => {
    if (err) {
      return handleUploadError(err, res);
    }

    if (req.files && req.files.length > 0) {
      req.files = req.files.map(processUploadedFile);
    }

    next();
  });
};

// Resolution evidence middleware
const uploadResolutionEvidence = (req, res, next) => {
  resolutionEvidenceUpload.array("evidence", 5)(req, res, (err) => {
    if (err) {
      return handleUploadError(err, res);
    }

    if (req.files && req.files.length > 0) {
      req.files = req.files.map(processUploadedFile);
    }

    next();
  });
};

/**
 * Optional file upload middleware
 * Doesn't fail if no files are uploaded
 */
const optionalUpload = (uploadMiddleware) => {
  return (req, res, next) => {
    // Check if request has files
    const contentType = req.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      return next();
    }

    uploadMiddleware(req, res, (err) => {
      // Ignore "no file" errors
      if (err && err.code === "LIMIT_UNEXPECTED_FILE") {
        return next();
      }

      if (err) {
        return handleUploadError(err, res);
      }

      next();
    });
  };
};

/**
 * Delete uploaded file utility
 * Works with both local and Cloudinary storage
 */
const deleteUploadedFile = async (file) => {
  if (!file) return;

  try {
    // Cloudinary file
    if (file.public_id && isCloudinaryConfigured) {
      const { deleteFromCloudinary } = require("../config/cloudinary");
      await deleteFromCloudinary(file.public_id);
      return;
    }

    // Local file
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

/**
 * Delete multiple uploaded files
 */
const deleteUploadedFiles = async (files) => {
  if (!files || !Array.isArray(files)) return;

  await Promise.all(files.map((file) => deleteUploadedFile(file)));
};

/**
 * Cleanup middleware - removes uploaded files on error
 * Should be used after upload middleware
 */
const cleanupOnError = (req, res, next) => {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method
  res.json = function (body) {
    // If response indicates error, cleanup uploaded files
    if (body && body.success === false) {
      const files = req.file ? [req.file] : req.files || [];

      if (Array.isArray(files)) {
        deleteUploadedFiles(files).catch(console.error);
      } else if (typeof files === "object") {
        // Handle fields upload
        Object.values(files).forEach((fieldFiles) => {
          deleteUploadedFiles(fieldFiles).catch(console.error);
        });
      }
    }

    return originalJson(body);
  };

  next();
};

/**
 * Validate file exists middleware
 */
const requireFile = (fieldName = "file") => {
  return (req, res, next) => {
    const file = req.file || (req.files && req.files[fieldName]);

    if (!file || (Array.isArray(file) && file.length === 0)) {
      return res.status(400).json({
        success: false,
        message: `Please upload a file in the "${fieldName}" field`,
        code: "FILE_REQUIRED",
      });
    }

    next();
  };
};

/**
 * Validate minimum number of files
 */
const requireMinFiles = (fieldName, minCount) => {
  return (req, res, next) => {
    const files = req.files;

    if (!files || !Array.isArray(files) || files.length < minCount) {
      return res.status(400).json({
        success: false,
        message: `Please upload at least ${minCount} file(s)`,
        code: "MIN_FILES_REQUIRED",
        required: minCount,
        received: files ? files.length : 0,
      });
    }

    next();
  };
};

/**
 * Get file URL utility
 */
const getFileUrl = (file) => {
  if (!file) return null;

  // Cloudinary URL
  if (file.secure_url) return file.secure_url;
  if (file.url && file.url.includes("cloudinary")) return file.url;

  // Local file URL
  if (file.path) {
    const relativePath = file.path.replace(/\\/g, "/");
    const uploadsIndex = relativePath.indexOf("uploads/");
    if (uploadsIndex !== -1) {
      return `/${relativePath.substring(uploadsIndex)}`;
    }
  }

  return file.url || file.path || null;
};

/**
 * Memory storage for temporary processing
 */
const memoryStorage = multer.memoryStorage();

const createMemoryUploader = (options = {}) => {
  const {
    fileType = "attachments",
    maxSize = allowedFileTypes.attachments.maxSize,
    maxFiles = 5,
  } = options;

  return multer({
    storage: memoryStorage,
    fileFilter: createFileFilter(fileType),
    limits: {
      fileSize: maxSize,
      files: maxFiles,
    },
  });
};

module.exports = {
  // Factory functions
  createUploader,
  createLocalStorage,
  createCloudinaryStorage,
  createFileFilter,
  createMemoryUploader,

  // Pre-configured uploaders
  avatarUpload,
  complaintAttachmentsUpload,
  resolutionEvidenceUpload,
  documentUpload,

  // Middleware wrappers
  uploadSingle,
  uploadMultiple,
  uploadFields,
  optionalUpload,

  // Specific middlewares
  uploadAvatar,
  uploadComplaintAttachments,
  uploadResolutionEvidence,

  // Utilities
  processUploadedFile,
  handleUploadError,
  deleteUploadedFile,
  deleteUploadedFiles,
  cleanupOnError,
  requireFile,
  requireMinFiles,
  getFileUrl,
  generateFilename,
  ensureUploadDir,

  // Storage instances
  memoryStorage,
};
