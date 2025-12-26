'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'first_name',
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'last_name',
      },
      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'phone_number',
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
      isSuperAdmin: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        field: 'is_super_admin',
        comment: 'Super admin flag for system-wide management access',
      },
      lastLoginAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'last_login_at',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    });

    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['is_super_admin'], {
      name: 'users_is_super_admin_idx',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};

