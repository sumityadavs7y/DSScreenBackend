const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const UserCompany = sequelize.define('UserCompany', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id',
    },
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
  role: {
    type: DataTypes.ENUM('owner', 'admin', 'manager', 'member', 'viewer'),
    allowNull: false,
    defaultValue: 'member',
  },
  permissions: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional granular permissions for the user in this company',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'joined_at',
  },
}, {
  tableName: 'user_companies',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'companyId'],
    },
  ],
});

module.exports = UserCompany;

