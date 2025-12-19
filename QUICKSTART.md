# Quick Start Guide - Multi-Tenant Authentication

## Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (or use SQLite for development)
- npm or yarn

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your database credentials
nano .env  # or use your preferred editor
```

### 3. Set Up Database

#### Option A: PostgreSQL (Recommended for Production)
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE dsscreen;
CREATE USER dsuser WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE dsscreen TO dsuser;
\q

# Update .env with your credentials
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dsscreen
DB_USER=dsuser
DB_PASSWORD=your_password
```

#### Option B: SQLite (Quick Development)
```bash
# Just set in .env:
DB_DIALECT=sqlite
# SQLite database will be created automatically
```

### 4. Run Migrations
```bash
npm run migrate:run
```

### 5. Start the Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will start on http://localhost:3000

## Testing the Authentication Flow

### Step 1: Register a User and Create a Company

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "companyName": "Acme Corporation",
    "companyDescription": "We make everything!"
  }'
```

Response will include a `tempToken` and company info.

### Step 2: Select the Company

```bash
# Replace YOUR_TEMP_TOKEN and YOUR_COMPANY_ID with values from Step 1
curl -X POST http://localhost:3000/api/auth/select-company \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEMP_TOKEN" \
  -d '{
    "companyId": "YOUR_COMPANY_ID"
  }'
```

Response will include `accessToken` and `refreshToken`.

### Step 3: Access Protected Endpoints

```bash
# Replace YOUR_ACCESS_TOKEN with token from Step 2
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Complete Login Flow Example

### 1. Login (for existing users)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

Response includes:
- `tempToken`: Use this to select a company
- `companies`: Array of companies the user has access to

### 2. Select Company

```bash
curl -X POST http://localhost:3000/api/auth/select-company \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEMP_TOKEN" \
  -d '{
    "companyId": "COMPANY_ID_FROM_LOGIN_RESPONSE"
  }'
```

Response includes:
- `accessToken`: Use for all API calls
- `refreshToken`: Use to get new access tokens

### 3. Make API Calls

```bash
# Get current user info with company context
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get all companies user has access to
curl -X GET http://localhost:3000/api/auth/companies \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Switch Company (if user belongs to multiple companies)

```bash
curl -X POST http://localhost:3000/api/auth/switch-company \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "companyId": "DIFFERENT_COMPANY_ID"
  }'
```

Response includes new `accessToken` and `refreshToken` with the new company context.

### 5. Refresh Access Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### 6. Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Mobile App Integration Flow

### Registration/Login Flow
```
1. User opens app
2. User enters email/password
3. App calls POST /api/auth/login
4. Server returns tempToken and list of companies
5. App shows company selection screen
6. User selects a company
7. App calls POST /api/auth/select-company with tempToken
8. Server returns accessToken and refreshToken
9. App stores tokens securely (Keychain/Keystore)
10. User proceeds to main app
```

### Subsequent App Opens
```
1. User opens app
2. App checks for stored accessToken
3. If valid, user proceeds to main app
4. If expired, app uses refreshToken to get new accessToken
5. If refreshToken expired, user must login again
```

### API Requests
```
All API requests include:
Headers: {
  "Authorization": "Bearer <accessToken>",
  "Content-Type": "application/json"
}
```

### Switching Companies
```
1. User wants to switch company
2. App calls GET /api/auth/companies (shows available companies)
3. User selects different company
4. App calls POST /api/auth/switch-company
5. Server returns new tokens with new company context
6. App replaces old tokens with new ones
7. App refreshes UI with new company context
```

## API Endpoints Summary

### Public Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login existing user

### Semi-Protected (Requires tempToken)
- `POST /api/auth/select-company` - Select company after login

### Protected (Requires accessToken)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/companies` - Get user's companies
- `POST /api/auth/switch-company` - Switch to different company
- `POST /api/auth/refresh` - Refresh access token

## Adding Protected Routes

### Example: Create a Protected Endpoint

