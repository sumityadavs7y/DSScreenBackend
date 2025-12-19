# Environment Setup Guide

## Creating Your .env File

The application requires a `.env` file in the root directory to configure database connections and authentication secrets.

### Step 1: Create .env File

Create a new file named `.env` in the root directory of the project:

```bash
touch .env
```

### Step 2: Add Configuration

Copy and paste the following into your `.env` file and update the values:

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=3000
ENV_MODE=development
NODE_ENV=development

# ============================================
# DATABASE CONFIGURATION
# ============================================

# Option 1: PostgreSQL (Recommended for Production)
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dsscreen
DB_USER=dsuser
DB_PASSWORD=your_secure_password_here

# Option 2: SQLite (Quick Development)
# Uncomment line below and comment out PostgreSQL settings above
# DB_DIALECT=sqlite

# ============================================
# SESSION SECRET
# ============================================
# Used for express-session
SESSION_SECRET=dsscreen-secret-key-2024-change-in-production

# ============================================
# JWT CONFIGURATION
# ============================================
# IMPORTANT: Change JWT_SECRET in production to a long random string!
# Generate using: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

JWT_SECRET=dsscreen-jwt-secret-key-2024-change-in-production-make-it-long-and-random

# JWT Token Expiration Times
# Format: https://github.com/vercel/ms
# Examples: 60, "2 days", "10h", "7d"
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d
```

## Database Setup

### PostgreSQL Setup

#### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS (using Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

#### 2. Create Database and User

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Or on macOS/Windows
psql -U postgres
```

In the PostgreSQL console:
```sql
-- Create database
CREATE DATABASE dsscreen;

-- Create user with password
CREATE USER dsuser WITH PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE dsscreen TO dsuser;

-- For PostgreSQL 15+, you may also need:
\c dsscreen
GRANT ALL ON SCHEMA public TO dsuser;

-- Exit
\q
```

#### 3. Update .env File

Make sure your `.env` file has:
```env
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dsscreen
DB_USER=dsuser
DB_PASSWORD=your_secure_password_here
```

### SQLite Setup (Development Only)

For quick development without setting up PostgreSQL:

#### 1. Update .env File

```env
DB_DIALECT=sqlite
```

That's it! The SQLite database file will be created automatically at `./database/app.db`

**Note:** SQLite is not recommended for production use.

## Security Configuration

### Generate Secure Secrets

#### For JWT_SECRET and SESSION_SECRET:

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Using OpenSSL:**
```bash
openssl rand -hex 64
```

**Using Python:**
```bash
python -c "import secrets; print(secrets.token_hex(64))"
```

Copy the generated string and use it for `JWT_SECRET` and `SESSION_SECRET` in your `.env` file.

### Production Security Checklist

- [ ] Change `JWT_SECRET` to a strong random string (at least 64 characters)
- [ ] Change `SESSION_SECRET` to a different random string
- [ ] Use a strong database password (at least 16 characters, mixed case, numbers, symbols)
- [ ] Set `NODE_ENV=production`
- [ ] Never commit `.env` file to version control (it's in `.gitignore`)
- [ ] Use different secrets for development and production
- [ ] Keep your `.env` file secure (chmod 600 on Unix systems)

```bash
# Secure your .env file
chmod 600 .env
```

## Running Migrations

After setting up your database and `.env` file, run migrations to create tables:

```bash
npm run migrate:run
```

This will create three tables:
- `users` - User accounts
- `companies` - Company/organization data
- `user_companies` - Links users to companies with roles

## Verifying Setup

### 1. Test Database Connection

Start the server:
```bash
npm run dev
```

You should see:
```
🚀 Starting Server...
✅ Database connection established
✅ Migrations completed
✅ Server is running on port 3000
```

### 2. Test Health Endpoint

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-..."
}
```

### 3. Test Registration

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

If you get a successful response with a `tempToken`, your setup is complete!

## Troubleshooting

### "Password authentication failed"

**Problem:** Database password is incorrect or user doesn't have proper permissions.

**Solutions:**
1. Verify password in `.env` matches the one you set in PostgreSQL
2. Reconnect to PostgreSQL and reset password:
   ```sql
   ALTER USER dsuser WITH PASSWORD 'new_password';
   ```
3. Grant permissions again:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE dsscreen TO dsuser;
   ```

### "Database does not exist"

**Problem:** Database hasn't been created yet.

**Solution:**
```sql
CREATE DATABASE dsscreen;
GRANT ALL PRIVILEGES ON DATABASE dsscreen TO dsuser;
```

