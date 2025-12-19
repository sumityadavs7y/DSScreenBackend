# Multi-Tenant Authentication System

## Overview

This backend implements a comprehensive multi-tenant authentication system where:
- Multiple companies can sign up for the product
- A user can be part of multiple companies
- Users log in once, then select which company context to work in
- All subsequent API calls maintain the company context securely via JWT tokens

## Architecture

### Database Models

1. **User** (`users` table)
   - Stores user account information
   - Passwords are hashed using bcrypt
   - Fields: id, email, password, firstName, lastName, phoneNumber, isActive, lastLoginAt

2. **Company** (`companies` table)
   - Stores company/organization information
   - Each company has a unique slug
   - Fields: id, name, slug, description, logo, website, email, phoneNumber, address, isActive, settings

3. **UserCompany** (`user_companies` table)
   - Join table linking users to companies
   - Defines user's role and permissions within each company
   - Roles: owner, admin, manager, member, viewer
   - Fields: id, userId, companyId, role, permissions, isActive, joinedAt

### Authentication Flow

#### 1. Registration Flow

```
POST /api/auth/register
Body: {
  email, password, firstName, lastName, phoneNumber (optional),
  companyName (optional), companyDescription (optional)
}

Response: {
  user: {...},
  company: {...} (if created),
  tempToken: "..." (temporary token, expires in 15 minutes)
}
```

- If `companyName` is provided, a new company is created and the user is assigned as 'owner'
- Returns a temporary token for company selection

#### 2. Login Flow

```
POST /api/auth/login
Body: { email, password }

Response: {
  user: {...},
  companies: [{id, name, slug, logo, role}, ...],
  tempToken: "..." (temporary token, expires in 15 minutes)
}
```

- Returns list of all companies the user has access to
- Returns a temporary token for company selection

#### 3. Company Selection Flow

```
POST /api/auth/select-company
Headers: { Authorization: "Bearer <tempToken>" }
Body: { companyId }

Response: {
  user: {...},
  company: {...},
  role: "...",
  permissions: {...},
  accessToken: "..." (expires in 24 hours),
  refreshToken: "..." (expires in 7 days)
}
```

- User selects which company to work with
- Server returns full access token with company context embedded
- The company context is securely stored within the JWT token

#### 4. Using the API with Company Context

```
GET/POST/PUT/DELETE /api/any-endpoint
Headers: { Authorization: "Bearer <accessToken>" }
```

- All protected endpoints use the `verifyToken` middleware
- The middleware extracts and validates:
  - User ID
  - Company ID (from token, not from request body)
  - User's role in that company
  - User's permissions in that company
- The company context is automatically available in `req.company`, `req.user`, `req.userCompany`

### Token Types

1. **Temporary Token** (`type: 'temp'`)
   - Expires in 15 minutes
   - Used after login/registration
   - Only valid for `/api/auth/select-company` endpoint
   - Contains: userId

2. **Access Token** (`type: 'access'`)
   - Expires in 24 hours (configurable)
   - Used for all API calls
   - Contains: userId, companyId, role
   - Company context is embedded and signed

3. **Refresh Token** (`type: 'refresh'`)
   - Expires in 7 days (configurable)
   - Used to get new access tokens
   - Contains: userId, companyId

## API Endpoints

### Public Endpoints (No Authentication Required)

#### 1. Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "companyName": "Acme Corp",
  "companyDescription": "Description of the company"
}
```

#### 2. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Semi-Protected Endpoints (Require Temporary Token)

#### 3. Select Company
```http
POST /api/auth/select-company
Authorization: Bearer <tempToken>
Content-Type: application/json

{
  "companyId": "uuid-of-company"
}
```

### Protected Endpoints (Require Access Token)

#### 4. Logout
```http
POST /api/auth/logout
Authorization: Bearer <accessToken>
```

#### 5. Get Current User Info
```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

Returns current user info with company context.

#### 6. Get User's Companies
```http
GET /api/auth/companies
Authorization: Bearer <accessToken>
```

Returns all companies the user has access to.

#### 7. Switch Company
```http
POST /api/auth/switch-company
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "companyId": "uuid-of-different-company"
}
```

