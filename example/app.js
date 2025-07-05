const express = require('express');
const { PrismaClient } = require('@prisma/client');
const PrismaCrudRouter = require('../index');
const FileHandler = require('../Curd_op/FileHandler');
const Api_Response = require('../api_response_folder/Api_Response');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

const models = {
  User: prisma.user,
  Post: prisma.post,
  Comment: prisma.comment,
  Tag: prisma.tag,
  Category: prisma.category,
  Profile: prisma.profile,
  Tagone: prisma.tagone
};

// Custom configs for all models
const userConfig = {
  validation: {
    create: async (data) => {
      if (!data.email) return { isValid: false, message: "Email is required" };
      return { isValid: true };
    }
  },
  beforeActions: {
    create: async (data) => {
      data.createdAt = new Date();
      data.updatedAt = new Date();
    }
  }
};
const postConfig = {
  validation: {
    create: async (data) => {
      if (!data.title) return { isValid: false, message: "Title is required" };
      return { isValid: true };
    }
  },
  beforeActions: {
    create: async (data) => {
      data.createdAt = new Date();
    }
  }
};
const commentConfig = {
  validation: {
    create: async (data) => {
      if (!data.content) return { isValid: false, message: "Content is required" };
      return { isValid: true };
    }
  },
  beforeActions: {
    create: async (data) => {
      data.createdAt = new Date();
    }
  }
};
const tagConfig = {
  validation: {
    create: async (data) => {
      if (!data.name) return { isValid: false, message: "Name is required" };
      return { isValid: true };
    }
  },
};
const categoryConfig = {
  validation: {
    create: async (data) => {
      if (!data.name) return { isValid: false, message: "Name is required" };
      return { isValid: true };
    }
  },
};
const profileConfig = {
  validation: {
    create: async (data) => {
      if (!data.bio) return { isValid: false, message: "Bio is required" };
      return { isValid: true };
    }
  },
};
const tagoneConfig = {
  validation: {
    create: async (data) => {
      if (!data.name) return { isValid: false, message: "name is required" };
      return { isValid: true };
    }
  }
};

const crudRouter = new PrismaCrudRouter(app, models, true, {
  version: "2.0.0",
  enableRelationAnalysis: true,
  enableConstraintChecking: true,
  enableCascadeHandling: true
});

// Manually register each model's CRUD route with its config
crudRouter.route('/api/user', prisma.user, userConfig);
crudRouter.route('/api/post', prisma.post, postConfig);
crudRouter.route('/api/comment', prisma.comment, commentConfig);
crudRouter.route('/api/tag', prisma.tag, tagConfig);
crudRouter.route('/api/category', prisma.category, categoryConfig);
crudRouter.route('/api/profile', prisma.profile, profileConfig);
crudRouter.route('/api/tagonew', prisma.tagone, tagoneConfig);

const fileHandler = new FileHandler({
  uploadDir: './uploads',
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxFileSize: 5 * 1024 * 1024, // 5MB
});


app.post('/api/upload', fileHandler.uploadMiddleware(), (req, res) => {
  const apiResponse = new Api_Response(process.env.NODE_ENV === 'development', '1.0.0');
  res.status(201).json(apiResponse.success('post', { files: req.uploadedFiles }, 'Files uploaded successfully'));
});


app.get('/api/routes', (req, res) => {
  const apiResponse = crudRouter.getApiResponse();
  const response = apiResponse.success('get', {
    basePath: '/api'
  });
  res.json(response);
});

// app.use((error, req, res, next) => {
//   console.error('Global error handler:', error);
  
//   const apiResponse = crudRouter.getApiResponse();
//   const errorResponse = apiResponse.error(
//     req.method.toLowerCase(),
//     null,
//     process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
//     error.status || 500
//   );
  
//   res.status(error.status || 500).json(errorResponse);
// });

// Enhanced multi-table configuration for PrismaCrudRouter
const userWithNestedConfig = {
  middleware: [fileHandler.uploadMiddleware()],
  enableNestedOperations: true,
  nestedModels: {
    create: ['profile', 'posts'], // Allow creating profile and posts with user
    update: ['profile'], // Allow updating profile with user
    delete: ['profile', 'posts'] // Delete profile and posts when user is deleted
  },
  validation: {
    create: async (data) => {
      if (!data.name) return { isValid: false, message: "Name is required" };
      if (!data.email) return { isValid: false, message: "Email is required" };
      return { isValid: true };
    }
  },
  beforeActions: {
    create: async (data) => {
      // Process uploaded files and add to profile data
      if (data.uploadedFiles && data.uploadedFiles.avatar) {
        if (!data.profile) data.profile = {};
        data.profile.avatarUrl = data.uploadedFiles.avatar[0].url;
      }
      data.createdAt = new Date();
      data.updatedAt = new Date();
    }
  },
  afterActions: {
    create: async (created) => {
      console.log('User created with nested data:', created);
    }
  }
};

// Register the enhanced multi-table route
crudRouter.route('/api/users-with-nested', prisma.user, userWithNestedConfig);

// Example of how to use the enhanced route:
// POST /api/users-with-nested
// {
//   "name": "John Doe",
//   "email": "john@example.com",
//   "age": 30,
//   "profile": {
//     "bio": "Software developer",
//     "contact": "john@example.com"
//   },
//   "posts": [
//     {
//       "title": "My First Post",
//       "content": "Hello World!"
//     }
//   ]
// }

const PORT = process.env.PORT || 3000;
app.listen(PORT);

module.exports = app;
