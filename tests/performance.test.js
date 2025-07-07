const express = require('express');
const request = require('supertest');
const PrismaCrudRouter = require('../index');

describe('Performance Tests', () => {
  let app;
  let router;
  let mockPrismaClient;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockPrismaClient = {
      $transaction: jest.fn(),
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      }
    };

    router = new PrismaCrudRouter(app, mockPrismaClient, false, {
      version: '1.0.0',
      defaultMiddleware: [],
      plugins: []
    });
  });

  describe('Concurrent Requests', () => {
    test('should handle multiple concurrent GET requests', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      const users = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`
      }));

      userModel.findMany.mockResolvedValue(users);
      userModel.count.mockResolvedValue(100);

      const startTime = Date.now();
      const concurrentRequests = 50;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get('/users')
            .expect(200)
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(100);
      });

      // Performance check: should handle 50 concurrent requests in reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds
      expect(userModel.findMany).toHaveBeenCalledTimes(concurrentRequests);
    });

    test('should handle concurrent POST requests', async () => {
      const userModel = {
        create: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      const startTime = Date.now();
      const concurrentRequests = 20;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const userData = {
          name: `User ${i + 1}`,
          email: `user${i + 1}@example.com`
        };

        userModel.create.mockResolvedValueOnce({
          id: i + 1,
          ...userData
        });

        promises.push(
          request(app)
            .post('/users')
            .send(userData)
            .expect(201)
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(index + 1);
      });

      // Performance check
      expect(totalTime).toBeLessThan(3000); // 3 seconds
      expect(userModel.create).toHaveBeenCalledTimes(concurrentRequests);
    });
  });

  describe('Large Dataset Handling', () => {
    test('should handle large result sets efficiently', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      // Generate large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      userModel.findMany.mockResolvedValue(largeDataset);
      userModel.count.mockResolvedValue(10000);

      const startTime = Date.now();

      const response = await request(app)
        .get('/users')
        .query({ limit: '10000' })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10000);
      expect(response.body.count).toBe(10000);

      // Should handle large datasets in reasonable time
      expect(responseTime).toBeLessThan(2000); // 2 seconds
    });

    test('should handle pagination efficiently', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      const pageSize = 100;
      const totalRecords = 10000;
      const pageData = Array.from({ length: pageSize }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`
      }));

      userModel.findMany.mockResolvedValue(pageData);
      userModel.count.mockResolvedValue(totalRecords);

      const startTime = Date.now();

      const response = await request(app)
        .get('/users')
        .query({
          limit: pageSize.toString(),
          offset: '0'
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(pageSize);
      expect(response.body.count).toBe(totalRecords);

      // Pagination should be very fast
      expect(responseTime).toBeLessThan(500); // 500ms
    });
  });

  describe('Memory Usage', () => {
    test('should not leak memory with repeated requests', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      const users = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`
      }));

      userModel.findMany.mockResolvedValue(users);
      userModel.count.mockResolvedValue(100);

      const initialMemory = process.memoryUsage().heapUsed;
      const requests = 1000;

      for (let i = 0; i < requests; i++) {
        await request(app)
          .get('/users')
          .expect(200);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Database Query Optimization', () => {
    test('should optimize queries with proper includes', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel, { includeRelations: true });

      const usersWithRelations = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        profile: {
          id: i + 1,
          bio: `Bio for user ${i + 1}`,
          location: 'New York'
        },
        posts: Array.from({ length: 5 }, (_, j) => ({
          id: (i * 5) + j + 1,
          title: `Post ${j + 1} by User ${i + 1}`,
          content: `Content for post ${j + 1}`
        }))
      }));

      userModel.findMany.mockResolvedValue(usersWithRelations);
      userModel.count.mockResolvedValue(100);

      const startTime = Date.now();

      const response = await request(app)
        .get('/users')
        .query({
          include: JSON.stringify({
            profile: true,
            posts: true
          })
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(100);
      expect(response.body.data[0].profile).toBeDefined();
      expect(response.body.data[0].posts).toHaveLength(5);

      // Should handle complex queries efficiently
      expect(responseTime).toBeLessThan(3000); // 3 seconds
    });
  });

  describe('Error Handling Performance', () => {
    test('should handle errors efficiently', async () => {
      const userModel = {
        findUnique: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      userModel.findUnique.mockResolvedValue(null);

      const startTime = Date.now();
      const errorRequests = 100;

      for (let i = 0; i < errorRequests; i++) {
        await request(app)
          .get('/users/999')
          .expect(500);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Error handling should be fast
      expect(totalTime).toBeLessThan(2000); // 2 seconds
    });
  });

  describe('Middleware Performance', () => {
    test('should handle middleware efficiently', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      const middleware = (req, res, next) => {
        req.processed = true;
        next();
      };

      router.route('/users', userModel, {
        middleware: [middleware]
      });

      const users = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`
      }));

      userModel.findMany.mockResolvedValue(users);
      userModel.count.mockResolvedValue(100);

      const startTime = Date.now();
      const requests = 500;

      for (let i = 0; i < requests; i++) {
        await request(app)
          .get('/users')
          .expect(200);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Middleware should not significantly impact performance
      expect(totalTime).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Transaction Performance', () => {
    test('should handle transactions efficiently', async () => {
      const userModel = {
        create: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 1,
              name: 'John Doe',
              profile: { id: 1, bio: 'Developer' },
              posts: [{ id: 1, title: 'Post 1' }]
            })
          }
        };
        return await callback(tx);
      });

      const startTime = Date.now();
      const requests = 50;

      for (let i = 0; i < requests; i++) {
        await request(app)
          .post('/users')
          .send({
            name: 'John Doe',
            profile: { bio: 'Developer' },
            posts: [{ title: 'Post 1' }]
          })
          .expect(201);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Transactions should be reasonably fast
      expect(totalTime).toBeLessThan(3000); // 3 seconds
      expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(requests);
    });
  });

  describe('Response Size Optimization', () => {
    test('should handle large response payloads efficiently', async () => {
      const userModel = {
        findMany: jest.fn(),
        count: jest.fn(),
        constructor: { name: 'User' }
      };

      router.route('/users', userModel);

      // Create large payload with nested objects
      const largePayload = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        metadata: {
          preferences: {
            theme: 'dark',
            language: 'en',
            notifications: {
              email: true,
              push: false,
              sms: true
            }
          },
          settings: {
            privacy: 'public',
            visibility: 'visible',
            permissions: ['read', 'write', 'delete']
          }
        },
        statistics: {
          posts: Math.floor(Math.random() * 100),
          comments: Math.floor(Math.random() * 500),
          likes: Math.floor(Math.random() * 1000)
        }
      }));

      userModel.findMany.mockResolvedValue(largePayload);
      userModel.count.mockResolvedValue(1000);

      const startTime = Date.now();

      const response = await request(app)
        .get('/users')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1000);

      // Should handle large payloads efficiently
      expect(responseTime).toBeLessThan(3000); // 3 seconds

      // Check response size
      const responseSize = JSON.stringify(response.body).length;
      expect(responseSize).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });
  });
}); 