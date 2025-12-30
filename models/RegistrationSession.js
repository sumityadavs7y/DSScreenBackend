const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const RegistrationSession = sequelize.define('RegistrationSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sessionToken: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'session_token',
    comment: 'Unique session token for QR code',
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'device_id',
    comment: 'Device unique identifier (MAC address, etc.)',
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'expired', 'cancelled'),
    defaultValue: 'pending',
    allowNull: false,
  },
  registrationCode: {
    type: DataTypes.STRING(5),
    allowNull: true,
    field: 'registration_code',
    comment: 'The 5-character code submitted by user',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
    comment: 'Session expiry time (typically 5 minutes from creation)',
  },
}, {
  tableName: 'registration_sessions',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['session_token'],
      unique: true,
    },
    {
      fields: ['device_id'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['expires_at'],
    },
  ],
});

module.exports = RegistrationSession;

