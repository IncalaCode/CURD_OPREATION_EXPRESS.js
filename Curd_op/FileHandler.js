const { IncomingForm } = require('formidable');
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
   */
  constructor(options = {}) {
    this.uploadDir = options.uploadDir || path.resolve(process.cwd(), 'uploads');
    this.allowedTypes = options.allowedTypes || null; // null = allow all
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.keepExtensions = options.keepExtensions !== false;
    this.ensureBaseDir();
  }

  ensureBaseDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
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
    const keepExtensions = opts.keepExtensions !== false;
    const self = this;

    // Use Api_Response for error formatting
    return (req, res, next) => {
      // You may want to pass dev mode/version from env or config
      const apiResponse = new Api_Response(process.env.NODE_ENV === 'development', '1.0.0');
      const form = new IncomingForm({
        uploadDir,
        maxFileSize,
        keepExtensions,
        multiples: true,
        filter: ({ mimetype }) => {
          if (!allowedTypes) return true;
          return allowedTypes.includes(mimetype);
        },
      });

      form.parse(req, async (err, fields, files) => {
        if (err) {
          const errorResp = apiResponse.error('post', null, 'File upload error: ' + err.message, 400);
          return res.status(400).json(errorResp);
        }
        try {
          // Organize and validate files
          const organized = await self.organizeFiles(files, uploadDir, allowedTypes);
          req.uploadedFiles = organized;
          req.body = { ...fields, ...req.body };
          next();
        } catch (e) {
          const errorResp = apiResponse.error('post', null, 'File handling error: ' + e.message, 400);
          return res.status(400).json(errorResp);
        }
      });
    };
  }

  /**
   * Organize files by type and date, rename to avoid collisions
   * @param {Object} files - Files object from formidable
   * @param {string} baseDir - Base upload directory
   * @param {Array<string>} allowedTypes - Allowed MIME types
   * @returns {Promise<Object>} - Organized file info
   */
  async organizeFiles(files, baseDir, allowedTypes) {
    const now = new Date();
    const datePath = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;
    const organized = {};
    for (const [field, fileOrArr] of Object.entries(files)) {
      const fileArr = Array.isArray(fileOrArr) ? fileOrArr : [fileOrArr];
      organized[field] = [];
      for (const file of fileArr) {
        if (allowedTypes && !allowedTypes.includes(file.mimetype)) {
          fs.unlinkSync(file.filepath);
          throw new Error(`File type not allowed: ${file.mimetype}`);
        }
        const ext = path.extname(file.originalFilename || file.newFilename || '');
        const typeDir = file.mimetype ? file.mimetype.split('/')[0] : 'other';
        const targetDir = path.join(baseDir, typeDir, datePath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2,10)}${ext}`;
        const targetPath = path.join(targetDir, uniqueName);
        fs.renameSync(file.filepath, targetPath);
        organized[field].push({
          field,
          originalName: file.originalFilename,
          mimetype: file.mimetype,
          size: file.size,
          path: targetPath,
          url: `/uploads/${typeDir}/${datePath}/${uniqueName}`,
        });
      }
    }
    return organized;
  }
}

module.exports = FileHandler; 