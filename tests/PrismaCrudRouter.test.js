const PrismaCrudRouter = require('../index');
const Api_Response = require('../api_response_folder/Api_Response');

// Mock dependencies
jest.mock('../api_response_folder/Api_Response');
jest.mock('../Curd_op/DatabaseAnalyzer');
jest.mock('../Curd_op/PrismaError');

describe('PrismaCrudRouter', () => {
  let router;
  let mockApp;
  let mockModel;
  let mockReq;
  let mockRes;
  let mockApiResponse;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Express app
    mockApp = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn()
    };

    // Mock Prisma model
    mockModel = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    };

    // Mock request and response
    mockReq = {
      params: {},
      query: {},
      body: {},
      headers: {}
    };

    mockRes = testUtils.createMockResponse();

    // Mock API response
    mockApiResponse = {
      success: jest.fn(),
      error: jest.fn(),
      setResponseHeaders: jest.fn()
    };

    Api_Response.mockImplementation(() => mockApiResponse);

    // Create router instance
    router = new PrismaCrudRouter(mockApp, { user: mockModel }, false, {
      version: '1.0.0'
    });
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      expect(router.app).toBe(mockApp);
      expect(router.models).toEqual({ user: mockModel });
      expect(router.isDev).toBe(false);
      expect(router.options.version).toBe('1.0.0');
      expect(router.options.enableRelationAnalysis).toBe(true);
      expect(router.options.enableConstraintChecking).toBe(true);
      expect(router.options.enableCascadeHandling).toBe(true);
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        version: '2.0.0',
        enableRelationAnalysis: false,
        enableConstraintChecking: false,
        enableCascadeHandling: false,
        defaultMiddleware: [jest.fn()],
        plugins: [jest.fn()]
      };

      const customRouter = new PrismaCrudRouter(mockApp, { user: mockModel }, true, customOptions);

      expect(customRouter.isDev).toBe(true);
      expect(customRouter.options.version).toBe('2.0.0');
      expect(customRouter.options.enableRelationAnalysis).toBe(false);
      expect(customRouter.options.enableConstraintChecking).toBe(false);
      expect(customRouter.options.enableCascadeHandling).toBe(false);
      expect(customRouter.options.defaultMiddleware).toHaveLength(1);
      expect(customRouter.options.plugins).toHaveLength(1);
    });
  });

  describe('Plugin System', () => {
    test('should register function plugins', () => {
      const plugin = jest.fn();
      router.addPlugin(plugin);

      expect(plugin).toHaveBeenCalledWith(router);
      expect(router.options.plugins).toContain(plugin);
    });

    test('should register object plugins', () => {
      const plugin = {
        register: jest.fn()
      };
      router.addPlugin(plugin);

      expect(plugin.register).toHaveBeenCalledWith(router);
      expect(router.options.plugins).toContain(plugin);
    });
  });

  describe('Route Creation', () => {
    test('should create CRUD routes', () => {
      router.route('/users', mockModel);

      expect(mockApp.get).toHaveBeenCalledWith('/users', expect.any(Function));
      expect(mockApp.get).toHaveBeenCalledWith('/users/:id', expect.any(Function));
      expect(mockApp.post).toHaveBeenCalledWith('/users', expect.any(Function));
      expect(mockApp.put).toHaveBeenCalledWith('/users/:id', expect.any(Function));
      expect(mockApp.delete).toHaveBeenCalledWith('/users/:id', expect.any(Function));
    });

    test('should apply middleware', () => {
      const middleware = jest.fn();
      const authMiddleware = jest.fn();

      router.route('/users', mockModel, {
        middleware: [middleware],
        authMiddleware: authMiddleware
      });

      // Check that middleware is applied to all routes
      const getCall = mockApp.get.mock.calls.find(call => call[0] === '/users');
      expect(getCall[1]).toBe(middleware);
      expect(getCall[2]).toBe(authMiddleware);
    });
  });

  describe('Error Handling', () => {
    test('should handle Prisma errors', () => {
      const error = { code: 'P2025', message: 'Record not found' };
      const result = router.handleError(error, 'get');

      expect(mockApiResponse.error).toHaveBeenCalledWith('get', null, expect.any(String), expect.any(Number));
    });

    test('should handle custom error handler', () => {
      const customHandler = jest.fn().mockReturnValue({
        body: { success: false, error: 'Custom error' },
        headers: {},
        statusCode: 400
      });

      const error = new Error('Test error');
      const result = router.handleError(error, 'post', customHandler);

      expect(customHandler).toHaveBeenCalledWith(error, 'post', mockApiResponse);
    });
  });

  describe('Utility Methods', () => {
    test('should add global middleware', () => {
      const middleware = jest.fn();
      router.addGlobalMiddleware(middleware);

      expect(router.options.defaultMiddleware).toContain(middleware);
    });

    test('should get API response instance', () => {
      const apiResponse = router.getApiResponse();
      expect(apiResponse).toBe(mockApiResponse);
    });

    test('should get model name', () => {
      const modelName = router.getModelName(mockModel);
      expect(modelName).toBe('MockConstructor');
    });
  });

  describe('Multi-table Operations', () => {
    test('should detect single relations', () => {
      const data = {
        name: 'John Doe',
        profile: {
          bio: 'Software developer',
          location: 'New York'
        }
      };

      // Test the auto-detection logic
      const singleRelations = {};
      const bulkRelations = {};

      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'object' || value === null || 
            ['id', 'createdAt', 'updatedAt', 'uploadedFiles'].includes(key)) {
          continue;
        }

        if (Array.isArray(value)) {
          bulkRelations[key] = value;
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          singleRelations[key] = value;
        }
      }

      expect(singleRelations).toEqual({ profile: { bio: 'Software developer', location: 'New York' } });
      expect(bulkRelations).toEqual({});
    });

    test('should detect bulk relations', () => {
      const data = {
        name: 'John Doe',
        posts: [
          { title: 'Post 1', content: 'Content 1' },
          { title: 'Post 2', content: 'Content 2' }
        ]
      };

      const singleRelations = {};
      const bulkRelations = {};

      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'object' || value === null || 
            ['id', 'createdAt', 'updatedAt', 'uploadedFiles'].includes(key)) {
          continue;
        }

        if (Array.isArray(value)) {
          bulkRelations[key] = value;
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          singleRelations[key] = value;
        }
      }

      expect(singleRelations).toEqual({});
      expect(bulkRelations).toEqual({
        posts: [
          { title: 'Post 1', content: 'Content 1' },
          { title: 'Post 2', content: 'Content 2' }
        ]
      });
    });
  });

  describe('Configuration', () => {
    test('should handle different configuration options', () => {
      const options = {
        version: '2.0.0',
        encryptionValue: 'secret-key',
        logsPath: './logs',
        enableRelationAnalysis: false,
        enableConstraintChecking: false,
        enableCascadeHandling: false
      };

      const customRouter = new PrismaCrudRouter(mockApp, { user: mockModel }, true, options);

      expect(customRouter.options.version).toBe('2.0.0');
      expect(customRouter.options.encryptionValue).toBe('secret-key');
      expect(customRouter.options.logsPath).toBe('./logs');
      expect(customRouter.options.enableRelationAnalysis).toBe(false);
      expect(customRouter.options.enableConstraintChecking).toBe(false);
      expect(customRouter.options.enableCascadeHandling).toBe(false);
    });
  });
}); 