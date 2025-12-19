exports.envConfig = {
    port: process.env.PORT || "3000",
    sessionSecret: process.env.SESSION_SECRET || 'dsscreen-secret-key-2024',
    envMode: process.env.ENV_MODE || 'production'
};

exports.jwtConfig = {
    secret: process.env.JWT_SECRET || 'dsscreen-jwt-secret-key-2024-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '24h', // Access token expires in 24 hours
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d', // Refresh token expires in 7 days
    tempTokenExpiry: '15m', // Temporary token for company selection expires in 15 minutes
};

exports.databaseConfig = {
    dialect: process.env.DB_DIALECT || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dsscreen',
    username: process.env.DB_USER || 'dsuser',
    password: process.env.DB_PASSWORD,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    // Fallback to SQLite if needed
    storage: process.env.DB_DIALECT === 'sqlite' ? './database/app.db' : undefined,
};

exports.storageConfig = {
    // Company storage limit in bytes (default: 500MB)
    companyStorageLimitBytes: parseInt(process.env.COMPANY_STORAGE_LIMIT_MB || '500') * 1024 * 1024,
    // Max file size for individual uploads in bytes (default: 500MB)
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_MB || '500') * 1024 * 1024,
};

