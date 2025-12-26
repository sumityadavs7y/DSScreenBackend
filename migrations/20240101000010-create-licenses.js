'use strict';

/**
 * Migration: Create Licenses Table
 * 
 * Creates the licenses table with all required fields for managing company licenses.
 * Each company can have one active license that defines their subscription.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop table if it exists to ensure clean state
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS licenses CASCADE');
    
    await queryInterface.createTable('licenses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique token for license registration',
      },
      company_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Company this license is assigned to',
      },
      company_name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Pre-filled company name for new registrations',
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When this license expires',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether this is the currently active license for the company',
      },
      is_used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether this license token has been used for registration',
      },
      used_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this license was used',
      },
      max_users: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
        comment: 'Maximum users allowed for this license',
      },
      max_storage_bytes: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 524288000, // 500MB default
        comment: 'Maximum storage in bytes allowed for this license',
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Super admin who created this license',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Admin notes about this license',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add index on company_id for faster lookups
    await queryInterface.addIndex('licenses', ['company_id'], {
      name: 'licenses_company_id_idx',
    });

    // Add index on token for faster lookups
    await queryInterface.addIndex('licenses', ['token'], {
      name: 'licenses_token_idx',
    });

    // Add index on is_active for faster queries
    await queryInterface.addIndex('licenses', ['is_active'], {
      name: 'licenses_is_active_idx',
    });

    console.log('✅ Created licenses table with indexes');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('licenses');
    console.log('✅ Dropped licenses table');
  }
};

