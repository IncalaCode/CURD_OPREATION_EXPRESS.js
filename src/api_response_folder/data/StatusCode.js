const statusCodes = {
    'ok': {
        'get': 200,
        'post': 201,
        'put': 200,
        'patch': 200,
        'delete': 204
    },
    'error': {
        'get': 404,
        'post': 400,
        'put': 400,
        'patch': 400,
        'delete': 404
    },
    'info': {
        'get': 200,
        'post': 202,
        'put': 202,
        'patch': 202,
        'delete': 202
    },
    'warning': {
        'get': 200,
        'post': 200,
        'put': 200,
        'patch': 200,
        'delete': 200
    }
};

module.exports = statusCodes;