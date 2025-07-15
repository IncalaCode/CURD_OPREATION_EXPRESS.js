const warningHandlers = {
    get: (data, message, statusCode = 200) => ({
        type: 'warning',
        method: 'GET',
        statusCode,
        message: message || 'Data retrieved with warnings',
        data,
        warningType: 'RETRIEVAL_WARNING',
        warnings: []
    }),

    post: (data, message, statusCode = 201) => ({
        type: 'warning',
        method: 'POST',
        statusCode,
        message: message || 'Resource created with warnings',
        data,
        warningType: 'CREATION_WARNING',
        warnings: []
    }),

    put: (data, message, statusCode = 200) => ({
        type: 'warning',
        method: 'PUT',
        statusCode,
        message: message || 'Resource updated with warnings',
        data,
        warningType: 'UPDATE_WARNING',
        warnings: []
    }),

    patch: (data, message, statusCode = 200) => ({
        type: 'warning',
        method: 'PATCH',
        statusCode,
        message: message || 'Resource partially updated with warnings',
        data,
        warningType: 'PATCH_WARNING',
        warnings: []
    }),

    delete: (data, message, statusCode = 200) => ({
        type: 'warning',
        method: 'DELETE',
        statusCode,
        message: message || 'Resource deleted with warnings',
        data,
        warningType: 'DELETE_WARNING',
        warnings: []
    })
};

module.exports = warningHandlers;