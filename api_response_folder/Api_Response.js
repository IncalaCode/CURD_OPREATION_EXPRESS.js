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
    constructor(IsDevMode = false, version = "0.0.1", encryptionValue = null, logsPath = null, responseId = null) {
        this.IsDevMode = IsDevMode;
        this.version = version;
        this.encryptionValue = encryptionValue;
        this.logsPath = logsPath;
        this.responseId = responseId || uuidv4();
        this.startTime = Date.now();
        this.logger = this.createLogger();
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

    match(type, functionType, data = null, message = "", statusCode = null, responseId = null) {
        const responseTime = Date.now() - this.startTime;
        const currentResponseId = responseId || this.responseId;

        const handler = this.getHandler(type, functionType);
        
        if (!handler) {
            const errorResponse = this.createErrorResponse("HANDLER_NOT_FOUND", `No handler found for ${type}/${functionType}`, 500, responseTime, currentResponseId);
            this.logError(errorResponse);
            return errorResponse;
        }

        const response = {
            success: type === 'ok',
            type: type,
            method: functionType.toUpperCase(),
            responseId: currentResponseId,
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
            data: data,
            message: message || this.getDefaultMessage(type, functionType),
            statusCode: statusCode || this.getDefaultStatusCode(type, functionType),
            metadata: {
                version: this.version,
                environment: this.IsDevMode ? "development" : "production",
                encrypted: this.encryptionValue ? this.encryptionValue : false
            }
        };

        if (this.encryptionValue && data) {
            response.data = this.encryptData(data);
            response.metadata.encrypted = this.encryptionValue;
        }

        if (type === 'error' && this.logger) {
            this.logError(response);
        }

        if (!this.IsDevMode) {
            delete response.responseTime;
            if (type === 'error') {
                delete response.metadata.environment;
            }
        }

        return response;
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

    createErrorResponse(errorCode, message, statusCode, responseTime, responseId) {
        return {
            success: false,
            type: 'error',
            errorCode: errorCode,
            message: message,
            statusCode: statusCode,
            responseId: responseId,
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
            metadata: {
                version: this.version,
                environment: this.IsDevMode ? "development" : "production"
            }
        };
    }

    encryptData(data) {
        if (!this.encryptionValue) return data;
        return Buffer.from(JSON.stringify(data)).toString('base64');
    }

    success(functionType, data, message, statusCode, responseId) {
        return this.match('ok', functionType, data, message, statusCode, responseId);
    }

    error(functionType, data, message, statusCode, responseId) {
        return this.match('error', functionType, data, message, statusCode, responseId);
    }

    info(functionType, data, message, statusCode, responseId) {
        return this.match('info', functionType, data, message, statusCode, responseId);
    }

    warning(functionType, data, message, statusCode, responseId) {
        return this.match('warning', functionType, data, message, statusCode, responseId);
    }

    static generateResponseId() {
        return uuidv4();
    }
}

module.exports = Api_Response;