const messages = {
    'ok': {
        'get': 'Data retrieved successfully',
        'post': 'Resource created successfully',
        'put': 'Resource updated successfully',
        'patch': 'Resource partially updated successfully',
        'delete': 'Resource deleted successfully'
    },
    'error': {
        'get': 'Failed to retrieve data',
        'post': 'Failed to create resource',
        'put': 'Failed to update resource',
        'patch': 'Failed to partially update resource',
        'delete': 'Failed to delete resource'
    },
    'info': {
        'get': 'Information retrieved',
        'post': 'Information processed',
        'put': 'Information updated',
        'patch': 'Information modified',
        'delete': 'Information removed'
    },
    'warning': {
        'get': 'Data retrieved with warnings',
        'post': 'Resource created with warnings',
        'put': 'Resource updated with warnings',
        'patch': 'Resource partially updated with warnings',
        'delete': 'Resource deleted with warnings'
    }
};

module.exports = messages;