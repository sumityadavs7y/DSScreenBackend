const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const PlaylistItem = sequelize.define('PlaylistItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
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
  videoId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'video_id',
    references: {
      model: 'videos',
      key: 'id',
    },
  },
  order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Order of the video in the playlist',
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Duration in seconds for which this video will play in loop',
  },
}, {
  tableName: 'playlist_items',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['playlist_id'],
    },
    {
      fields: ['video_id'],
    },
    {
      fields: ['playlist_id', 'order'],
    },
  ],
});

module.exports = PlaylistItem;


