const Api_Response = require('./api_response_folder/Api_Response');
const DatabaseAnalyzer  = require('./Curd_op/DatabaseAnalyzer').DatabaseAnalyzer
const ErrorCode = require('./Curd_op/PrismaError').ErrorCode

class PrismaCrudRouter {
  /**
   * Create a new CRUD router instance
   * @param {Object} app - Express application instance
   * @param {Object} models - Prisma client models object
   * @param {boolean} [isDev=false] - Development mode flag (enables detailed errors)
   * @param {Object} [options] - Configuration options:
   *      - version {string} - API version (default: "1.0.0")
   *      - encryptionValue {string|null} - Encryption key for responses (default: null)
   *      - logsPath {string|null} - Path for error logs (default: null)
   *      - defaultMiddleware {Array<Function>} - Global middleware array (default: [])
   *      - plugins {Array<Function|Object>} - Plugin functions/objects (default: [])
   *      - enableRelationAnalysis {boolean} - Enable relation detection (default: true)
   *      - enableConstraintChecking {boolean} - Enable DB constraint checks (default: true)
   *      - enableCascadeHandling {boolean} - Enable cascade operations (default: true)
   * @example
   * const router = new PrismaCrudRouter(app, prisma, true, {
   *   version: '2.0.0',
   *   defaultMiddleware: [loggerMiddleware]
   * });
   */
  constructor(app, models, isDev = false, options = {}) {
    this.app = app;
    this.models = models;
    this.isDev = isDev;
    this.options = {
      version: options.version || "1.0.0",
      encryptionValue: options.encryptionValue || null,
      logsPath: options.logsPath || null,
      defaultMiddleware: options.defaultMiddleware || [],
      plugins: options.plugins || [],
      enableRelationAnalysis: options.enableRelationAnalysis !== false,
      enableConstraintChecking: options.enableConstraintChecking !== false,
      enableCascadeHandling: options.enableCascadeHandling !== false,
      ...options
    };

    this.apiResponse = new Api_Response(
      this.isDev,
      this.options.version,
      this.options.encryptionValue,
      this.options.logsPath
    );

    this.databaseAnalyzer = new DatabaseAnalyzer();
    this.databaseAnalyzer.models = this.models;
    this.registerPlugins();
  }

  /**
   * Register plugins for customization
   */
  registerPlugins() {
    this.options.plugins.forEach(plugin => {
      if (typeof plugin === 'function') {
        plugin(this);
      } else if (plugin && typeof plugin.register === 'function') {
        plugin.register(this);
      }
    });
  }

  /**
   * Add a plugin to extend router functionality
   * @param {Function|Object} plugin - Plugin can be either:
   *      - A function that receives the router instance
   *      - An object with register() method that receives the router instance
   * @example
   * // Function plugin
   * router.addPlugin((router) => {
   *   router.addGlobalMiddleware(myMiddleware);
   * });
   *
   * // Object plugin
   * router.addPlugin({
   *   register: (router) => {
   *     router.addGlobalMiddleware(myMiddleware);
   *   }
   * });
   */
  addPlugin(plugin) {
    this.options.plugins.push(plugin);
    if (typeof plugin === 'function') {
      plugin(this);
    } else if (plugin && typeof plugin.register === 'function') {
      plugin.register(this);
    }
  }

