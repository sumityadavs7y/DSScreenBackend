const { DataTypes } = require('sequelize');
const { sequelize } = require('./sequelize');

const ScheduleItem = sequelize.define('ScheduleItem', {
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
  videoId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'video_id',
    references: {
      model: 'videos',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false,
    field: 'start_time',
    comment: 'Time when video should start playing (HH:MM:SS)',
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Duration in seconds the video should play',
  },
  dayOfWeek: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    allowNull: true,
    field: 'day_of_week',
    comment: 'Days of week (0=Sunday, 6=Saturday). Null means every day.',
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'start_date',
    comment: 'Optional start date for this item',
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'end_date',
    comment: 'Optional end date for this item',
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Display order for items with same start time',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
    comment: 'Whether this schedule item is active',
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata (transitions, effects, etc.)',
  },
}, {
  tableName: 'schedule_items',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['schedule_id'],
    },
    {
      fields: ['video_id'],
    },
    {
      fields: ['start_time'],
    },
    {
      fields: ['is_active'],
    },
  ],
});

module.exports = ScheduleItem;