```javascript
// routes/products.js
const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/jwtAuth');

// All users in company can view products
router.get('/', verifyToken, async (req, res) => {
  // req.company contains the company context
  // req.user contains the user info
  // req.userCompany contains role and permissions
  
  const products = await getProductsForCompany(req.company.id);
  res.json({ success: true, data: products });
});

// Only owners and admins can create products
router.post('/', verifyToken, requireRole('owner', 'admin'), async (req, res) => {
  const product = await createProduct({
    ...req.body,
    companyId: req.company.id // Company context from token
  });
  res.json({ success: true, data: product });
});

module.exports = router;
```

### Register the Route in index.js

```javascript
// index.js
const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);
```

## Security Checklist

- [ ] Changed JWT_SECRET in .env
- [ ] Changed SESSION_SECRET in .env
- [ ] Set up strong database password
- [ ] .env file is in .gitignore
- [ ] Using HTTPS in production
- [ ] Set secure: true in cookie options for production
- [ ] Implemented rate limiting on auth endpoints
- [ ] Set up proper CORS configuration
- [ ] Database is not publicly accessible
- [ ] Logs don't contain sensitive information

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Verify database connection in .env
- Run `npm install` to ensure all dependencies are installed

### Database connection fails
- Verify database is running: `psql -U postgres -h localhost`
- Check credentials in .env match database
- For PostgreSQL, ensure user has proper permissions
- For SQLite, ensure directory exists for database file

### Migrations fail
- Check database connection first
- Ensure migrations haven't already run: `npm run migrate:status`
- Try rolling back: `npm run migrate:undo`
- Check migration files for syntax errors

### Token errors
- Ensure JWT_SECRET is set in .env
- Check if token has expired (verify expiry times)
- Ensure "Bearer " prefix is included in Authorization header
- Verify token type matches endpoint requirements

### "Access denied" errors
- Check if user has access to the company
- Verify user's role has required permissions
- Ensure UserCompany relationship is active

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| PORT | Server port | 3000 | No |
| NODE_ENV | Environment mode | development | No |
| DB_DIALECT | Database type (postgres/sqlite) | postgres | Yes |
| DB_HOST | Database host | localhost | Yes (postgres) |
| DB_PORT | Database port | 5432 | Yes (postgres) |
| DB_NAME | Database name | dsscreen | Yes |
| DB_USER | Database user | dsuser | Yes (postgres) |
| DB_PASSWORD | Database password | - | Yes (postgres) |
| SESSION_SECRET | Session secret key | - | Yes |
| JWT_SECRET | JWT signing secret | - | Yes |
| JWT_ACCESS_EXPIRY | Access token duration | 24h | No |
| JWT_REFRESH_EXPIRY | Refresh token duration | 7d | No |

## Next Steps

1. ✅ Complete this quick start guide
2. 📝 Add your business logic endpoints
3. 📝 Implement role-based permissions for features
4. 📝 Add company management endpoints (invite users, etc.)
5. 📝 Integrate with your mobile app
6. 📝 Set up production database
7. 📝 Configure production environment
8. 📝 Deploy to server

## Getting Help

- See [AUTHENTICATION.md](./AUTHENTICATION.md) for detailed documentation
- Check migrations in `migrations/` folder for database schema
- Review middleware in `middleware/jwtAuth.js` for auth logic
- Review routes in `routes/auth.js` for endpoint implementations

## Production Deployment Checklist

- [ ] Use environment-specific .env files
- [ ] Set strong, random JWT_SECRET
- [ ] Use PostgreSQL (not SQLite)
- [ ] Enable HTTPS/SSL
- [ ] Set cookie secure flag to true
- [ ] Implement rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure CORS properly
- [ ] Set up database backups
- [ ] Use process manager (PM2, systemd)
- [ ] Set up reverse proxy (nginx)
- [ ] Implement token blacklist for logout (optional)
- [ ] Set up error tracking (Sentry, etc.)

