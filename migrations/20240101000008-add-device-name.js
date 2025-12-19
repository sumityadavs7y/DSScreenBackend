'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('devices', 'name', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Friendly name for the device (auto-generated or user-defined)',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('devices', 'name');
  }
};

