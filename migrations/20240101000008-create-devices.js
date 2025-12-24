'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('devices', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      uid: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Unique identifier from the machine (MAC address, hardware ID, etc.)',
      },
      device_info: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'JSON object containing all device information (browser, OS, screen resolution, etc.)',
      },
      last_seen: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last time the device was seen/active',
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
    await queryInterface.addIndex('devices', ['uid'], {
      name: 'devices_uid',
      unique: true,
    });
    
    await queryInterface.addIndex('devices', ['is_active'], {
      name: 'devices_is_active',
    });
    
    await queryInterface.addIndex('devices', ['last_seen'], {
      name: 'devices_last_seen',
    });

    console.log('✅ Created devices table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('devices');
  }
};


