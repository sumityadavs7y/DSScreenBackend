const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const Playlist = sequelize.define('Playlist', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  companyId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'company_id',
    references: {
      model: 'companies',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Name of the playlist',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Description of the playlist',
  },
  code: {
    type: DataTypes.STRING(5),
    allowNull: false,
    unique: true,
    comment: 'Unique 5-character code for public access',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  tableName: 'playlists',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['company_id'],
    },
    {
      fields: ['code'],
      unique: true,
    },
    {
      fields: ['created_by'],
    },
  ],
});

module.exports = Playlist;








