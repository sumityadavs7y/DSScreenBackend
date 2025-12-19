const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const Video = sequelize.define('Video', {
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
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'uploaded_by',
    references: {
      model: 'users',
      key: 'id',
    },
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'file_name',
    comment: 'Display name of the file',
  },
  originalFileName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'original_file_name',
    comment: 'Original file name when uploaded',
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'file_path',
    comment: 'Relative path to the file in the filesystem',
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'file_size',
    comment: 'File size in bytes',
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'mime_type',
    comment: 'MIME type of the video file',
  },
  duration: {
    type: DataTypes.FLOAT,
    allowNull: true,
    comment: 'Video duration in seconds (optional)',
  },
  resolution: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Video resolution (e.g., 1920x1080)',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata about the video',
  },
}, {
  tableName: 'videos',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['company_id'],
    },
    {
      fields: ['uploaded_by'],
    },
    {
      unique: true,
      fields: ['company_id', 'file_name'],
      name: 'unique_company_filename',
    },
  ],
});

module.exports = Video;

