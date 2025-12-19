# dsScreen Backend

Backend infrastructure setup with database configuration and basic authentication middleware.

## Features

- Express.js server setup
- Sequelize ORM with PostgreSQL/SQLite support
- Database migrations using Umzug
- JWT-based authentication with company context
- Multi-company support with role-based access control
- **Video upload system with company-specific folders**
- Environment-based configuration
- Comprehensive middleware for authentication and authorization

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure your database settings in `.env` file

4. Run migrations:
```bash
npm run migrate
```

5. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Available Scripts

- `npm start` - Start the server
- `npm run dev` - Start the server in development mode with nodemon
- `npm run migrate` - Run all pending migrations
- `npm run migrate:undo` - Rollback last migration
- `npm run migrate:status` - Check migration status
- `npm run migrate:create -- <name>` - Create a new migration file

## Project Structure

```
dsScreenBackend/
├── config/              # Configuration files
│   └── database.js      # Database configuration
├── middleware/          # Express middlewares
│   └── auth.js          # Authentication middleware
├── migrations/          # Database migrations
├── models/              # Sequelize models
│   ├── index.js         # Models index
│   └── sequelize.js     # Sequelize setup
├── routes/              # Express routes
│   └── index.js         # Main routes
├── utils/               # Utility functions
│   ├── helpers.js       # Helper functions
│   └── migrate.js       # Migration utilities
├── views/               # EJS templates
├── public/              # Static files
├── .env.example         # Environment variables example
├── .sequelizerc         # Sequelize CLI configuration
├── config.js            # Main configuration
├── index.js             # Entry point
└── package.json         # Dependencies
```

## Database Configuration

The application supports both PostgreSQL and SQLite:

### PostgreSQL (Default)
```env
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dsscreen
DB_USER=dsuser
DB_PASSWORD=your-password
```

### SQLite (Development)
```env
DB_DIALECT=sqlite
```

## Video Upload System

The application includes a comprehensive video upload and management system with company-specific storage:

### Features
- ✅ Company-isolated video storage (each company has its own folder)
- ✅ Automatic folder creation on first upload
- ✅ File metadata stored in database
- ✅ Smart duplicate handling with auto-numbering (e.g., "Video (1)", "Video (2)")
- ✅ Role-based access control
- ✅ Automatic cleanup on deletion
- ✅ File size limit: 500MB (configurable)
- ✅ Video-only file validation

### Quick Start

**Test Page**: Visit `http://localhost:3000/video-upload-test.html` for a web-based test interface.

**Upload a Video**:
```bash
curl -X POST http://localhost:3000/api/videos/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "video=@/path/to/video.mp4" \
  -F "displayName=My Video"
```

**List Videos**:
```bash
curl http://localhost:3000/api/videos \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Download/Stream a Video**:
```bash
curl http://localhost:3000/api/videos/VIDEO_ID/download \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -o video.mp4
```

**Delete a Video**:
```bash
curl -X DELETE http://localhost:3000/api/videos/VIDEO_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Bulk Delete Videos**:
```bash
curl -X POST http://localhost:3000/api/videos/bulk-delete \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"videoIds":["ID1","ID2","ID3"]}'
```

### Documentation
- **[VIDEO_UPLOAD_GUIDE.md](./VIDEO_UPLOAD_GUIDE.md)** - Complete guide with examples
- **[VIDEO_API_QUICK_REFERENCE.md](./VIDEO_API_QUICK_REFERENCE.md)** - Quick reference
- **[VIDEO_IMPLEMENTATION_SUMMARY.md](./VIDEO_IMPLEMENTATION_SUMMARY.md)** - Implementation details

## Middleware

### Authentication Middleware

- `verifyToken` - Verify JWT token and extract user/company context
- `verifyTempToken` - Verify temporary token (before company selection)
- `requireRole(...roles)` - Require specific roles for access
- `optionalAuth` - Optional authentication (doesn't fail if token missing)

### Legacy Middleware
- `isAuthenticated` - Check if user is logged in (session-based)
- `isAdmin` - Check if user is admin (session-based)
- `redirectIfAuthenticated` - Redirect logged-in users to dashboard

## Adding Models

1. Create a new model file in `models/` directory
2. Import and define relationships in `models/index.js`
3. Create a migration file using `npm run migrate:create -- <name>`
4. Define the schema in the migration file
5. Run migrations using `npm run migrate`

## License

ISC

