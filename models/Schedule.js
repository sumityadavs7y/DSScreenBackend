const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const Schedule = sequelize.define('Schedule', {
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
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Display name of the schedule',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Optional description of the schedule',
  },
  code: {
    type: DataTypes.STRING(5),
    allowNull: false,
    unique: true,
    comment: 'Unique 5-character code for public access (alphanumeric)',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
    comment: 'Whether the schedule is active',
  },
  timezone: {
    type: DataTypes.STRING,
    defaultValue: 'UTC',
    comment: 'Timezone for the schedule (e.g., America/New_York)',
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional settings (loop, shuffle, etc.)',
  },
}, {
  tableName: 'schedules',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['company_id'],
    },
    {
      fields: ['created_by'],
    },
    {
      unique: true,
      fields: ['code'],
    },
    {
      fields: ['is_active'],
    },
  ],
});

module.exports = Schedule;