Returns new access and refresh tokens with the new company context.

#### 8. Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

Returns a new access token.

## Security Features

### 1. Password Security
- Passwords are hashed using bcrypt with a salt factor of 10
- Passwords are never returned in API responses
- `User.toSafeObject()` method strips password before sending

### 2. Company Context Security
- Company ID is embedded in JWT token payload
- Company context cannot be manipulated by client
- Server always extracts company from verified token, never from request parameters
- Each API call validates:
  - User exists and is active
  - Company exists and is active
  - User has active access to that company

### 3. Token Security
- JWT tokens are signed with a secret key
- Tokens have expiration times
- Different token types for different purposes
- Token type is validated on each request

### 4. Role-Based Access Control
- Each user has a specific role in each company
- Roles: owner > admin > manager > member > viewer
- Use `requireRole()` middleware to restrict endpoints:

```javascript
const { verifyToken, requireRole } = require('../middleware/jwtAuth');

// Only owners and admins can access this endpoint
router.delete('/api/company/settings', 
  verifyToken, 
  requireRole('owner', 'admin'), 
  async (req, res) => {
    // Handler code
  }
);
```

## Middleware Usage

### 1. verifyToken
Validates access token and extracts company context:
```javascript
const { verifyToken } = require('../middleware/jwtAuth');

router.get('/api/protected', verifyToken, async (req, res) => {
  // Access req.user, req.company, req.userCompany, req.tokenPayload
  res.json({ company: req.company.name });
});
```

### 2. verifyTempToken
Validates temporary token (used after login):
```javascript
const { verifyTempToken } = require('../middleware/jwtAuth');

router.post('/api/auth/select-company', verifyTempToken, async (req, res) => {
  // Access req.user, req.tokenPayload
});
```

### 3. requireRole
Restricts access based on user's role in company:
```javascript
const { verifyToken, requireRole } = require('../middleware/jwtAuth');

router.post('/api/company/invite', 
  verifyToken, 
  requireRole('owner', 'admin'), 
  async (req, res) => {
    // Only owners and admins can access
  }
);
```

### 4. optionalAuth
Adds auth context if token is provided, but doesn't fail if missing:
```javascript
const { optionalAuth } = require('../middleware/jwtAuth');

router.get('/api/public/products', optionalAuth, async (req, res) => {
  // req.user and req.company may or may not be present
  if (req.company) {
    // Show company-specific products
  } else {
    // Show public products
  }
});
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
ENV_MODE=development
NODE_ENV=development

# Database Configuration
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dsscreen
DB_USER=dsuser
DB_PASSWORD=your_secure_password_here

# Session Secret (for express-session, if still used)
SESSION_SECRET=your-session-secret-key-change-in-production

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-change-in-production-make-it-long-and-random
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d
```

**Important:** 
- Change `JWT_SECRET` to a strong, random string in production
- Never commit `.env` file to version control
- Use different secrets for development and production

### Token Expiry Times

Adjust in `config.js`:
- `accessTokenExpiry`: How long access tokens are valid (default: 24h)
- `refreshTokenExpiry`: How long refresh tokens are valid (default: 7d)
- `tempTokenExpiry`: How long temporary tokens are valid (fixed: 15m)

## Database Setup

### 1. Create Database

