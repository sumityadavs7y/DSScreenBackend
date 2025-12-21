'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('playlist_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
      video_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'videos',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order of the video in the playlist',
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Duration in seconds for which this video will play in loop',
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
    await queryInterface.addIndex('playlist_items', ['playlist_id'], {
      name: 'playlist_items_playlist_id',
    });
    
    await queryInterface.addIndex('playlist_items', ['video_id'], {
      name: 'playlist_items_video_id',
    });
    
    await queryInterface.addIndex('playlist_items', ['playlist_id', 'order'], {
      name: 'playlist_items_playlist_id_order',
    });

    console.log('✅ Created playlist_items table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('playlist_items');
  }
};

