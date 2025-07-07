const express = require('express');
const request = require('supertest');
const PrismaCrudRouter = require('../index');
const FileHandler = require('../Curd_op/FileHandler');

// Mock Prisma client
const mockPrismaClient = {
  $transaction: jest.fn(),
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  post: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  profile: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

// Mock FileHandler
jest.mock('../Curd_op/FileHandler', () => {
  return jest.fn().mockImplementation(() => ({
    handleUpload: jest.fn().mockResolvedValue({
      success: true,
      files: [
        {
          filename: 'test.jpg',
          originalName: 'test.jpg',
          path: '/uploads/test.jpg',
          mimeType: 'image/jpeg',
          size: 1024
        }
      ]
    }),
    getMiddleware: jest.fn().mockReturnValue((req, res, next) => {
      req.uploadedFiles = {
        success: true,
        files: [
          {
            filename: 'test.jpg',
            originalName: 'test.jpg',
            path: '/uploads/test.jpg',
            mimeType: 'image/jpeg',
            size: 1024
          }
        ]
      };
      next();
    }),
    deleteFile: jest.fn().mockResolvedValue({ success: true }),
    getFileInfo: jest.fn().mockResolvedValue({
      success: true,
      info: { size: 1024, created: new Date() }
    })
  }));
});

describe('Integration Tests', () => {
  let app;
  let router;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    router = new PrismaCrudRouter(app, mockPrismaClient, true, {
      version: '1.0.0',
      defaultMiddleware: [],
      plugins: []
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Complete CRUD Flow', () => {
    test('should handle complete user CRUD operations', async () => {
      const userModel = {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      // Setup route
      router.route('/users', userModel);

      // Test GET all users
      const users = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
      ];

      userModel.findMany.mockResolvedValue(users);
      userModel.count.mockResolvedValue(2);

      const getResponse = await request(app)
        .get('/users')
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data).toEqual(users);
      expect(getResponse.body.count).toBe(2);
      expect(getResponse.headers['x-response-type']).toBe('success');
      expect(getResponse.headers['x-method']).toBe('GET');

      // Test GET single user
      const user = { id: 1, name: 'John Doe', email: 'john@example.com' };
      userModel.findUnique.mockResolvedValue(user);

      const getSingleResponse = await request(app)
        .get('/users/1')
        .expect(200);

      expect(getSingleResponse.body.success).toBe(true);
      expect(getSingleResponse.body.data).toEqual(user);
      expect(getSingleResponse.headers['x-resource-id']).toBe('1');

      // Test POST create user
      const newUser = { id: 3, name: 'Bob Wilson', email: 'bob@example.com' };
      userModel.create.mockResolvedValue(newUser);

      const postResponse = await request(app)
        .post('/users')
        .send({ name: 'Bob Wilson', email: 'bob@example.com' })
        .expect(201);

      expect(postResponse.body.success).toBe(true);
      expect(postResponse.body.data).toEqual(newUser);
      expect(postResponse.headers['x-method']).toBe('POST');

      // Test PUT update user
      const updatedUser = { id: 1, name: 'John Updated', email: 'john@example.com' };
      userModel.update.mockResolvedValue(updatedUser);

      const putResponse = await request(app)
        .put('/users/1')
        .send({ name: 'John Updated' })
        .expect(200);

      expect(putResponse.body.success).toBe(true);
      expect(putResponse.body.data).toEqual(updatedUser);
      expect(putResponse.headers['x-method']).toBe('PUT');

      // Test DELETE user
      const deletedUser = { id: 1, name: 'John Updated', email: 'john@example.com' };
      userModel.delete.mockResolvedValue(deletedUser);

      const deleteResponse = await request(app)
        .delete('/users/1')
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.data).toEqual(deletedUser);
      expect(deleteResponse.headers['x-method']).toBe('DELETE');
    });

    test('should handle errors gracefully', async () => {
      const userModel = {
        findUnique: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      // Test 404 error
      userModel.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/users/999')
        .expect(500); // Will be handled by error handler

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('File Upload Integration', () => {
    test('should handle file upload with user creation', async () => {
      const userModel = {
        create: jest.fn(),
        constructor: { name: 'User' }
      };

      const fileHandler = new FileHandler();
      const fileMiddleware = fileHandler.getMiddleware();

      router.route('/users', userModel, {
        middleware: [fileMiddleware]
      });

      const newUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        uploadedFiles: ['/uploads/test.jpg']
      };

      userModel.create.mockResolvedValue(newUser);

      const response = await request(app)
        .post('/users')
        .field('name', 'John Doe')
        .field('email', 'john@example.com')
        .attach('file', Buffer.from('test'), 'test.jpg')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(newUser);
    });
  });

  describe('Multi-table Operations', () => {
    test('should handle user creation with profile', async () => {
      const userModel = {
        create: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      const userWithProfile = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        profile: {
          id: 1,
          bio: 'Software Developer',
          location: 'New York'
        }
      };

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(userWithProfile)
          }
        };
        return await callback(tx);
      });

      const response = await request(app)
        .post('/users')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          profile: {
            bio: 'Software Developer',
            location: 'New York'
          }
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(userWithProfile);
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    test('should handle user creation with multiple posts', async () => {
      const userModel = {
        create: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      const userWithPosts = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        posts: [
          { id: 1, title: 'Post 1', content: 'Content 1' },
          { id: 2, title: 'Post 2', content: 'Content 2' }
        ]
      };

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(userWithPosts)
          }
        };
        return await callback(tx);
      });

      const response = await request(app)
        .post('/users')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          posts: [
            { title: 'Post 1', content: 'Content 1' },
            { title: 'Post 2', content: 'Content 2' }
          ]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(userWithPosts);
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });
  });

  describe('Query Parameters', () => {
    test('should handle filtering and pagination', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      const users = [
        { id: 1, name: 'John Doe', email: 'john@example.com' }
      ];

      userModel.findMany.mockResolvedValue(users);
      userModel.count.mockResolvedValue(1);

      const response = await request(app)
        .get('/users')
        .query({
          filter: JSON.stringify({ name: 'John' }),
          limit: '10',
          offset: '0',
          order: JSON.stringify([['name', 'ASC']])
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(userModel.findMany).toHaveBeenCalledWith({
        where: { name: 'John' },
        skip: 0,
        take: 10,
        orderBy: { name: 'asc' },
        include: undefined
      });
    });

    test('should handle include relations', async () => {
      const userModel = {
        findUnique: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel, { includeRelations: true });

      const userWithProfile = {
        id: 1,
        name: 'John Doe',
        profile: { id: 1, bio: 'Developer' }
      };

      userModel.findUnique.mockResolvedValue(userWithProfile);

      const response = await request(app)
        .get('/users/1')
        .query({
          include: JSON.stringify({ profile: true })
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(userWithProfile);
    });
  });

  describe('Middleware and Hooks', () => {
    test('should execute before and after actions', async () => {
      const userModel = {
        create: jest.fn(),
        constructor: { name: 'User' }
      };

      const beforeAction = jest.fn();
      const afterAction = jest.fn();

      router.route('/users', userModel, {
        beforeActions: { create: beforeAction },
        afterActions: { create: afterAction }
      });

      const newUser = { id: 1, name: 'John Doe' };
      userModel.create.mockResolvedValue(newUser);

      await request(app)
        .post('/users')
        .send({ name: 'John Doe' })
        .expect(201);

      expect(beforeAction).toHaveBeenCalledWith({ name: 'John Doe' });
      expect(afterAction).toHaveBeenCalledWith(newUser);
    });

    test('should apply custom middleware', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      const customMiddleware = jest.fn((req, res, next) => {
        req.customData = 'test';
        next();
      });

      router.route('/users', userModel, {
        middleware: [customMiddleware]
      });

      const users = [];
      userModel.findMany.mockResolvedValue(users);
      userModel.count.mockResolvedValue(0);

      await request(app)
        .get('/users')
        .expect(200);

      expect(customMiddleware).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    test('should handle validation errors', async () => {
      const userModel = {
        create: jest.fn(),
        constructor: { name: 'User' }
      };

      const validation = {
        create: jest.fn().mockResolvedValue({
          isValid: false,
          message: 'Email is required'
        })
      };

      router.route('/users', userModel, { validation });

      const response = await request(app)
        .post('/users')
        .send({ name: 'John Doe' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(validation.create).toHaveBeenCalledWith({ name: 'John Doe' });
    });
  });

  describe('Plugin System', () => {
    test('should register and execute plugins', async () => {
      const plugin = jest.fn();
      const pluginRouter = new PrismaCrudRouter(app, mockPrismaClient, false, {
        plugins: [plugin]
      });

      expect(plugin).toHaveBeenCalledWith(pluginRouter);
    });

    test('should add plugins dynamically', async () => {
      const plugin = jest.fn();
      router.addPlugin(plugin);

      expect(plugin).toHaveBeenCalledWith(router);
    });
  });

  describe('Error Handling', () => {
    test('should handle custom error handlers', async () => {
      const userModel = {
        findUnique: jest.fn(),
        constructor: { name: 'User' }
      };

      const customErrorHandler = jest.fn().mockReturnValue({
        body: { success: false, error: 'Custom error message' },
        headers: {},
        statusCode: 400
      });

      router.route('/users', userModel, {
        errorHandler: customErrorHandler
      });

      userModel.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/users/1')
        .expect(400);

      expect(customErrorHandler).toHaveBeenCalled();
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Custom error message');
    });
  });

  describe('React Admin Compatibility', () => {
    test('should format responses for React Admin', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      const users = [
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Smith' }
      ];

      userModel.findMany.mockResolvedValue(users);
      userModel.count.mockResolvedValue(2);

      const response = await request(app)
        .get('/users')
        .expect(200);

      // Check React Admin compatible format
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(users);
      expect(response.body.count).toBe(2);
      
      // Check headers for React Admin
      expect(response.headers['x-response-type']).toBe('success');
      expect(response.headers['x-method']).toBe('GET');
      expect(response.headers['x-api-version']).toBe('1.0.0');
      expect(response.headers['x-resource-ids']).toBe('1,2');
    });

    test('should handle single item responses for React Admin', async () => {
      const userModel = {
        findUnique: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      const user = { id: 1, name: 'John Doe' };
      userModel.findUnique.mockResolvedValue(user);

      const response = await request(app)
        .get('/users/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(user);
      expect(response.headers['x-resource-id']).toBe('1');
    });
  });
}); 