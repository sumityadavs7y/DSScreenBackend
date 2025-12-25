'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('videos', 'thumbnail_path', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Path to video thumbnail image',
    });
    console.log('✅ Added thumbnail_path column to videos table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('videos', 'thumbnail_path');
  }
};



