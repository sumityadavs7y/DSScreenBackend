'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('registration_sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      session_token: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        comment: 'Unique session token for QR code',
      },
      device_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Device unique identifier (MAC address, etc.)',
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'expired', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false,
      },
      registration_code: {
        type: Sequelize.STRING(5),
        allowNull: true,
        comment: 'The 5-character code submitted by user',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Session expiry time (typically 5 minutes from creation)',
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex('registration_sessions', ['session_token'], {
      name: 'idx_registration_sessions_session_token',
      unique: true,
    });

    await queryInterface.addIndex('registration_sessions', ['device_id'], {
      name: 'idx_registration_sessions_device_id',
    });

    await queryInterface.addIndex('registration_sessions', ['status'], {
      name: 'idx_registration_sessions_status',
    });

    await queryInterface.addIndex('registration_sessions', ['expires_at'], {
      name: 'idx_registration_sessions_expires_at',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('registration_sessions');
  },
};

