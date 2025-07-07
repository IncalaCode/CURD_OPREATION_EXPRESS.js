# CURD_Operation Project

## Overview

This project provides a robust, auto-generated CRUD (Create, Read, Update, Delete) API for a set of related models using [Prisma ORM](https://www.prisma.io/) and Express.js. It supports advanced features like nested create/update, relation detection, and custom middleware, making it easy to build scalable REST APIs for relational data.

---

## Features

### CRUD Endpoints
- **Auto-generated CRUD endpoints** for all Prisma models.
- Example: `GET /api/user`, `POST /api/post`, etc.

### Nested Create/Update/Delete
- **Nested create/update/delete** for related data (e.g., create a user with posts and profile in one request).
- Example:
  ```json
  {
    "name": "John",
    "email": "john@example.com",
    "profile": { "bio": "Developer" },
    "posts": [
      { "title": "Post 1", "content": "Content 1" },
      { "title": "Post 2", "content": "Content 2" }
    ]
  }
  ```

### Automatic Relation Detection
- **Automatic detection** of single (object) and bulk (array) relations in request data.
- No manual config needed for nested relations.

### Custom Middleware & Plugin Support
- **Add authentication, logging, or any Express middleware** globally or per-route.
- **Plugin system** for extending router functionality.
- Example:
  ```js
  router.route('/api/user', prisma.user, {
    middleware: [authMiddleware, loggerMiddleware],
    plugins: [myPlugin]
  });
  ```

### Constraint & Cascade Handling
- **Handles foreign keys, required fields, and cascade delete/update** automatically.
- Prevents constraint violations and ensures referential integrity.

### Standardized API Responses
- **Consistent success/error format** for all endpoints.
- Example success:
  ```json
  { "success": true, "type": "ok", "method": "POST", "data": { ... } }
  ```
- Example error:
  ```json
  { "success": false, "type": "error", "message": "Validation failed" }
  ```

### Error Handling
- **Handles Prisma errors, validation errors, and custom errors**.
- Returns clear error messages and status codes.

### File Upload Support
- **Upload images, PDFs, and other files** using the built-in FileHandler.
- Files are organized by type and date.
- Example:
  ```js
  app.post('/api/upload', fileHandler.uploadMiddleware(), (req, res) => {
    res.json({ files: req.uploadedFiles });
  });
  ```

### Flexible Route Configuration
- **Validation, before/after hooks, and custom actions** per route.
- Example:
  ```js
  router.route('/api/user', prisma.user, {
    validation: {
      create: async (data) => {
        if (!data.email) return { isValid: false, message: "Email is required" };
        return { isValid: true };
      }
    },
    beforeActions: {
      create: async (data) => { data.createdAt = new Date(); }
    },
    afterActions: {
      create: async (created) => { console.log('User created:', created); }
    }
  });
  ```

### Pagination, Filtering, and Ordering
- **Built-in support for pagination, filtering, and ordering** on list endpoints.
- Example:
  - `GET /api/user?limit=10&offset=20&order=[["createdAt","desc"]]`
  - `GET /api/user?filter={"role":"admin"}`

### Role-Based Access & Middleware
- **Add role checks or authentication middleware** to any route.
- Example:
  ```js
  router.route('/api/admin', prisma.user, {
    middleware: [adminAuthMiddleware]
  });
  ```

### Transaction Safety
- **Nested and multi-table operations** are handled safely by Prisma's built-in transaction support.

### Extensibility
- **Easily add new models, relations, or custom logic** by updating your Prisma schema and route configs.

### Logging & Debug Support
- **Optional logging and debug output** for development and troubleshooting.
- Example: Enable debug logs in development mode.

### TypeScript/JavaScript Compatibility
- **Works with both TypeScript and JavaScript** projects.
- Type definitions provided by Prisma.

### React Admin & Frontend Integration
- **API response format is compatible with [React Admin](https://marmelab.com/react-admin/)** and other frontend frameworks.
- Example: Use `/api/user` as a data provider endpoint in React Admin.

### Example Usage & Test Coverage
- **Example app** in `example/app.js` shows how to set up and use the router.
- **Test suite** in `tests/` for core features and integration.

---

## Getting Started

### 1. Clone & Install

```bash
# Clone the repo
$ git clone <your-repo-url>
$ cd CURD_Operation

# Install dependencies
$ npm install
```

### 2. Setup Prisma & Database

- Edit `example/prisma/schema.prisma` to adjust your models if needed.
- Run migrations:

```bash
$ npx prisma migrate dev --name init
```

- Generate the Prisma client:

```bash
$ npx prisma generate
```

### 3. Run the Example App

```bash
$ node example/app.js
```

The API will be available at `http://localhost:3000/api/` (or your configured port).

---

## Data Model Overview

### User
- `id` (Int, PK)
- `name` (String, required)
- `email` (String, required, unique)
- `role` (String, default: "user")
- `createdAt`, `updatedAt` (DateTime)
- **Relations:**
  - `profile` (Profile, optional, 1:1)
  - `posts` (Post[], 1:N)
  - `comments` (Comment[], 1:N)

### Profile
- `id` (Int, PK)
- `bio` (String, optional)
- `avatar` (String, optional)
- `userId` (Int, unique, FK to User)

### Post
- `id` (Int, PK)
- `title` (String, required)
- `content` (String, required)
- `published` (Boolean, default: false)
- `authorId` (Int, FK to User)
- **Relations:**
  - `author` (User, N:1)
  - `comments` (Comment[], 1:N)
  - `tags` (Tag[], M:N)

### Comment
- `id` (Int, PK)
- `content` (String, required)
- `authorId` (Int, FK to User)
- `postId` (Int, FK to Post)

### Tag
- `id` (Int, PK)
- `name` (String, required, unique)
- `color` (String, default: "#000000")
- **Relations:**
  - `posts` (Post[], M:N)

---

## Example: Nested Create (User with Posts and Profile)

**Request:**

```json
POST /api/user
Content-Type: application/json

{
  "name": "John",
  "email": "john@example.com",
  "profile": { "bio": "Developer" },
  "posts": [
    { "title": "Post 1", "content": "Content 1" },
    { "title": "Post 2", "content": "Content 2" }
  ]
}
```

**What happens:**
- A new user is created.
- The profile is created and linked to the user.
- Each post is created and automatically linked to the user (no need to specify `authorId`).

---

## File Uploads
- Use the built-in `FileHandler` for file uploads (images, PDFs, etc.).
- Files are organized by type and date.
- Example:
  ```js
  app.post('/api/upload', fileHandler.uploadMiddleware(), (req, res) => {
    res.json({ files: req.uploadedFiles });
  });
  ```
- Integrate with CRUD routes by adding the middleware to route config.

---

## Plugins & Middleware
- Add any Express middleware (auth, logging, etc.) globally or per-route.
- Use plugins to extend router functionality.
- Example:
  ```js
  router.route('/api/user', prisma.user, {
    middleware: [authMiddleware, loggerMiddleware],
    plugins: [myPlugin]
  });
  ```

---

## Pagination, Filtering, and Ordering
- Use `limit`, `offset`, `order`, and `filter` query params on list endpoints.
- Example:
  - `GET /api/user?limit=10&offset=20&order=[["createdAt","desc"]]`
  - `GET /api/user?filter={"role":"admin"}`

---

## Role-Based Access
- Add role checks or authentication middleware to any route.
- Example:
  ```js
  router.route('/api/admin', prisma.user, {
    middleware: [adminAuthMiddleware]
  });
  ```

---

## Transaction Safety
- Nested and multi-table operations are handled safely by Prisma's built-in transaction support.

---

## Logging & Debug
- Enable debug output in development mode for troubleshooting.
- Example: `console.log` statements in hooks or middleware.

---

## TypeScript/JavaScript Usage
- Works with both TypeScript and JavaScript projects.
- Type definitions provided by Prisma.

---

## React Admin & Frontend Integration
- API response format is compatible with [React Admin](https://marmelab.com/react-admin/) and other frontend frameworks.
- Example: Use `/api/user` as a data provider endpoint in React Admin.

---

## Example Usage & Testing
- Example app in `example/app.js` shows how to set up and use the router.
- Test suite in `tests/` for core features and integration.

---

## Required Fields & Nested Relations

- **All required fields** (e.g., `title`, `content` for Post) must be provided in nested objects.
- **Nested relations** (e.g., `profile`, `posts`) are automatically handled if you use the correct structure.
- **You do NOT need to provide foreign keys** (e.g., `authorId`) when using nested create under a parent (Prisma sets them for you).

---

## Troubleshooting

- **Missing required field error:**
  - Make sure all required fields for each model are present in your request.
- **Unknown argument error:**
  - Check that you are not sending extra fields or relations that don't exist in the schema.
- **Nested create not working:**
  - Ensure you are using the correct nested structure (see example above).
- **Prisma errors:**
  - Check the error message for missing fields, unique constraint violations, or invalid relations.

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

## License

MIT
