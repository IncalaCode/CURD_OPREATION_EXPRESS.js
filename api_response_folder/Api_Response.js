const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const messages = require('./data/message.js');
const statusCodes = require('./data/StatusCode.js');
const errorHandlers = require('./error/index.js');
const okHandlers = require('./ok/index.js');
const infoHandlers = require('./info/index.js');
const warningHandlers = require('./warring/index.js');

class Api_Response {
    constructor(IsDevMode = false, version = "0.0.1", encryptionValue = null, logsPath = null, responseId = null, powered_by = "api-response-wrapper" ) {
        this.IsDevMode = IsDevMode;
        this.version = version;
        this.encryptionValue = encryptionValue;
        this.logsPath = logsPath;
        this.responseId = responseId || uuidv4();
        this.startTime = Date.now();
        this.logger = this.createLogger();
        this.powered_by = powered_by;
    }

    createLogger() {
        if (!this.logsPath) return null;

        const logDir = path.dirname(this.logsPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        return winston.createLogger({
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'api-response-wrapper' },
            transports: [
                new winston.transports.File({ 
                    filename: this.logsPath, 
                    level: 'error' 
                })
            ]
        });
    }

    /**
     * Create response for React Admin compatibility
     * @param {string} type - Response type (ok, error, info, warning)
     * @param {string} functionType - HTTP method (get, post, put, delete)
     * @param {any} data - Response data
     * @param {string} message - Response message
     * @param {number} statusCode - HTTP status code
     * @param {string} responseId - Custom response ID
     * @returns {Object} Response object with body and headers
     */
    match(type, functionType, data = null, message = "", statusCode = null, responseId = null) {
        const responseTime = Date.now() - this.startTime;
        const currentResponseId = responseId || this.responseId;
        const currentStatusCode = statusCode || this.getDefaultStatusCode(type, functionType);
        const currentMessage = message || this.getDefaultMessage(type, functionType);

        const handler = this.getHandler(type, functionType);
        
        if (!handler) {
            return this.createErrorResponse("HANDLER_NOT_FOUND", `No handler found for ${type}/${functionType}`, 500, responseTime, currentResponseId);
        }

        // Create headers for React Admin
        const headers = {
            'X-Response-Type': type,
            'X-Response-Method': functionType.toUpperCase(),
            'X-Response-ID': currentResponseId,
            'X-Response-Time': `${responseTime}ms`,
            'X-API-Version': this.version,
            'X-Environment': this.IsDevMode ? "development" : "production",
            'X-Encrypted': this.encryptionValue ? 'true' : 'false',
            'X-Timestamp': new Date().toISOString(),
            'x-powered-by': this.powered_by
        };


        // Add development headers
        if (this.IsDevMode) {
            headers['X-Response-Time'] = `${responseTime}ms`;
            // headers['X-Message'] = currentMessage;
        }

        // Create body for React Admin
        let body = { message : currentMessage,...data};

        // Handle encryption
        if (this.encryptionValue && data) {
            body = this.encryptData(data);
            headers['X-Encrypted'] = 'true';
        }

        // Handle error logging
        if (type === 'error' && this.logger) {
            this.logError({
                responseId: currentResponseId,
                type: type,
                method: functionType.toUpperCase(),
                message: currentMessage,
                statusCode: currentStatusCode,
                data: data
            });
        }

        return {
            body: body,
            headers: headers,
            statusCode: currentStatusCode
        };
    }

    /**
     * Create error response for React Admin
     * @param {string} errorCode - Error code
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     * @param {number} responseTime - Response time
     * @param {string} responseId - Response ID
     * @returns {Object} Error response with body and headers
     */
    createErrorResponse(errorCode, message, statusCode, responseTime, responseId) {
        const headers = {
            'X-Response-Type': 'error',
            'X-Response-Method': 'ERROR',
            'X-Response-ID': responseId,
            'X-Response-Time': `${responseTime}ms`,
            'X-API-Version': this.version,
            'X-Environment': this.IsDevMode ? "development" : "production",
            'X-Error-Code': errorCode,
            'X-Timestamp': new Date().toISOString()
        };

        // if (this.IsDevMode) {
        //     headers['X-Message'] = message;
        // }

        return {
            body: {
                error: true,
                message: message,
                code: errorCode
            },
            headers: headers,
            statusCode: statusCode
        };
    }

