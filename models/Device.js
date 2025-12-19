const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  scheduleId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'schedule_id',
    references: {
      model: 'schedules',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  uid: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Unique device identifier (e.g., MAC address, serial number)',
  },
  deviceInfo: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'device_info',
    comment: 'Flexible device information (resolution, OS, browser, location, etc.)',
  },
  lastSeen: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'last_seen',
    comment: 'Last time device checked in',
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
      fields: ['schedule_id'],
    },
    {
      unique: true,
      fields: ['schedule_id', 'uid'],
      name: 'unique_schedule_device',
    },
    {
      fields: ['last_seen'],
    },
    {
      fields: ['is_active'],
    },
  ],
});

module.exports = Device;

