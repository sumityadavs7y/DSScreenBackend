'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('devices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      schedule_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'schedules',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      uid: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      device_info: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      last_seen: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
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

    // Add indexes
    await queryInterface.addIndex('devices', ['schedule_id']);
    await queryInterface.addIndex('devices', ['schedule_id', 'uid'], {
      unique: true,
      name: 'unique_schedule_device',
    });
    await queryInterface.addIndex('devices', ['last_seen']);
    await queryInterface.addIndex('devices', ['is_active']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('devices');
  }
};

