const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Api_Response = require('../api_response_folder/Api_Response');

class FileHandler {
  /**
   * @param {Object} options
   * @param {string} [options.uploadDir='./uploads'] - Base directory for uploads
   * @param {Array<string>} [options.allowedTypes] - Allowed MIME types (e.g., ['image/jpeg', 'application/pdf'])
   * @param {number} [options.maxFileSize=10*1024*1024] - Max file size in bytes (default 10MB)
   * @param {boolean} [options.keepExtensions=true] - Keep file extensions
   * @param {boolean} [options.addToBody=true] - Automatically add file paths to request body
   */
  constructor(options = {}) {
    this.uploadDir = options.uploadDir || path.resolve(process.cwd(), 'uploads');
    this.allowedTypes = options.allowedTypes || null; // null = allow all
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.keepExtensions = options.keepExtensions !== false;
    this.addToBody = options.addToBody !== false;
    this.ensureBaseDir();
  }

  ensureBaseDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Create multer storage configuration
   * @param {string} uploadDir - Upload directory
   * @returns {multer.StorageEngine} - Multer storage engine
   */
  createStorage(uploadDir) {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const now = new Date();
        const datePath = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
        const typeDir = file.mimetype ? file.mimetype.split('/')[0] : 'other';
        const targetDir = path.join(uploadDir, typeDir, datePath);
        
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        
        cb(null, targetDir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '');
        const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2,10)}${ext}`;
        cb(null, uniqueName);
      }
    });
  }

  /**
   * Create file filter function
   * @param {Array<string>} allowedTypes - Allowed MIME types
   * @returns {Function} - File filter function
   */
  createFileFilter(allowedTypes) {
    return (req, file, cb) => {
      if (!allowedTypes) {
        return cb(null, true);
      }
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed: ${file.mimetype}`), false);
      }
    };
  }

  /**
   * Add file paths to request body
   * @param {Object} req - Express request object
   * @param {Object|Array} uploadedFiles - Uploaded files info
   * @param {string} uploadDir - Upload directory
   */
  addFilesToBody(req, uploadedFiles, uploadDir) {
    if (!this.addToBody || !uploadedFiles) return;
    if (!req.body) req.body = {};
    // If flexible or fields: always object with arrays
    if (typeof uploadedFiles === 'object' && !Array.isArray(uploadedFiles) && uploadedFiles !== null && uploadedFiles.field === undefined) {
      for (const [fieldName, files] of Object.entries(uploadedFiles)) {
        if (Array.isArray(files)) {
          if (files.length === 1) {
            req.body[fieldName] = files[0].url;
            req.body[`${fieldName}Details`] = files[0];
          } else {
            req.body[fieldName] = files.map(file => file.url);
            req.body[`${fieldName}Details`] = files;
          }
        }
      }
    } else if (Array.isArray(uploadedFiles)) {
      // Handle array of files (shouldn't happen for single/flexible, but for array mode)
      const filePaths = uploadedFiles.map(file => file.url);
      req.body.files = filePaths;
      req.body.fileDetails = uploadedFiles;
    } else if (typeof uploadedFiles === 'object' && uploadedFiles !== null && uploadedFiles.field) {
      // Single file object
      req.body[uploadedFiles.field] = uploadedFiles.url;
      req.body[`${uploadedFiles.field}Details`] = uploadedFiles;
    }
  }

  /**
   * Parse JSON string fields in req.body (in-place)
   * @param {Object} req - Express request object
   */
  parseJsonBodyFields(req) {
    if (req.body && typeof req.body === 'object') {
      for (const key in req.body) {
        if (typeof req.body[key] === 'string') {
          try {
            req.body = JSON.parse(req.body[key]);
          } catch (e) {
          }
        }
      }
    }
  }

  /**
   * Express middleware for handling file uploads
   * @param {Object} [opts] - Override instance options
   * @returns {Function} Express middleware
   */
  uploadMiddleware(opts = {}) {
    const uploadDir = opts.uploadDir || this.uploadDir;
    const allowedTypes = opts.allowedTypes || this.allowedTypes;
    const maxFileSize = opts.maxFileSize || this.maxFileSize;
    const addToBody = opts.addToBody !== undefined ? opts.addToBody : this.addToBody;
    const self = this;

    // Create multer instance
    const upload = multer({
      storage: this.createStorage(uploadDir),
      fileFilter: this.createFileFilter(allowedTypes),
      limits: {
        fileSize: maxFileSize,
        files: opts.maxFiles || 10 // Default max 10 files
      }
    });

    // Use Api_Response for error formatting
    return (req, res, next) => {
      const apiResponse = new Api_Response(process.env.NODE_ENV === 'development', '1.0.0');
      
      // Handle single file upload
      if (opts.single) {
        return upload.single(opts.single)(req, res, (err) => {
          if (err) {
            const errorResp = apiResponse.error('post', null, 'File upload error: ' + err.message, 400);
            apiResponse.setResponseHeaders(res, errorResp);
            return res.status(400).json(errorResp.body);
          }
          // Parse JSON string fields in body
          self.parseJsonBodyFields(req);
          // Only process if file exists
          if (req.file) {
            const processedFile = self.processUploadedFile(req.file, uploadDir);
            req.uploadedFiles = processedFile;
            // Add to body if enabled
            if (addToBody) {
              self.addFilesToBody(req, processedFile, uploadDir);
            }
          }
          next();
        });
      }
      // Handle multiple files for specific field
      if (opts.array) {
        return upload.array(opts.array, opts.maxFiles || 10)(req, res, (err) => {
          if (err) {
            const errorResp = apiResponse.error('post', null, 'File upload error: ' + err.message, 400);
            apiResponse.setResponseHeaders(res, errorResp);
            return res.status(400).json(errorResp.body);
          }
          self.parseJsonBodyFields(req);
          // Only process if files exist
          if (req.files && req.files.length > 0) {
            const processedFiles = self.processUploadedFiles(req.files, uploadDir);
            req.uploadedFiles = processedFiles;
            // Add to body if enabled
            if (addToBody) {
              self.addFilesToBody(req, processedFiles, uploadDir);
            }
          }
          next();
        });
      }
      // Handle multiple fields with multiple files
      if (opts.fields) {
        return upload.fields(opts.fields)(req, res, (err) => {
          if (err) {
            const errorResp = apiResponse.error('post', null, 'File upload error: ' + err.message, 400);
            apiResponse.setResponseHeaders(res, errorResp);
            return res.status(400).json(errorResp.body);
          }
          self.parseJsonBodyFields(req);
          // Only process if files exist
          if (req.files && Object.keys(req.files).length > 0) {
            const processedFiles = self.processUploadedFilesByFields(req.files, uploadDir);
            req.uploadedFiles = processedFiles;
            // Add to body if enabled
            if (addToBody) {
              self.addFilesToBody(req, processedFiles, uploadDir);
            }
          }
          next();
        });
      }
      // Handle flexible field acceptance
      if (opts.flexible) {
        return upload.any()(req, res, (err) => {
          if (err) {
            const errorResp = apiResponse.error('post', null, 'File upload error: ' + err.message, 400);
            apiResponse.setResponseHeaders(res, errorResp);
            return res.status(400).json(errorResp.body);
          }
          self.parseJsonBodyFields(req);
          // Only process if files exist
          if (req.files && req.files.length > 0) {
            const processedFiles = self.processFlexibleFiles(req.files, uploadDir, opts);
            req.uploadedFiles = processedFiles;
            // Add to body if enabled
            if (addToBody) {
              self.addFilesToBody(req, processedFiles, uploadDir);
            }
          }
          next();
        });
      }
      // Default: handle any files
      return upload.any()(req, res, (err) => {
        if (err) {
          const errorResp = apiResponse.error('post', null, 'File upload error: ' + err.message, 400);
          apiResponse.setResponseHeaders(res, errorResp);
          return res.status(400).json(errorResp.body);
        }
        self.parseJsonBodyFields(req);
        // Only process if files exist
        if (req.files && req.files.length > 0) {
          const processedFiles = self.processUploadedFiles(req.files, uploadDir);
          req.uploadedFiles = processedFiles;
          // Add to body if enabled
          if (addToBody) {
            self.addFilesToBody(req, processedFiles, uploadDir);
          }
        }
        next();
      });
    };
  }

  /**
   * Process files with flexible field handling
   * @param {Array} files - Array of multer file objects
   * @param {string} baseDir - Base upload directory
   * @param {Object} opts - Options including field patterns
   * @returns {Object} - Organized file info by field patterns (always arrays)
   */
  processFlexibleFiles(files, baseDir, opts) {
    const organized = {};
    const fieldPatterns = opts.fieldPatterns || ['file', 'files', 'image', 'images'];
    for (const file of files) {
      const fieldName = file.fieldname;
      const processedFile = this.processUploadedFile(file, baseDir);
      // Check if field name matches any pattern
      const matchedPattern = fieldPatterns.find(pattern => 
        fieldName === pattern || 
        fieldName.startsWith(pattern) ||
        fieldName.includes(pattern)
      );
      const key = matchedPattern || fieldName;
      if (!organized[key]) organized[key] = [];
      organized[key].push(processedFile);
    }
    // Always return arrays for each field
    return organized;
  }

  /**
   * Process a single uploaded file
   * @param {Object} file - Multer file object
   * @param {string} baseDir - Base upload directory
   * @returns {Object} - Processed file info
   */
  processUploadedFile(file, baseDir) {
    const relativePath = path.relative(baseDir, file.path);
    const url = `/uploads/${relativePath.replace(/\\/g, '/')}`;
    
    return {
      field: file.fieldname,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      url: url
    };
  }

  /**
   * Process multiple uploaded files
   * @param {Array} files - Array of multer file objects
   * @param {string} baseDir - Base upload directory
   * @returns {Array} - Array of processed file info
   */
  processUploadedFiles(files, baseDir) {
    return files.map(file => this.processUploadedFile(file, baseDir));
  }

  /**
   * Process uploaded files organized by fields
   * @param {Object} files - Object with field names as keys and arrays of files as values
   * @param {string} baseDir - Base upload directory
   * @returns {Object} - Organized file info by field
   */
  processUploadedFilesByFields(files, baseDir) {
    const organized = {};
    
    for (const [field, fileArray] of Object.entries(files)) {
      organized[field] = fileArray.map(file => this.processUploadedFile(file, baseDir));
    }
    
    return organized;
  }

  /**
   * Convenience method for single file upload
   * @param {string} fieldName - Field name for the file
   * @param {Object} [opts] - Additional options
   * @returns {Function} Express middleware
   */
  single(fieldName, opts = {}) {
    return this.uploadMiddleware({ ...opts, single: fieldName });
  }

  /**
   * Convenience method for multiple files upload
   * @param {string} fieldName - Field name for the files
   * @param {number} [maxFiles=10] - Maximum number of files
   * @param {Object} [opts] - Additional options
   * @returns {Function} Express middleware
   */
  array(fieldName, maxFiles = 10, opts = {}) {
    return this.uploadMiddleware({ ...opts, array: fieldName, maxFiles });
  }

  /**
   * Convenience method for multiple fields with files
   * @param {Array} fields - Array of field configurations
   * @param {Object} [opts] - Additional options
   * @returns {Function} Express middleware
   */
  fields(fields, opts = {}) {
    return this.uploadMiddleware({ ...opts, fields });
  }

  /**
   * Convenience method for flexible file acceptance
   * @param {Array} [fieldPatterns] - Array of field patterns to match
   * @param {Object} [opts] - Additional options
   * @returns {Function} Express middleware
   */
  flexible(fieldPatterns = ['file', 'files', 'image', 'images'], opts = {}) {
    return this.uploadMiddleware({ ...opts, flexible: true, fieldPatterns });
  }
}

module.exports = FileHandler; 