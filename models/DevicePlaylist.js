const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const DevicePlaylist = sequelize.define('DevicePlaylist', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  deviceId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'device_id',
    references: {
      model: 'devices',
      key: 'id',
    },
  },
  playlistId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'playlist_id',
    references: {
      model: 'playlists',
      key: 'id',
    },
  },
  registeredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'registered_at',
    comment: 'When the device was registered to this playlist',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'device_playlists',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['device_id'],
    },
    {
      fields: ['playlist_id'],
    },
    {
      fields: ['device_id', 'playlist_id'],
      unique: true,
    },
  ],
});

module.exports = DevicePlaylist;


