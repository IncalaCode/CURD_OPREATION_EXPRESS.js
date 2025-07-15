const Api_Response = require('./api_response_folder/Api_Response');
const DatabaseAnalyzer  = require('./Curd_op/DatabaseAnalyzer').DatabaseAnalyzer
const ErrorCode = require('./Curd_op/PrismaError').ErrorCode
const FileHandler = require("./Curd_op/FileHandler")

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
      excludeFields: options.excludeFields || ['password'], // Default exclude fields
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
   * Creates CRUD routes with flexible configuration using a custom generator.
   *
   * @param {string} routePath - The base route path (e.g., '/users').
   * @param {Object} model - Prisma model instance used for CRUD operations.
   * @param {Object} routeOptions - Configuration options for the route.
   * @param {Function[]|Object} [routeOptions.middleware] - Array of Express middleware functions, or an object with per-method arrays (default, create, update, delete, get, getById)  { default: [], create: [], update: [], delete: [], get: [], getById: [] } .
   * @param {Function} [routeOptions.authMiddleware] - Middleware for authentication.
   *
   * @param {Object} [routeOptions.validation] - Validation functions.
   * @param {Function} [routeOptions.validation.create] - Validation function for create operations.
   * @param {Function} [routeOptions.validation.update] - Validation function for update operations.
   *
   * @param {Object} [routeOptions.beforeActions] - Pre-operation hooks.
   * @param {Function} [routeOptions.beforeActions.get] - Hook before GET all.
   * @param {Function} [routeOptions.beforeActions.create] - Hook before POST.
   * @param {Function} [routeOptions.beforeActions.update] - Hook before PUT.
   * @param {Function} [routeOptions.beforeActions.destroy] - Hook before DELETE.
   *
   * @param {Object} [routeOptions.afterActions] - Post-operation hooks (same structure as beforeActions).
   * @param {Function} [routeOptions.afterActions.get]
   * @param {Function} [routeOptions.afterActions.create]
   * @param {Function} [routeOptions.afterActions.update]
   * @param {Function} [routeOptions.afterActions.destroy]
   *
   * @param {Object<string, Function>} [routeOptions.customActions] - Custom route handlers keyed by HTTP method.
   * @param {Function} [routeOptions.errorHandler] - Custom error handler.
   * @param {boolean} [routeOptions.includeRelations=false] - Include related models.
   * @param {string[]} [routeOptions.excludeRelations] - Relation fields to exclude.
   * @param {boolean} [routeOptions.enableConstraintChecking=true] - Enable DB constraint validation.
   * @param {boolean} [routeOptions.enableCascadeHandling=true] - Enable cascade operation handling.
   *
   * @param {Object} [routeOptions.nestedModels] - Configuration for nested operations.
   * @param {string[]} [routeOptions.nestedModels.create] - Relations to create with parent.
   * @param {string[]} [routeOptions.nestedModels.update] - Relations to update with parent.
   * @param {string[]} [routeOptions.nestedModels.delete] - Relations to delete when parent is deleted.
   *
   * @param {boolean} [routeOptions.autoDetectRelations=true] - Automatically detect and handle relations.
   * @param {string[]} [routeOptions.excludeRoute] - HTTP methods to exclude (e.g., ['get', 'post']).
   * @param {string[]} [routeOptions.excludeFields] - Fields to exclude from select, orderBy, and include (e.g., ['password']).
   */



  route(routePath, model, routeOptions = {}) {
    const {
      middleware = {},
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
      autoDetectRelations = routeOptions.autoDetectRelations !== false,
      excludeRoute = [],
    } = routeOptions;

    // Middleware composition
    // Accepts: middleware: { default: [], create: [], update: [], delete: [], get: [], getById: [] }
    // Fallback: if middleware is array, treat as default
    const middlewareObj = Array.isArray(middleware) ? { default: middleware } : (middleware || {});
    const composeMiddleware = (type) => [
      ...(this.options.defaultMiddleware || []),
      ...(middlewareObj.default || []),
      ...(middlewareObj[type] || []),
      ...(authMiddleware ? [authMiddleware] : [])
    ];

    const detectRelationTypes = (data) => {
      const singleRelations = {};
      const bulkRelations = {};

      if (!autoDetectRelations) {
        return { singleRelations, bulkRelations };
      }

      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'object' || value === null || 
            ['id', 'createdAt', 'updatedAt', 'uploadedFiles'].includes(key)) {
          continue;
        }

        if (Array.isArray(value)) {
          bulkRelations[key] = value;
        }
        else if (typeof value === 'object' && !Array.isArray(value)) {
          singleRelations[key] = value;
        }
      }

      return { singleRelations, bulkRelations };
    };

    const processNestedData = (data, operation = 'create') => {
      const mainData = { ...data };
      const { singleRelations, bulkRelations } = detectRelationTypes(data);

      Object.keys(singleRelations).forEach(key => {
        delete mainData[key];
      });
      Object.keys(bulkRelations).forEach(key => {
        delete mainData[key];
      });

      return { mainData, singleRelations, bulkRelations };
    };


    const createWithAutoDetectedRelations = async (data) => {
      const { mainData, singleRelations, bulkRelations } = processNestedData(data, 'create');
      
      if (Object.keys(singleRelations).length === 0 && Object.keys(bulkRelations).length === 0) {
        return await model.create({ data: mainData });
      }

      const createData = { ...mainData };
      
      for (const [relation, items] of Object.entries(singleRelations)) {
        createData[relation] = {
          create: items
        };
      }
      
      for (const [relation, items] of Object.entries(bulkRelations)) {
        createData[relation] = {
          create: items
        };
      }

      const created = await model.create({
        data: createData,
        include: {
          ...Object.keys(singleRelations).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
          ...Object.keys(bulkRelations).reduce((acc, key) => ({ ...acc, [key]: true }), {})
        }
      });
      
      return created;
    };


    const updateWithAutoDetectedRelations = async (id, data) => {
      if (!id) {
        throw new Error('ID is required for update operation');
      }

      let finalId;
      if (typeof id === 'string') {
 
        const numericId = Number(id);
        if (!isNaN(numericId)) {
          finalId = numericId;
        } else {
          finalId = id;
        }
      } else if (typeof id === 'number') {
        finalId = id;
      } else {
        throw new Error(`Invalid ID type: expected string or number, got ${typeof id}`);
      }
      
      
      const { mainData, singleRelations, bulkRelations } = processNestedData(data, 'update');
      
      if (Object.keys(singleRelations).length === 0 && Object.keys(bulkRelations).length === 0) {
        return await model.update({ 
          where: { id: finalId }, 
          data: mainData 
        });
      }

      const updateData = { ...mainData };
        
      for (const [relation, items] of Object.entries(singleRelations)) {
        updateData[relation] = {
          create: items
        };
      }
      
      for (const [relation, items] of Object.entries(bulkRelations)) {
        updateData[relation] = {
          create: items
        };
      }

      const updated = await model.update({
        where: { id: finalId },
        data: updateData,
        include: {
          ...Object.keys(singleRelations).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
          ...Object.keys(bulkRelations).reduce((acc, key) => ({ ...acc, [key]: true }), {})
        }
      });
      
      return updated;
    };

    const isExcluded = (method) => Array.isArray(excludeRoute) && excludeRoute.map(m => m.toLowerCase()).includes(method.toLowerCase());

    const convertId = (id) => {
      if (typeof id === 'string' && !isNaN(Number(id))) {
        return Number(id);
      }
      return id;
    };

    // Track which routes are registered
    const routeStatus = [
      { method: 'GET',      label: 'GET',      path: routePath,         excluded: isExcluded('get') },
      { method: 'GET',      label: 'GET BY ID', path: `${routePath}/:id`,  excluded: isExcluded('getById') },
      { method: 'POST',     label: 'POST',     path: routePath,         excluded: isExcluded('post') },
      { method: 'PUT',      label: 'PUT',      path: `${routePath}/:id`, excluded: isExcluded('put') },
      { method: 'DELETE',   label: 'DELETE',   path: `${routePath}/:id`, excluded: isExcluded('delete') },
    ];

    // Register CRUD routes directly on the Express app
    // GET /: get all
    if (!isExcluded('get')) {
      this.app.get(routePath, ...composeMiddleware('get'), async (req, res) => {
        try {
          let query = req.query;
          if (beforeActions.get) {
            const result = await beforeActions.get(query, req);
            if (typeof result !== 'undefined') query = result;
          }
          // Advanced query support
          const filter = query.filter ? JSON.parse(query.filter) : {};
          const limit = query.limit ? parseInt(query.limit) : 100;
          const offset = query.offset ? parseInt(query.offset) : 0;
          const order = query.order ? JSON.parse(query.order) : [];
          const include = query.include ? JSON.parse(query.include) : undefined;
          let select = query.select ? JSON.parse(query.select) : undefined;
          let orderBy = query.orderBy ? JSON.parse(query.orderBy) : (order.length ? { [order[0][0]]: order[0][1].toLowerCase() } : undefined);
          const skip = query.skip ? parseInt(query.skip) : offset;
          const take = query.take ? parseInt(query.take) : limit;

          // --- DYNAMIC FIELD FILTERING & EXCLUDE ---
          // 1. Cache a sample record for field introspection
          await this.databaseAnalyzer.cacheSampleRecord(model);
          // 2. Get structure and valid fields
          const structure = await this.databaseAnalyzer.analyzeDatabaseStructure(model);
          const validFields = structure && structure.fields && structure.fields.length > 0 ? structure.fields : [];
          // 3. Exclude list (global or per-route)
          const globalExclude = (this.options.excludeFields || ['password']);
          const routeExclude = (routeOptions.excludeFields || []);
          const exclude = Array.from(new Set([...globalExclude, ...routeExclude]));
          // 4. Filter valid fields
          const filteredFields = validFields.filter(f => !exclude.includes(f));

          // 4.5. Filter the filter (where) object
          const filteredFilter = filterWhereObject(filter, filteredFields);

          // 5. Filter select
          let hasSelect = false;
          if (select) {
            hasSelect = true;
            if (Array.isArray(select)) {
              select = select.filter(f => filteredFields.includes(f));
              // Convert to Prisma select object
              select = Object.fromEntries(select.map(f => [f, true]));
            } else if (typeof select === 'object') {
              select = Object.fromEntries(Object.entries(select).filter(([f]) => filteredFields.includes(f)));
            }
          } else {
            // Default: select all fields except excluded
            select = Object.fromEntries(filteredFields.map(f => [f, true]));
          }

          // 6. Filter orderBy
          if (orderBy && typeof orderBy === 'object') {
            if (Array.isArray(orderBy)) {
              orderBy = orderBy.filter(o => o && filteredFields.includes(Object.keys(o)[0]));
            } else {
              orderBy = Object.fromEntries(Object.entries(orderBy).filter(([f]) => filteredFields.includes(f)));
            }
            if (Array.isArray(orderBy) && orderBy.length === 0) orderBy = undefined;
            if (typeof orderBy === 'object' && Object.keys(orderBy).length === 0) orderBy = undefined;
          }

          // 7. Filter include (only allow relations or valid fields)
          let includeObject = {};
          if (!hasSelect) { // Only process include if select is NOT present
            if (includeRelations && structure && structure.hasRelations) {
              for (const fk of structure.foreignKeys) {
                if (!excludeRelations.includes(fk.field)) {
                  includeObject[fk.field] = true;
                }
              }
            }
            if (include) {
              for (const [key, val] of Object.entries(include)) {
                if (filteredFields.includes(key) || (structure && structure.foreignKeys.some(fk => fk.field === key))) {
                  includeObject[key] = val;
                }
              }
            }
          }

          // If any advanced query param is present, use them directly
          const isAdvanced = select || orderBy || include || query.skip || query.take;
          let rows, count;
          if (isAdvanced) {
            const findManyArgs = {
              where: filteredFilter,
              orderBy,
              skip,
              take
            };
            if (select) {
              findManyArgs.select = select;
            } else if (Object.keys(includeObject).length > 0) {
              findManyArgs.include = includeObject;
            }
      
            if (findManyArgs.select) {
              const structure = await this.databaseAnalyzer.analyzeDatabaseStructure(model);
              const validFields = structure && structure.fields && structure.fields.length > 0 ? structure.fields : [];
              for (const key of Object.keys(findManyArgs.select)) {
                if (!validFields.includes(key)) {
                  delete findManyArgs.select[key];
                }
              }
              if (Object.keys(findManyArgs.select).length === 0) {
                delete findManyArgs.select;
              }
            }
            rows = await model.findMany(findManyArgs);
            count = await model.count({ where: filteredFilter });
          } else {
            [rows, count] = await Promise.all([
              model.findMany({
                where: filteredFilter,
                skip: offset,
                take: limit,
                orderBy,
                include: Object.keys(includeObject).length > 0 ? includeObject : undefined,
              }),
              model.count({ where: filteredFilter }),
            ]);
          }
          let afterGetResult = { rows, count };
          if (afterActions.get) {
            const result = await afterActions.get(afterGetResult, req);
            if (typeof result !== 'undefined') afterGetResult = result;
          }
          const apiResponse = this.apiResponse.success('get', { data: afterGetResult.rows, count: afterGetResult.count });
          this.apiResponse.setResponseHeaders(res, apiResponse);
          res.status(apiResponse.statusCode).json(apiResponse.body);
        } catch (error) {
          const errResp = this.handleError(error, 'get', errorHandler);
          this.apiResponse.setResponseHeaders(res, errResp);
          res.status(errResp.statusCode || 500).json(errResp.body);
        }
      });
    }

    // GET /:id: get by id
    if (!isExcluded('getById')) {
      this.app.get(`${routePath}/:id`, ...composeMiddleware('getById'), async (req, res) => {
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
          let row = await model.findUnique({
            where: { id: convertId(id) },
            include: Object.keys(includeObject).length > 0 ? includeObject : undefined,
          });
          if (!row) throw { code: 'P2025', message: 'Record not found' };
          if (afterActions.getById) {
            const result = await afterActions.getById(row, req);
            if (typeof result !== 'undefined') row = result;
          }
          const apiResponse = this.apiResponse.success('get', row);
          this.apiResponse.setResponseHeaders(res, apiResponse);
          res.status(apiResponse.statusCode).json(apiResponse.body);
        } catch (error) {
          const errResp = this.handleError(error, 'get', errorHandler);
          this.apiResponse.setResponseHeaders(res, errResp);
          res.status(errResp.statusCode || 500).json(errResp.body);
        }
      });
    }

    // POST /: create
    if (!isExcluded('post')) {
      this.app.post(routePath, ...composeMiddleware('create'), async (req, res) => {
        try {
          let data = req.body;
          if (!data || typeof data !== 'object') throw new Error('Invalid data provided for creation');
          if (beforeActions.create) {
            const result = await beforeActions.create(data, req);
            if (typeof result !== 'undefined') data = result;
          }
          if (validation && validation.create) {
            const validationResult = await validation.create(data,req);
            if (!validationResult.isValid) throw new Error(validationResult.message || 'Validation failed');
          }
          if (enableConstraintChecking) {
            const constraintCheck = await this.databaseAnalyzer.checkConstraints('create', data, model);
            if (!constraintCheck.isValid) throw new Error(`Constraint violations: ${constraintCheck.violations.join(', ')}`);
          }
          // Auto-detect and handle relations
          const created = autoDetectRelations ? 
            await createWithAutoDetectedRelations(data) : 
            await model.create({ data });
          let responseData = created;
          if (afterActions.create) {
            const result = await afterActions.create(created, req);
            if (typeof result !== 'undefined') responseData = result;
          }
          const apiResponse = this.apiResponse.success('post', responseData);
          this.apiResponse.setResponseHeaders(res, apiResponse);
          res.status(201).json(apiResponse.body);
        } catch (error) {
          const errResp = this.handleError(error, 'post', errorHandler);
          this.apiResponse.setResponseHeaders(res, errResp);
          res.status(errResp.statusCode || 500).json(errResp.body);
        }
      });
    }

    // PUT /:id: update
    if (!isExcluded('put')) {
      this.app.put(`${routePath}/:id`, ...composeMiddleware('update'), async (req, res) => {
        try {
          const id = req.params.id;
          let data = req.body;
          if (!id) throw new Error('ID is required for update operation');
          if (!data || typeof data !== 'object') throw new Error('Invalid data provided for update');
          if (beforeActions.update) {
            const result = await beforeActions.update(id, data, req);
            if (typeof result !== 'undefined') data = result;
          }
          if (validation && validation.update) {
            const validationResult = await validation.update(data,req);
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
          // Auto-detect and handle relations
          const updated = autoDetectRelations ? 
            await updateWithAutoDetectedRelations(id, data) : 
            await model.update({ 
              where: { id: convertId(id) }, 
              data 
            });
          let responseData = updated;
          if (afterActions.update) {
            const result = await afterActions.update(updated, req);
            if (typeof result !== 'undefined') responseData = result;
          }
          const apiResponse = this.apiResponse.success('put', responseData);
          this.apiResponse.setResponseHeaders(res, apiResponse);
          res.status(apiResponse.statusCode).json(apiResponse.body);
        } catch (error) {
          const errResp = this.handleError(error, 'put', errorHandler);
          this.apiResponse.setResponseHeaders(res, errResp);
          res.status(errResp.statusCode || 500).json(errResp.body);
        }
      });
    }

    // DELETE /:id: delete
    if (!isExcluded('delete')) {
      this.app.delete(`${routePath}/:id`, ...composeMiddleware('delete'), async (req, res) => {
        try {
          const id = req.params.id;
          if (!id) throw new Error('ID is required for delete operation');
          let deleted;
          if (beforeActions.destroy) {
            const result = await beforeActions.destroy(id, req);
            if (typeof result !== 'undefined') deleted = result;
          }
          if (!deleted) {
            if (enableCascadeHandling) {
              const cascadeResult = await this.databaseAnalyzer.handleCascadeOperations('delete', {}, model, id);
              if (!cascadeResult.success) {
                console.warn(`Cascade operations completed with warnings: ${cascadeResult.results.join(', ')}`);
              }
            }
            deleted = await model.delete({ 
              where: { id: convertId(id) } 
            });
          }
          if (afterActions.destroy) {
            const result = await afterActions.destroy(deleted, req);
            if (typeof result !== 'undefined') deleted = result;
          }
          const apiResponse = this.apiResponse.success('delete', deleted);
          this.apiResponse.setResponseHeaders(res, apiResponse);
          res.status(apiResponse.statusCode).json(apiResponse.body);
        } catch (error) {
          const errResp = this.handleError(error, 'delete', errorHandler);
          this.apiResponse.setResponseHeaders(res, errResp);
          res.status(errResp.statusCode || 500).json(errResp.body);
        }
      });
    }

    // Custom actions (if any)
    if (customActions && typeof customActions === 'object') {
      Object.entries(customActions).forEach(([method, handler]) => {
        // Only allow safe HTTP methods
        const methodLower = method.toLowerCase();
        if (["get", "post", "put", "delete", "patch"].includes(methodLower) && typeof handler === 'function') {
          this.app[methodLower](routePath, ...composeMiddleware(methodLower), handler);
        }
      });
    }

    console.log(`\n[ROUTER] ${routePath}`);
    routeStatus.forEach(r => {
      const status = r.excluded ? '❌ (excluded)' : '✔️';
      console.log(`  ${r.label.padEnd(10)} ${status}  ${r.excluded ? '' : r.path}`);
    });
  }

  /**
   * Standardize error handling and response formatting
   * @param {Error|Object} error - Error object, can be Prisma error or custom error
   * @param {string} method - HTTP method that triggered the error ('get', 'post', etc)
   * @param {Function} [customErrorHandler] - Optional custom error handler function
   * @returns {Object} Formatted error response with:
   *      - body: Error response body for React Admin
   *      - headers: Response headers
   *      - statusCode: HTTP status code
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
    let statusCode = error.code ? ErrorCode[error.code]?.statusCode : ErrorCode.default.statusCode;

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

// Utility: Recursively filter filter/where object to only allow valid fields and Prisma logical operators
function filterWhereObject(where, validFields) {
  if (!where || typeof where !== 'object') return where;
  const LOGICALS = ['AND', 'OR', 'NOT'];
  let result = Array.isArray(where) ? [] : {};
  for (const [key, value] of Object.entries(where)) {
    if (LOGICALS.includes(key)) {
      if (Array.isArray(value)) {
        result[key] = value.map(v => filterWhereObject(v, validFields)).filter(v => v && Object.keys(v).length > 0);
      } else if (typeof value === 'object') {
        const filtered = filterWhereObject(value, validFields);
        if (filtered && Object.keys(filtered).length > 0) result[key] = filtered;
      }
    } else if (validFields.includes(key)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = filterWhereObject(value, validFields);
      } else {
        result[key] = value;
      }
    }
    // else: skip invalid field
  }
  return result;
}

module.exports = {PrismaCrudRouter,DatabaseAnalyzer,Api_Response,FileHandler};