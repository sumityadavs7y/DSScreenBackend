'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_companies', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'company_id',
        references: {
          model: 'companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('owner', 'admin', 'manager', 'member', 'viewer'),
        allowNull: false,
        defaultValue: 'member',
      },
      permissions: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
      joinedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        field: 'joined_at',
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

    await queryInterface.addIndex('user_companies', ['user_id', 'company_id'], {
      unique: true,
      name: 'user_companies_user_id_company_id_unique',
    });
    await queryInterface.addIndex('user_companies', ['user_id']);
    await queryInterface.addIndex('user_companies', ['company_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_companies');
  }
};

