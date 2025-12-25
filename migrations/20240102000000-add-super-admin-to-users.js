'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'is_super_admin', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Super admin flag for system-wide management access',
    });

    // Create index for faster queries
    await queryInterface.addIndex('users', ['is_super_admin'], {
      name: 'users_is_super_admin_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', 'users_is_super_admin_idx');
    await queryInterface.removeColumn('users', 'is_super_admin');
  }
};