    logError(errorResponse) {
        if (this.logger) {
            this.logger.error('API_ERROR', {
                responseId: errorResponse.responseId,
                errorCode: errorResponse.errorCode,
                message: errorResponse.message,
                statusCode: errorResponse.statusCode,
                method: errorResponse.method,
                timestamp: errorResponse.timestamp,
                data: errorResponse.data
            });
        }
    }

    getHandler(type, functionType) {
        const handlers = {
            'error': errorHandlers,
            'ok': okHandlers,
            'info': infoHandlers,
            'warning': warningHandlers
        };
        
        const typeHandler = handlers[type];
        return typeHandler ? typeHandler[functionType] : null;
    }

    getDefaultStatusCode(type, functionType) {
        return statusCodes[type]?.[functionType] || 200;
    }

    getDefaultMessage(type, functionType) {
        return messages[type]?.[functionType] || 'Operation completed';
    }

    encryptData(data) {
        if (!this.encryptionValue) return data;
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }

    /**
     * Success response for React Admin
     * @param {string} functionType - HTTP method
     * @param {any} data - Response data
     * @param {string} message - Response message
     * @param {number} statusCode - HTTP status code
     * @param {string} responseId - Response ID
     * @returns {Object} Success response
     */
    success(functionType, data, message, statusCode, responseId) {
        return this.match('ok', functionType, data, message, statusCode, responseId);
    }

    /**
     * Error response for React Admin
     * @param {string} functionType - HTTP method
     * @param {any} data - Response data
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     * @param {string} responseId - Response ID
     * @returns {Object} Error response
     */
    error(functionType, data, message, statusCode, responseId) {
        return this.match('error', functionType, data, message, statusCode, responseId);
    }

    /**
     * Info response for React Admin
     * @param {string} functionType - HTTP method
     * @param {any} data - Response data
     * @param {string} message - Info message
     * @param {number} statusCode - HTTP status code
     * @param {string} responseId - Response ID
     * @returns {Object} Info response
     */
    info(functionType, data, message, statusCode, responseId) {
        return this.match('info', functionType, data, message, statusCode, responseId);
    }

    /**
     * Warning response for React Admin
     * @param {string} functionType - HTTP method
     * @param {any} data - Response data
     * @param {string} message - Warning message
     * @param {number} statusCode - HTTP status code
     * @param {string} responseId - Response ID
     * @returns {Object} Warning response
     */
    warning(functionType, data, message, statusCode, responseId) {
        return this.match('warning', functionType, data, message, statusCode, responseId);
    }

    /**
     * Helper method to set response headers on Express response
     * @param {Object} res - Express response object
     * @param {Object} apiResponse - API response object
     */
    setResponseHeaders(res, apiResponse) {
        if (apiResponse.headers) {
            Object.entries(apiResponse.headers).forEach(([key, value]) => {
                res.set(key, value);
            });
        }

        // Add React Admin specific headers for resource IDs
        if (apiResponse.body && apiResponse.body.data) {
            const data = apiResponse.body.data;
            
            if (Array.isArray(data)) {
                // Multiple resources
                const ids = data
                    .filter(item => item && item.id !== undefined)
                    .map(item => item.id)
                    .join(',');
                if (ids) {
                    res.set('X-Resource-IDs', ids);
                }
            } else if (data && data.id !== undefined) {
                // Single resource
                res.set('X-Resource-ID', data.id.toString());
            }
        }
    }

    /**
     * Helper method to send complete response for React Admin
     * @param {Object} res - Express response object
     * @param {string} functionType - HTTP method
     * @param {any} data - Response data
     * @param {string} message - Response message
     * @param {number} statusCode - HTTP status code
     */
    sendResponse(res, functionType, data, message, statusCode) {
        const apiResponse = this.success(functionType, data, message, statusCode);
        this.setResponseHeaders(res, apiResponse);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    }

    /**
     * Helper method to send error response for React Admin
     * @param {Object} res - Express response object
     * @param {string} functionType - HTTP method
     * @param {any} data - Response data
     * @param {string} message - Error message
     * @param {number} statusCode - HTTP status code
     */
    sendError(res, functionType, data, message, statusCode) {
        const apiResponse = this.error(functionType, data, message, statusCode);
        this.setResponseHeaders(res, apiResponse);
        res.status(apiResponse.statusCode).json(apiResponse.body);
    }

    static generateResponseId() {
        return uuidv4();
    }
}

module.exports = Api_Response;