### "Port 3000 already in use"

**Problem:** Another process is using port 3000.

**Solutions:**
1. Change port in `.env`: `PORT=3001`
2. Kill the process using port 3000:
   ```bash
   # Find process
   lsof -i :3000
   # Kill it
   kill -9 <PID>
   ```

### "Cannot connect to PostgreSQL"

**Problem:** PostgreSQL service is not running.

**Solutions:**

**Ubuntu/Debian:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql  # Start on boot
```

**macOS:**
```bash
brew services start postgresql
```

**Windows:**
Use Services app to start PostgreSQL service

### "JWT secret is not set"

**Problem:** `JWT_SECRET` is missing from `.env` file.

**Solution:**
Add to `.env`:
```env
JWT_SECRET=your_generated_secret_here
```

### Migration Errors

**Problem:** Migrations fail or tables already exist.

**Solutions:**

1. Check migration status:
   ```bash
   npm run migrate:status
   ```

2. Rollback last migration:
   ```bash
   npm run migrate:undo
   ```

3. Drop all tables and start fresh (⚠️ DANGER: Deletes all data):
   ```sql
   -- Connect to database
   psql -U dsuser -d dsscreen
   
   -- Drop tables
   DROP TABLE IF EXISTS user_companies CASCADE;
   DROP TABLE IF EXISTS users CASCADE;
   DROP TABLE IF EXISTS companies CASCADE;
   
   -- Exit and run migrations again
   \q
   ```

## Environment Variables Reference

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `PORT` | Number | 3000 | No | Server port |
| `NODE_ENV` | String | development | No | Environment (development/production) |
| `ENV_MODE` | String | production | No | Application mode |
| `DB_DIALECT` | String | postgres | Yes | Database type (postgres/sqlite) |
| `DB_HOST` | String | localhost | Yes* | Database host (*postgres only) |
| `DB_PORT` | Number | 5432 | Yes* | Database port (*postgres only) |
| `DB_NAME` | String | dsscreen | Yes | Database name |
| `DB_USER` | String | dsuser | Yes* | Database user (*postgres only) |
| `DB_PASSWORD` | String | - | Yes* | Database password (*postgres only) |
| `SESSION_SECRET` | String | (default) | Yes | Express session secret |
| `JWT_SECRET` | String | (default) | Yes | JWT signing secret |
| `JWT_ACCESS_EXPIRY` | String | 24h | No | Access token expiration |
| `JWT_REFRESH_EXPIRY` | String | 7d | No | Refresh token expiration |

## Next Steps

After completing environment setup:

1. ✅ Database is configured and running
2. ✅ `.env` file is created and configured
3. ✅ Migrations have been run successfully
4. ✅ Server starts without errors

**You're ready to start building!**

See:
- [QUICKSTART.md](./QUICKSTART.md) - Test the authentication flow
- [AUTHENTICATION.md](./AUTHENTICATION.md) - Full authentication documentation
- [routes/example.js](./routes/example.js) - Examples of protected routes

## Docker Setup (Optional)

If you prefer using Docker:

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: dsscreen
      POSTGRES_USER: dsuser
      POSTGRES_PASSWORD: your_secure_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DB_DIALECT: postgres
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: dsscreen
      DB_USER: dsuser
      DB_PASSWORD: your_secure_password
      JWT_SECRET: your_jwt_secret_here
      SESSION_SECRET: your_session_secret_here
    depends_on:
      - postgres
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  postgres_data:
```

Run with:
```bash
docker-compose up -d
```

## Production Deployment

For production environments:

### Environment Variables

```env
NODE_ENV=production
ENV_MODE=production

# Use production database
DB_DIALECT=postgres
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=dsscreen_production
DB_USER=dsuser_production
DB_PASSWORD=very_strong_production_password_here

# Use strong random secrets
JWT_SECRET=long_random_string_generated_securely
SESSION_SECRET=different_long_random_string

# Adjust token expiry as needed
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=30d
```

### Additional Production Setup

1. Use environment-specific `.env` files (e.g., `.env.production`)
2. Set up SSL/TLS for database connections
3. Use connection pooling for database
4. Set up monitoring and logging
5. Use a process manager (PM2, systemd)
6. Set up reverse proxy (nginx)
7. Configure firewall rules
8. Set up automated backups
9. Use secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
10. Enable rate limiting and DDoS protection

## Support

If you encounter issues not covered here:
1. Check the error logs
2. Review the troubleshooting section
3. Verify all environment variables are set correctly
4. Ensure database is running and accessible
5. Check file permissions on `.env` file

