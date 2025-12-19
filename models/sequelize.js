const { Sequelize } = require('sequelize');
const { databaseConfig } = require('../config');

// Initialize Sequelize with PostgreSQL or SQLite
const sequelizeConfig = {
  dialect: databaseConfig.dialect,
  logging: databaseConfig.logging,
  define: {
    timestamps: true, // Adds createdAt and updatedAt fields
    underscored: false, // Use camelCase instead of snake_case
  },
};

// Add PostgreSQL specific configuration
if (databaseConfig.dialect === 'postgres') {
  sequelizeConfig.host = databaseConfig.host;
  sequelizeConfig.port = databaseConfig.port;
  sequelizeConfig.database = databaseConfig.database;
  sequelizeConfig.username = databaseConfig.username;
  sequelizeConfig.password = databaseConfig.password;
  sequelizeConfig.pool = databaseConfig.pool;
  
  // PostgreSQL specific options
  sequelizeConfig.dialectOptions = {
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  };
} else if (databaseConfig.dialect === 'sqlite') {
  // SQLite specific configuration
  sequelizeConfig.storage = databaseConfig.storage;
}

const sequelize = new Sequelize(sequelizeConfig);

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection has been established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
};

// NOTE: Database schema changes should be done through migrations
// DO NOT use sequelize.sync() in production as it can cause data loss
// Use migrations instead: npm run migrate

module.exports = {
  sequelize,
  Sequelize,
  testConnection
};

