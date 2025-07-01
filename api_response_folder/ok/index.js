const okHandlers = {
    get: (data, message, statusCode = 200) => ({
        type: 'ok',
        method: 'GET',
        statusCode,
        message: message || 'Data retrieved successfully',
        data,
        count: Array.isArray(data) ? data.length : data ? 1 : 0
    }),

    post: (data, message, statusCode = 201) => ({
        type: 'ok',
        method: 'POST',
        statusCode,
        message: message || 'Resource created successfully',
        data,
        created: true
    }),

    put: (data, message, statusCode = 200) => ({
        type: 'ok',
        method: 'PUT',
        statusCode,
        message: message || 'Resource updated successfully',
        data,
        updated: true
    }),

    patch: (data, message, statusCode = 200) => ({
        type: 'ok',
        method: 'PATCH',
        statusCode,
        message: message || 'Resource partially updated successfully',
        data,
        patched: true
    }),

    delete: (data, message, statusCode = 204) => ({
        type: 'ok',
        method: 'DELETE',
        statusCode,
        message: message || 'Resource deleted successfully',
        data,
        deleted: true
    })
};

module.exports = okHandlers;