  /**
   * Create CRUD routes with flexible configuration using custom generator
   * @param {string} routePath - The base route path (e.g. '/users')
   * @param {Object} model - Prisma model instance for CRUD operations
   * @param {Object} routeOptions - Route configuration options which contains:
   *      - middleware {Array<Function>} - Array of Express middleware functions
   *      - authMiddleware {Function} - Authentication middleware function
   *      - validation {Object} - Validation functions:
   *          - create {Function} - Validation for create operations
   *          - update {Function} - Validation for update operations
   *      - beforeActions {Object} - Pre-operation hooks:
   *          - get {Function} - Before GET all
   *          - create {Function} - Before POST
   *          - update {Function} - Before PUT
   *          - destroy {Function} - Before DELETE
   *      - afterActions {Object} - Post-operation hooks (same structure as beforeActions)
   *      - customActions {Object} - Additional route handlers keyed by HTTP method
   *      - errorHandler {Function} - Custom error handler function
   *      - includeRelations {boolean} - Whether to include related models (default: false)
   *      - excludeRelations {Array<string>} - Relation fields to exclude
   *      - enableConstraintChecking {boolean} - Enable database constraint validation (default: true)
   *      - enableCascadeHandling {boolean} - Enable cascade operation handling (default: true)
   *      - enableNestedOperations {boolean} - Enable nested create/update operations (default: false)
   *      - nestedModels {Object} - Configuration for nested operations:
   *          - create {Array<string>} - Relations to create nested (e.g., ['profile', 'posts'])
   *          - update {Array<string>} - Relations to update nested
   *          - delete {Array<string>} - Relations to delete when parent is deleted
   */
  route(routePath, model, routeOptions = {}) {
    const {
      middleware = [],
      authMiddleware = null,
      validation = null,
      beforeActions = {},
      afterActions = {},
      customActions = {},
      errorHandler = null,
      includeRelations = false,
      excludeRelations = [],
      enableConstraintChecking =  routeOptions.enableConstraintChecking ??  this.options.enableConstraintChecking,
      enableCascadeHandling = routeOptions.enableCascadeHandling ?? this.options.enableCascadeHandling,
      enableNestedOperations = routeOptions.enableNestedOperations || false,
      nestedModels = routeOptions.nestedModels || {},
    } = routeOptions;

    const allMiddleware = [...this.options.defaultMiddleware, ...middleware];
    if (authMiddleware) {
      allMiddleware.push(authMiddleware);
    }

    // Helper function to process nested data
    const processNestedData = (data, operation = 'create') => {
      const mainData = { ...data };
      const nestedData = {};

      if (enableNestedOperations && nestedModels[operation]) {
        for (const relation of nestedModels[operation]) {
          if (data[relation]) {
            nestedData[relation] = data[relation];
            delete mainData[relation];
          }
        }
      }

      return { mainData, nestedData };
    };

    // Helper function to create with nested relations
    const createWithNested = async (data) => {
      const { mainData, nestedData } = processNestedData(data, 'create');
      
      if (Object.keys(nestedData).length === 0) {
        return await model.create({ data: mainData });
      }

      // Use transaction for nested operations
      return await this.models.$transaction(async (tx) => {
        const created = await tx[this.getModelName(model).toLowerCase()].create({
          data: {
            ...mainData,
            ...nestedData
          }
        });
        return created;
      });
    };

    // Helper function to update with nested relations
    const updateWithNested = async (id, data) => {
      const { mainData, nestedData } = processNestedData(data, 'update');
      
      if (Object.keys(nestedData).length === 0) {
        return await model.update({ where: { id: Number(id) }, data: mainData });
      }

      // Use transaction for nested operations
      return await this.models.$transaction(async (tx) => {
        const updated = await tx[this.getModelName(model).toLowerCase()].update({
          where: { id: Number(id) },
          data: {
            ...mainData,
            ...nestedData
          }
        });
        return updated;
      });
    };

    // Register CRUD routes directly on the Express app
    // GET /: get all
    this.app.get(routePath, ...allMiddleware, async (req, res) => {
      try {
        if (beforeActions.get) {
          await beforeActions.get(req.query);
        }
        const filter = req.query.filter ? JSON.parse(req.query.filter) : {};
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        const offset = req.query.offset ? parseInt(req.query.offset) : 0;
        const order = req.query.order ? JSON.parse(req.query.order) : [];
        const include = req.query.include ? JSON.parse(req.query.include) : {};

        const structure = await this.databaseAnalyzer.analyzeDatabaseStructure(model);
        let includeObject = {};
        if (includeRelations && structure && structure.hasRelations) {
          for (const fk of structure.foreignKeys) {
            if (!excludeRelations.includes(fk.field)) {
              includeObject[fk.field] = true;
            }
          }
        }
        includeObject = { ...includeObject, ...include };
        const orderBy = order.length ? { [order[0][0]]: order[0][1].toLowerCase() } : undefined;
        const [rows, count] = await Promise.all([
          model.findMany({
            where: filter,
            skip: offset,
            take: limit,
            orderBy,
            include: Object.keys(includeObject).length > 0 ? includeObject : undefined,
          }),
          model.count({ where: filter }),
        ]);
        if (afterActions.get) {
          await afterActions.get({ rows, count });
        }
        res.json(this.apiResponse.success('get', { data: rows, count }));
      } catch (error) {
        const errResp = this.handleError(error, 'get', errorHandler);
        res.status(errResp.status || 500).json(errResp);
      }
    });

    // GET /:id: get by id
    this.app.get(`${routePath}/:id`, ...allMiddleware, async (req, res) => {
      try {
        const id = req.params.id;
        const include = req.query.include ? JSON.parse(req.query.include) : {};
        const structure = await this.databaseAnalyzer.analyzeDatabaseStructure(model);
        let includeObject = {};
        if (includeRelations && structure && structure.hasRelations) {
          for (const fk of structure.foreignKeys) {
            if (!excludeRelations.includes(fk.field)) {
              includeObject[fk.field] = true;
            }
          }
        }
        includeObject = { ...includeObject, ...include };
        const row = await model.findUnique({
          where: { id: Number(id) },
          include: Object.keys(includeObject).length > 0 ? includeObject : undefined,
        });
        if (!row) throw { code: 'P2025', message: 'Record not found' };
        res.json(this.apiResponse.success('get', row));
      } catch (error) {
        const errResp = this.handleError(error, 'get', errorHandler);
        res.status(errResp.status || 500).json(errResp);
      }
    });

    // POST /: create
    this.app.post(routePath, ...allMiddleware, async (req, res) => {
      try {
        const data = req.body;
        if (!data || typeof data !== 'object') throw new Error('Invalid data provided for creation');
        if (validation && validation.create) {
          const validationResult = await validation.create(data);
          if (!validationResult.isValid) throw new Error(validationResult.message || 'Validation failed');
        }
        if (enableConstraintChecking) {
          const constraintCheck = await this.databaseAnalyzer.checkConstraints('create', data, model);
          if (!constraintCheck.isValid) throw new Error(`Constraint violations: ${constraintCheck.violations.join(', ')}`);
        }
        if (beforeActions.create) await beforeActions.create(data);
        
        // Handle nested operations if enabled
        const created = enableNestedOperations ? 
          await createWithNested(data) : 
          await model.create({ data });
        
        if (afterActions.create) await afterActions.create(created);
        res.status(201).json(this.apiResponse.success('post', created));
      } catch (error) {
        const errResp = this.handleError(error, 'post', errorHandler);
        res.status(errResp.status || 500).json(errResp);
      }
    });

    // PUT /:id: update
    this.app.put(`${routePath}/:id`, ...allMiddleware, async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body;
        if (!id) throw new Error('ID is required for update operation');
        if (!data || typeof data !== 'object') throw new Error('Invalid data provided for update');
        if (validation && validation.update) {
          const validationResult = await validation.update(data);
          if (!validationResult.isValid) throw new Error(validationResult.message || 'Validation failed');
        }
        if (enableConstraintChecking) {
          const constraintCheck = await this.databaseAnalyzer.checkConstraints('update', data, model);
          if (!constraintCheck.isValid) throw new Error(`Constraint violations: ${constraintCheck.violations.join(', ')}`);
        }
        if (enableCascadeHandling) {
          const cascadeResult = await this.databaseAnalyzer.handleCascadeOperations('update', data, model, id);
          if (!cascadeResult.success) {
            console.warn(`Cascade operations completed with warnings: ${cascadeResult.results.join(', ')}`);
          }
        }
        if (beforeActions.update) await beforeActions.update(id, data);
        
        // Handle nested operations if enabled
        const updated = enableNestedOperations ? 
          await updateWithNested(id, data) : 
          await model.update({ where: { id: Number(id) }, data });
        
        if (afterActions.update) await afterActions.update(updated);
        res.json(this.apiResponse.success('put', updated));
      } catch (error) {
        const errResp = this.handleError(error, 'put', errorHandler);
        res.status(errResp.status || 500).json(errResp);
      }
    });

    // DELETE /:id: delete
    this.app.delete(`${routePath}/:id`, ...allMiddleware, async (req, res) => {
      try {
        const id = req.params.id;
        if (!id) throw new Error('ID is required for delete operation');
        if (beforeActions.destroy) await beforeActions.destroy(id);
        if (enableCascadeHandling) {
          const cascadeResult = await this.databaseAnalyzer.handleCascadeOperations('delete', {}, model, id);
          if (!cascadeResult.success) {
            console.warn(`Cascade operations completed with warnings: ${cascadeResult.results.join(', ')}`);
          }
        }
        const deleted = await model.delete({ where: { id: Number(id) } });
        if (afterActions.destroy) await afterActions.destroy(deleted);
        res.json(this.apiResponse.success('delete', deleted));
      } catch (error) {
        const errResp = this.handleError(error, 'delete', errorHandler);
        res.status(errResp.status || 500).json(errResp);
      }
    });

    // Custom actions (if any)
    if (customActions && typeof customActions === 'object') {
      Object.entries(customActions).forEach(([method, handler]) => {
        // Only allow safe HTTP methods
        const methodLower = method.toLowerCase();
        if (["get", "post", "put", "delete", "patch"].includes(methodLower) && typeof handler === 'function') {
          this.app[methodLower](routePath, ...allMiddleware, handler);
        }
      });
    }
  }

  /**
   * Standardize error handling and response formatting
   * @param {Error|Object} error - Error object, can be Prisma error or custom error
   * @param {string} method - HTTP method that triggered the error ('get', 'post', etc)
   * @param {Function} [customErrorHandler] - Optional custom error handler function
   * @returns {Object} Formatted error response with:
   *      - status: HTTP status code
   *      - message: Error message (detailed in dev, generic in prod)
   *      - data: null
   *      - method: The HTTP method
   * @example
   * // Default error handling
   * router.handleError(new Error('Not found'), 'get');
   *
   * // With custom handler
   * router.handleError(new Error('Not found'), 'get', (err, method, apiResponse) => {
   *   return apiResponse.error(method, null, 'Custom error', 400);
   * });
   */
  handleError(error, method, customErrorHandler) {
    if (customErrorHandler) {
      return customErrorHandler(error, method, this.apiResponse);
    }

    let errorMessage = this.isDev ? (error.code ? ErrorCode[error.code]?.errorMessage  : error.message  ) : ErrorCode.default.errorMessage;
    let statusCode = error.code ? ErrorCode[error.code]?.errorMessage : ErrorCode.default.statusCode;

    return this.apiResponse.error(method, null, errorMessage, statusCode);

  }

  /**
   * Add middleware that runs before all routes
   * @param {Function} middleware - Express middleware function
   * @example
   * // Add authentication middleware
   * router.addGlobalMiddleware(authMiddleware);
   *
   * // Add logging middleware
   * router.addGlobalMiddleware((req, res, next) => {
   *   console.log(`${req.method} ${req.path}`);
   *   next();
   * });
   */
  addGlobalMiddleware(middleware) {
    this.options.defaultMiddleware.push(middleware);
  }

  /**
   * Set default error handler for all routes
   * @param {Function} errorHandler - Function that receives:
   *      - error: The error object
   *      - method: HTTP method
   *      - apiResponse: Api_Response instance
   * @returns {Object} Should return formatted error response
   * @example
   * router.setGlobalErrorHandler((error, method, apiResponse) => {
   *   if (error.code === 'P2025') {
   *     return apiResponse.error(method, null, 'Not found', 404);
   *   }
   *   return apiResponse.error(method, null, 'Server error', 500);
   * });
   */
  setGlobalErrorHandler(errorHandler) {
    this.globalErrorHandler = errorHandler;
  }

  /**
   * Get the API response helper instance
   * @returns {Api_Response} Instance configured with router settings
   * @example
   * const apiResponse = router.getApiResponse();
   * res.json(apiResponse.success('get', data));
   */
  getApiResponse() {
    return this.apiResponse;
  }

  /**
   * Legacy method for creating CRUD routes (use route() instead)
   * @param {string} routePath - The base route path
   * @param {Object} model - Prisma model instance
   * @param {Object} [options] - Route configuration options
   * @deprecated Use route() method for more flexibility
   * @see route
   */
  createCrudRoute(routePath, model, options = {}) {
    this.route(routePath, model, options);
  }

  /**
   * Get model name from Prisma model
   * @param {Object} model - Prisma model
   * @returns {string} Model name
   */
  getModelName(model) {
    return model.constructor.name || 'Unknown';
  }
}

module.exports = PrismaCrudRouter;
