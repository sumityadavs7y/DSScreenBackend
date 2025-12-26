'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('device_playlists', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      device_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'devices',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      playlist_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'playlists',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      registered_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        comment: 'When the device was registered to this playlist',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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
    await queryInterface.addIndex('device_playlists', ['device_id'], {
      name: 'device_playlists_device_id',
    });
    
    await queryInterface.addIndex('device_playlists', ['playlist_id'], {
      name: 'device_playlists_playlist_id',
    });
    
    await queryInterface.addIndex('device_playlists', ['device_id', 'playlist_id'], {
      name: 'device_playlists_device_playlist',
      unique: true,
    });

    console.log('✅ Created device_playlists table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('device_playlists');
  }
};


