require('dotenv').config();
const path = require('path');

module.exports = {
  development: {
    dialect: process.env.DB_DIALECT || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'dsscreen',
    username: process.env.DB_USER || 'dsuser',
    password: process.env.DB_PASSWORD,
    storage: process.env.DB_DIALECT === 'sqlite' ? path.join(__dirname, '../database/app.db') : undefined,
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    dialect: process.env.DB_DIALECT || 'sqlite',
    storage: ':memory:',
    logging: false
  },
  production: {
    dialect: process.env.DB_DIALECT || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'dsscreen',
    username: process.env.DB_USER || 'dsuser',
    password: process.env.DB_PASSWORD,
    storage: process.env.DB_DIALECT === 'sqlite' ? path.join(__dirname, '../database/app.db') : undefined,
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: process.env.DB_DIALECT === 'postgres' ? {
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    } : undefined
  }
};

