const errorHandlers = {
    get: (data, message, statusCode = 404) => ({
        type: 'error',
        method: 'GET',
        statusCode,
        message: message || 'Resource not found',
        data,
        errorType: 'NOT_FOUND'
    }),

    post: (data, message, statusCode = 400) => ({
        type: 'error',
        method: 'POST',
        statusCode,
        message: message || 'Bad request - unable to create resource',
        data,
        errorType: 'BAD_REQUEST'
    }),

    put: (data, message, statusCode = 400) => ({
        type: 'error',
        method: 'PUT',
        statusCode,
        message: message || 'Bad request - unable to update resource',
        data,
        errorType: 'UPDATE_FAILED'
    }),

    patch: (data, message, statusCode = 400) => ({
        type: 'error',
        method: 'PATCH',
        statusCode,
        message: message || 'Bad request - unable to partially update resource',
        data,
        errorType: 'PATCH_FAILED'
    }),
    
    delete: (data, message, statusCode = 404) => ({
        type: 'error',
        method: 'DELETE',
        statusCode,
        message: message || 'Resource not found - unable to delete',
        data,
        errorType: 'DELETE_FAILED'
    })
};

module.exports = errorHandlers;