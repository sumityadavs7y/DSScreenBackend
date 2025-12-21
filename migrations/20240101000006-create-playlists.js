'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('playlists', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      company_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Name of the playlist',
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Description of the playlist',
      },
      code: {
        type: Sequelize.STRING(5),
        allowNull: false,
        unique: true,
        comment: 'Unique 5-character code for public access',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create indexes
    await queryInterface.addIndex('playlists', ['company_id'], {
      name: 'playlists_company_id',
    });
    
    await queryInterface.addIndex('playlists', ['code'], {
      name: 'playlists_code',
      unique: true,
    });
    
    await queryInterface.addIndex('playlists', ['created_by'], {
      name: 'playlists_created_by',
    });

    console.log('✅ Created playlists table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('playlists');
  }
};

