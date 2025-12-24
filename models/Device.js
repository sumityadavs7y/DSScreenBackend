const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  uid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Unique identifier from the machine (MAC address, hardware ID, etc.)',
  },
  deviceInfo: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'device_info',
    comment: 'JSON object containing all device information (browser, OS, screen resolution, etc.)',
  },
  lastSeen: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_seen',
    comment: 'Last time the device was seen/active',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'devices',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['uid'],
      unique: true,
    },
    {
      fields: ['is_active'],
    },
    {
      fields: ['last_seen'],
    },
  ],
});

module.exports = Device;


