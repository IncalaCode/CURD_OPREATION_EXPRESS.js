const FileHandler = require('../Curd_op/FileHandler');
const path = require('path');
const fs = require('fs-extra');

// Mock fs-extra
jest.mock('fs-extra');

describe('FileHandler', () => {
  let fileHandler;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    fileHandler = new FileHandler({
      uploadDir: './test-uploads', // Use relative path for tests
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
      organizeByDate: true,
      createThumbnails: false,
      strictMode: true
    });

    mockReq = {
      files: {},
      body: {},
      headers: {}
    };

    mockRes = testUtils.createMockResponse();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const defaultHandler = new FileHandler();
      
      expect(defaultHandler.options.uploadDir).toBe('./uploads');
      expect(defaultHandler.options.maxFileSize).toBe(10 * 1024 * 1024);
      expect(defaultHandler.options.allowedTypes).toEqual(['image/*', 'application/pdf']);
      expect(defaultHandler.options.organizeByDate).toBe(true);
      expect(defaultHandler.options.createThumbnails).toBe(false);
      expect(defaultHandler.options.strictMode).toBe(true);
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        uploadDir: './custom/uploads',
        maxFileSize: 2 * 1024 * 1024,
        allowedTypes: ['image/jpeg'],
        organizeByDate: false,
        createThumbnails: true,
        strictMode: false
      };

      const customHandler = new FileHandler(customOptions);
      
      expect(customHandler.options.uploadDir).toBe('./custom/uploads');
      expect(customHandler.options.maxFileSize).toBe(2 * 1024 * 1024);
      expect(customHandler.options.allowedTypes).toEqual(['image/jpeg']);
      expect(customHandler.options.organizeByDate).toBe(false);
      expect(customHandler.options.createThumbnails).toBe(true);
      expect(customHandler.options.strictMode).toBe(false);
    });
  });

  describe('File Upload', () => {
    test('should handle single file upload', async () => {
      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].originalName).toBe('test.jpg');
      expect(result.files[0].mimeType).toBe('image/jpeg');
    });

    test('should handle multiple file uploads', async () => {
      const mockFiles = [
        {
          filepath: '/tmp/test1.jpg',
          originalFilename: 'test1.jpg',
          mimetype: 'image/jpeg',
          size: 1024
        },
        {
          filepath: '/tmp/test2.png',
          originalFilename: 'test2.png',
          mimetype: 'image/png',
          size: 2048
        }
      ];

      mockReq.files = { files: mockFiles };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files[0].originalName).toBe('test1.jpg');
      expect(result.files[1].originalName).toBe('test2.png');
    });

    test('should handle no files uploaded', async () => {
      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(0);
      expect(result.message).toBe('No files uploaded');
    });
  });

  describe('File Validation', () => {
    test('should validate file size', async () => {
      const mockFile = {
        filepath: '/tmp/large.jpg',
        originalFilename: 'large.jpg',
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024 // 10MB, exceeds 5MB limit
      };

      mockReq.files = { file: mockFile };

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File size exceeds limit');
    });

    test('should validate file type', async () => {
      const mockFile = {
        filepath: '/tmp/test.txt',
        originalFilename: 'test.txt',
        mimetype: 'text/plain',
        size: 1024
      };

      mockReq.files = { file: mockFile };

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File type not allowed');
    });

    test('should validate file extension in strict mode', async () => {
      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
    });

    test('should handle mismatched extension and mime type in strict mode', async () => {
      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'application/pdf', // Mismatched
        size: 1024
      };

      mockReq.files = { file: mockFile };

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File extension does not match MIME type');
    });
  });

  describe('File Organization', () => {
    test('should organize files by date', async () => {
      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files[0].path).toMatch(/\/test-uploads\/\d{4}-\d{2}-\d{2}\//);
    });

    test('should organize files by type', async () => {
      fileHandler.options.organizeByType = true;
      fileHandler.options.organizeByDate = false;

      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files[0].path).toMatch(/\/test-uploads\/image\//);
    });

    test('should organize files by both date and type', async () => {
      fileHandler.options.organizeByType = true;
      fileHandler.options.organizeByDate = true;

      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files[0].path).toMatch(/\/test-uploads\/\d{4}-\d{2}-\d{2}\/image\//);
    });
  });

  describe('File Naming', () => {
    test('should generate unique filenames', async () => {
      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files[0].filename).toMatch(/^\d+_[\w-]+\.jpg$/);
    });

    test('should preserve original filename when configured', async () => {
      fileHandler.options.preserveOriginalName = true;

      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files[0].filename).toBe('test.jpg');
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors', async () => {
      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockRejectedValue(new Error('Permission denied'));

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to process file');
    });

    test('should handle invalid file objects', async () => {
      const mockFile = {
        filepath: '/tmp/test.jpg',
        // Missing required properties
      };

      mockReq.files = { file: mockFile };

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file object');
    });
  });

  describe('Integration with PrismaCrudRouter', () => {
    test('should integrate with router middleware', () => {
      const middleware = fileHandler.getMiddleware();
      
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // Express middleware signature
    });

    test('should handle file upload in router context', async () => {
      const mockFile = {
        filepath: '/tmp/test.jpg',
        originalFilename: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const middleware = fileHandler.getMiddleware();
      await middleware(mockReq, mockRes, () => {});

      expect(mockReq.uploadedFiles).toBeDefined();
      expect(mockReq.uploadedFiles.success).toBe(true);
    });
  });

  describe('File Management', () => {
    test('should delete uploaded files', async () => {
      const filePath = './test-uploads/test.jpg';
      fs.remove.mockResolvedValue();

      const result = await fileHandler.deleteFile(filePath);

      expect(result.success).toBe(true);
      expect(fs.remove).toHaveBeenCalledWith(filePath);
    });

    test('should handle file deletion errors', async () => {
      const filePath = './test-uploads/nonexistent.jpg';
      fs.remove.mockRejectedValue(new Error('File not found'));

      const result = await fileHandler.deleteFile(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to delete file');
    });

    test('should get file info', async () => {
      const filePath = './test-uploads/test.jpg';
      const mockStats = {
        size: 1024,
        birthtime: new Date(),
        mtime: new Date()
      };

      fs.stat.mockResolvedValue(mockStats);

      const result = await fileHandler.getFileInfo(filePath);

      expect(result.success).toBe(true);
      expect(result.info.size).toBe(1024);
    });
  });

  describe('Configuration', () => {
    test('should update configuration', () => {
      const newConfig = {
        maxFileSize: 1 * 1024 * 1024,
        allowedTypes: ['image/jpeg']
      };

      fileHandler.updateConfig(newConfig);

      expect(fileHandler.options.maxFileSize).toBe(1 * 1024 * 1024);
      expect(fileHandler.options.allowedTypes).toEqual(['image/jpeg']);
    });

    test('should validate configuration', () => {
      const invalidConfig = {
        maxFileSize: -1,
        allowedTypes: []
      };

      expect(() => {
        fileHandler.updateConfig(invalidConfig);
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle files with special characters in names', async () => {
      const mockFile = {
        filepath: '/tmp/test file (1).jpg',
        originalFilename: 'test file (1).jpg',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files[0].originalName).toBe('test file (1).jpg');
    });

    test('should handle very large file names', async () => {
      const longName = 'a'.repeat(300) + '.jpg';
      const mockFile = {
        filepath: `/tmp/${longName}`,
        originalFilename: longName,
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files[0].filename.length).toBeLessThan(255);
    });

    test('should handle files without extensions', async () => {
      const mockFile = {
        filepath: '/tmp/test',
        originalFilename: 'test',
        mimetype: 'image/jpeg',
        size: 1024
      };

      mockReq.files = { file: mockFile };
      fs.ensureDir.mockResolvedValue();
      fs.move.mockResolvedValue();

      const result = await fileHandler.handleUpload(mockReq, mockRes);

      expect(result.success).toBe(true);
      expect(result.files[0].filename).toMatch(/\.jpg$/);
    });
  });
}); 