For PostgreSQL:
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE dsscreen;
CREATE USER dsuser WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE dsscreen TO dsuser;
\q
```

For SQLite (Development):
```env
DB_DIALECT=sqlite
```

### 2. Run Migrations

```bash
npm run migrate:run
```

This will create three tables:
- `users`
- `companies`
- `user_companies`

## Example Client Implementation

### JavaScript/TypeScript Client

```javascript
class AuthClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.tempToken = null;
    this.accessToken = null;
    this.refreshToken = null;
  }

  // Step 1: Register or Login
  async login(email, password) {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    this.tempToken = data.data.tempToken;
    return data.data.companies; // Return list of companies
  }

  // Step 2: Select Company
  async selectCompany(companyId) {
    const response = await fetch(`${this.baseURL}/api/auth/select-company`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.tempToken}`,
      },
      body: JSON.stringify({ companyId }),
    });
    
    const data = await response.json();
    this.accessToken = data.data.accessToken;
    this.refreshToken = data.data.refreshToken;
    this.tempToken = null; // Clear temp token
    
    // Store tokens securely (e.g., secure storage on mobile)
    return data.data;
  }

  // Step 3: Make API Calls
  async makeRequest(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle token expiration
    if (response.status === 401) {
      // Try to refresh token
      await this.refreshAccessToken();
      // Retry request
      return this.makeRequest(endpoint, options);
    }

    return response.json();
  }

  // Refresh access token
  async refreshAccessToken() {
    const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
    
    const data = await response.json();
    this.accessToken = data.data.accessToken;
  }

  // Switch company
  async switchCompany(companyId) {
    const data = await this.makeRequest('/api/auth/switch-company', {
      method: 'POST',
      body: JSON.stringify({ companyId }),
    });
    
    this.accessToken = data.data.accessToken;
    this.refreshToken = data.data.refreshToken;
    return data.data;
  }

  // Logout
  async logout() {
    await this.makeRequest('/api/auth/logout', { method: 'POST' });
    this.accessToken = null;
    this.refreshToken = null;
    this.tempToken = null;
  }
}

// Usage
const client = new AuthClient('http://localhost:3000');

// Login flow
const companies = await client.login('user@example.com', 'password123');
console.log('Available companies:', companies);

// Select company
await client.selectCompany(companies[0].id);

// Make authenticated requests
const userData = await client.makeRequest('/api/auth/me');
console.log('Current user:', userData);
```

## Mobile App Integration

### React Native Example

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthService {
  static async storeTokens(accessToken, refreshToken) {
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken],
    ]);
  }

  static async getAccessToken() {
    return await AsyncStorage.getItem('accessToken');
  }

  static async clearTokens() {
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
  }

  // ... rest of the implementation
}
```

## Testing

### Manual Testing with cURL

#### 1. Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "companyName": "Test Company"
  }'
```

#### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### 3. Select Company
```bash
curl -X POST http://localhost:3000/api/auth/select-company \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEMP_TOKEN" \
  -d '{
    "companyId": "YOUR_COMPANY_ID"
  }'
```

#### 4. Get User Info
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Best Practices

1. **Token Storage**
   - Mobile: Use secure storage (iOS Keychain, Android Keystore)
   - Web: Use httpOnly cookies or secure storage libraries
   - Never store tokens in localStorage on web (XSS vulnerability)

2. **Token Refresh**
   - Implement automatic token refresh before expiration
   - Handle 401 errors gracefully by refreshing and retrying

3. **Company Context**
   - Always extract company from `req.company`, never from request body
   - Validate user has access to company on every request
   - Never trust client-provided company ID

4. **Error Handling**
   - Return consistent error responses
   - Don't leak sensitive information in error messages
   - Log errors server-side for debugging

5. **Rate Limiting**
   - Implement rate limiting on auth endpoints
   - Prevent brute force attacks on login

6. **HTTPS**
   - Always use HTTPS in production
   - Set secure cookie flags in production

## Troubleshooting

### "Invalid token" errors
- Check if token has expired
- Verify JWT_SECRET is the same on all server instances
- Ensure client is sending "Bearer " prefix

### "Access denied" errors
- Verify user has access to the company
- Check if user's role has required permissions
- Ensure userCompany relationship is active

### Database connection issues
- Verify database credentials in .env
- Ensure database server is running
- Check network connectivity

## Next Steps

To use this authentication system:

1. ✅ Set up environment variables in `.env`
2. ✅ Run database migrations
3. ✅ Test the registration endpoint
4. ✅ Test the login flow
5. ✅ Integrate with your mobile app
6. 📝 Add additional endpoints using the middleware
7. 📝 Implement role-based permissions for your features
8. 📝 Add company invite/management endpoints
9. 📝 Add password reset functionality

## Support

For questions or issues, refer to:
- API documentation
- Database schema in migrations
- Middleware implementation in `middleware/jwtAuth.js`
- Route handlers in `routes/auth.js`

