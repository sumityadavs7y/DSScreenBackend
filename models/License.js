const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const License = sequelize.define('License', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  companyName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'company_name',
    comment: 'Pre-filled company name (optional)',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_active',
    comment: 'Whether this is the active license for the company',
  },
  isUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_used',
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at',
  },
  maxUsers: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    field: 'max_users',
    comment: 'Maximum users allowed for this license',
  },
  maxStorageBytes: {
    type: DataTypes.BIGINT,
    defaultValue: 10737418240, // 10GB default
    field: 'max_storage_bytes',
    comment: 'Maximum storage in bytes allowed for this license',
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
  companyId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'company_id',
    references: {
      model: 'companies',
      key: 'id',
    },
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Admin notes about this license',
  },
}, {
  tableName: 'licenses',
  timestamps: true,
  underscored: true,
});

module.exports = License;

