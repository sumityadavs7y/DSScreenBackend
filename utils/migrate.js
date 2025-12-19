const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
const { databaseConfig } = require('../config');

// Create Sequelize instance
const sequelizeConfig = {
  dialect: databaseConfig.dialect,
  logging: databaseConfig.logging,
};

if (databaseConfig.dialect === 'postgres') {
  sequelizeConfig.host = databaseConfig.host;
  sequelizeConfig.port = databaseConfig.port;
  sequelizeConfig.database = databaseConfig.database;
  sequelizeConfig.username = databaseConfig.username;
  sequelizeConfig.password = databaseConfig.password;
  sequelizeConfig.pool = databaseConfig.pool;
  
  sequelizeConfig.dialectOptions = {
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  };
} else if (databaseConfig.dialect === 'sqlite') {
  sequelizeConfig.storage = databaseConfig.storage;
}

const sequelize = new Sequelize(sequelizeConfig);

// Create Umzug instance for migrations
const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, '../migrations/*.js'),
    resolve: ({ name, path: filepath, context: sequelize }) => {
      const migration = require(filepath);
      return {
        name,
        up: async () => migration.up(sequelize, Sequelize),
        down: async () => migration.down(sequelize, Sequelize),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

/**
 * Run all pending migrations
 */
async function runMigrations() {
  try {
    console.log('🔄 Checking for pending migrations...');
    
    const pending = await umzug.pending();
    
    if (pending.length === 0) {
      console.log('✅ No pending migrations. Database is up to date.');
      return { success: true, migrations: [] };
    }
    
    console.log(`📋 Found ${pending.length} pending migration(s):`);
    pending.forEach(m => console.log(`   - ${m.name}`));
    
    console.log('🚀 Running migrations...');
    const executed = await umzug.up();
    
    console.log('✅ Migrations completed successfully!');
    executed.forEach(m => console.log(`   ✓ ${m.name}`));
    
    return { success: true, migrations: executed.map(m => m.name) };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback the last migration
 */
async function rollbackMigration() {
  try {
    console.log('🔄 Rolling back last migration...');
    const executed = await umzug.down();
    
    if (executed) {
      console.log('✅ Rollback completed successfully!');
      console.log(`   ✓ Rolled back: ${executed.name}`);
      return { success: true, migration: executed.name };
    } else {
      console.log('ℹ️  No migrations to rollback.');
      return { success: true, migration: null };
    }
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

/**
 * Check migration status
 */
async function checkMigrationStatus() {
  try {
    const executed = await umzug.executed();
    const pending = await umzug.pending();
    
    console.log('\n📊 Migration Status:');
    console.log(`   Executed: ${executed.length}`);
    console.log(`   Pending: ${pending.length}`);
    
    if (executed.length > 0) {
      console.log('\n✅ Executed migrations:');
      executed.forEach(m => console.log(`   - ${m.name}`));
    }
    
    if (pending.length > 0) {
      console.log('\n⏳ Pending migrations:');
      pending.forEach(m => console.log(`   - ${m.name}`));
    }
    
    return {
      executed: executed.map(m => m.name),
      pending: pending.map(m => m.name)
    };
  } catch (error) {
    console.error('❌ Failed to check migration status:', error);
    throw error;
  }
}

module.exports = {
  runMigrations,
  rollbackMigration,
  checkMigrationStatus,
  sequelize,
  umzug
};

