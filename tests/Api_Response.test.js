const Api_Response = require('../api_response_folder/Api_Response');

describe('Api_Response', () => {
  let apiResponse;
  let mockRes;

  beforeEach(() => {
    apiResponse = new Api_Response(false, '1.0.0', null, null);
    mockRes = testUtils.createMockResponse();
  });

  describe('Constructor', () => {
    test('should initialize with default values', () => {
      expect(apiResponse.IsDevMode).toBe(false);
      expect(apiResponse.version).toBe('1.0.0');
      expect(apiResponse.encryptionValue).toBe(null);
      expect(apiResponse.logsPath).toBe(null);
      expect(apiResponse.responseId).toBeDefined();
      expect(apiResponse.startTime).toBeDefined();
    });

    test('should initialize with custom values', () => {
      const customApiResponse = new Api_Response(true, '2.0.0', 'secret-key', './logs/error.log');
      
      expect(customApiResponse.IsDevMode).toBe(true);
      expect(customApiResponse.version).toBe('2.0.0');
      expect(customApiResponse.encryptionValue).toBe('secret-key');
      expect(customApiResponse.logsPath).toBe('./logs/error.log');
    });
  });

  describe('Success Responses', () => {
    test('should create success response for GET operation', () => {
      const data = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
      const response = apiResponse.success('get', data);
      
      expect(response.body.data).toEqual(data);
      expect(response.body.count).toBe(2);
      expect(response.body.type).toBe('ok');
      expect(response.body.method).toBe('GET');
      expect(response.statusCode).toBe(200);
      expect(response.headers['X-Response-Type']).toBe('ok');
      expect(response.headers['X-Response-Method']).toBe('GET');
    });

    test('should create success response for POST operation', () => {
      const data = { id: 1, name: 'John Doe' };
      const response = apiResponse.success('post', data);
      
      expect(response.body.data).toEqual(data);
      expect(response.body.created).toBe(true);
      expect(response.body.type).toBe('ok');
      expect(response.body.method).toBe('POST');
      expect(response.statusCode).toBe(201);
    });

    test('should create success response for PUT operation', () => {
      const data = { id: 1, name: 'Updated Name' };
      const response = apiResponse.success('put', data);
      
      expect(response.body.data).toEqual(data);
      expect(response.body.updated).toBe(true);
      expect(response.body.type).toBe('ok');
      expect(response.body.method).toBe('PUT');
      expect(response.statusCode).toBe(200);
    });

    test('should create success response for DELETE operation', () => {
      const data = { id: 1, name: 'Deleted User' };
      const response = apiResponse.success('delete', data);
      
      expect(response.body.data).toEqual(data);
      expect(response.body.deleted).toBe(true);
      expect(response.body.type).toBe('ok');
      expect(response.body.method).toBe('DELETE');
      expect(response.statusCode).toBe(204);
    });

    test('should handle array data for React Admin compatibility', () => {
      const data = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
      const response = apiResponse.success('get', data);
      
      expect(response.body.data).toEqual(data);
      expect(response.body.count).toBe(2);
      expect(response.headers['X-Response-Type']).toBe('ok');
    });
  });

  describe('Error Responses', () => {
    test('should create error response', () => {
      const response = apiResponse.error('get', null, 'Not found', 404);
      
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Not found');
      expect(response.statusCode).toBe(404);
      expect(response.headers['X-Response-Type']).toBe('error');
      expect(response.headers['X-Response-Method']).toBe('ERROR');
    });

    test('should create error response with data', () => {
      const errorData = { field: 'email', issue: 'Invalid format' };
      const response = apiResponse.error('post', errorData, 'Validation failed', 400);
      
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.data).toEqual(errorData);
      expect(response.statusCode).toBe(400);
    });

    test('should use default error message and status code', () => {
      const response = apiResponse.error('get');
      
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBeDefined();
      expect(response.statusCode).toBeDefined();
    });
  });

  describe('Info Responses', () => {
    test('should create info response', () => {
      const response = apiResponse.info('get', { message: 'Processing' }, 'Info message');
      
      expect(response.body.data).toEqual({ message: 'Processing' });
      expect(response.body.type).toBe('info');
      expect(response.body.method).toBe('GET');
      expect(response.headers['X-Response-Type']).toBe('info');
    });
  });

  describe('Warning Responses', () => {
    test('should create warning response', () => {
      const response = apiResponse.warning('put', { field: 'name' }, 'Warning message');
      
      expect(response.body.data).toEqual({ field: 'name' });
      expect(response.body.type).toBe('warning');
      expect(response.body.method).toBe('PUT');
      expect(response.headers['X-Response-Type']).toBe('warning');
    });
  });

  describe('Response Headers', () => {
    test('should set response headers correctly', () => {
      const response = apiResponse.success('get', { id: 1, name: 'John' });
      apiResponse.setResponseHeaders(mockRes, response);
      
      expect(mockRes.set).toHaveBeenCalledWith('X-Response-Type', 'ok');
      expect(mockRes.set).toHaveBeenCalledWith('X-Response-Method', 'GET');
      expect(mockRes.set).toHaveBeenCalledWith('X-API-Version', '1.0.0');
      expect(mockRes.set).toHaveBeenCalledWith('X-Environment', 'production');
    });

    test('should set ID header when data has id', () => {
      const response = apiResponse.success('get', { id: 1, name: 'John' });
      apiResponse.setResponseHeaders(mockRes, response);
      
      expect(mockRes.set).toHaveBeenCalledWith('X-Resource-ID', '1');
    });

    test('should set multiple ID headers for array data', () => {
      const response = apiResponse.success('get', [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ]);
      apiResponse.setResponseHeaders(mockRes, response);
      
      expect(mockRes.set).toHaveBeenCalledWith('X-Resource-IDs', '1,2');
    });

    test('should not set ID header when no id in data', () => {
      const response = apiResponse.success('get', { name: 'John' });
      apiResponse.setResponseHeaders(mockRes, response);
      
      expect(mockRes.set).not.toHaveBeenCalledWith('X-Resource-ID', expect.any(String));
    });
  });

  describe('Development Mode', () => {
    test('should include additional info in dev mode', () => {
      const devApiResponse = new Api_Response(true, '1.0.0', null, null);
      const response = devApiResponse.success('get', { id: 1, name: 'John' });
      
      expect(response.headers['X-Environment']).toBe('development');
      expect(response.headers['X-Response-Time']).toBeDefined();
      expect(response.headers['X-Message']).toBeDefined();
    });
  });

  describe('Encryption', () => {
    test('should handle encrypted responses', () => {
      const encryptedApiResponse = new Api_Response(false, '1.0.0', 'secret-key', null);
      const response = encryptedApiResponse.success('get', { id: 1, name: 'John' });
      
      expect(response.headers['X-Encrypted']).toBe('true');
      expect(typeof response.body).toBe('string'); // Base64 encoded
    });
  });

  describe('React Admin Compatibility', () => {
    test('should format list responses for React Admin', () => {
      const users = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      const response = apiResponse.success('get', users);
      
      expect(response.body.data).toEqual(users);
      expect(response.body.count).toBe(2);
      expect(response.headers['X-Response-Type']).toBe('ok');
      expect(response.headers['X-Response-Method']).toBe('GET');
    });

    test('should format single item responses for React Admin', () => {
      const user = { id: 1, name: 'John' };
      const response = apiResponse.success('get', user);
      
      expect(response.body.data).toEqual(user);
      expect(response.body.count).toBe(1);
      expect(response.headers['X-Resource-ID']).toBe('1');
    });

    test('should format error responses for React Admin', () => {
      const response = apiResponse.error('post', null, 'Validation failed', 400);
      
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Validation failed');
      expect(response.statusCode).toBe(400);
      expect(response.headers['X-Response-Type']).toBe('error');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null data', () => {
      const response = apiResponse.success('get', null);
      expect(response.body.data).toBeNull();
      expect(response.body.count).toBe(0);
    });

    test('should handle undefined data', () => {
      const response = apiResponse.success('get', undefined);
      expect(response.body.data).toBeUndefined();
      expect(response.body.count).toBe(0);
    });

    test('should handle empty object data', () => {
      const response = apiResponse.success('get', {});
      expect(response.body.data).toEqual({});
      expect(response.body.count).toBe(1);
    });

    test('should handle empty array data', () => {
      const response = apiResponse.success('get', []);
      expect(response.body.data).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    test('should handle data with non-numeric id', () => {
      const response = apiResponse.success('get', { id: 'abc123', name: 'John' });
      apiResponse.setResponseHeaders(mockRes, response);
      
      expect(mockRes.set).toHaveBeenCalledWith('X-Resource-ID', 'abc123');
    });
  });
}); 