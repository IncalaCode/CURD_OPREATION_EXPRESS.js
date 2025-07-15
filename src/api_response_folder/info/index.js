const infoHandlers = {
    get: (data, message, statusCode = 200) => ({
        type: 'info',
        method: 'GET',
        statusCode,
        message: message || 'Information retrieved',
        data,
        infoType: 'RETRIEVAL_INFO'
    }),

    post: (data, message, statusCode = 202) => ({
        type: 'info',
        method: 'POST',
        statusCode,
        message: message || 'Request accepted for processing',
        data,
        infoType: 'PROCESSING_INFO'
    }),

    put: (data, message, statusCode = 202) => ({
        type: 'info',
        method: 'PUT',
        statusCode,
        message: message || 'Update request accepted for processing',
        data,
        infoType: 'UPDATE_INFO'
    }),

    patch: (data, message, statusCode = 202) => ({
        type: 'info',
        method: 'PATCH',
        statusCode,
        message: message || 'Partial update request accepted for processing',
        data,
        infoType: 'PATCH_INFO'
    }),

    delete: (data, message, statusCode = 202) => ({
        type: 'info',
        method: 'DELETE',
        statusCode,
        message: message || 'Delete request accepted for processing',
        data,
        infoType: 'DELETE_INFO'
    })
};

module.exports = infoHandlers;