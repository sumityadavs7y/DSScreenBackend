const { sequelize, Sequelize, testConnection } = require('./sequelize');

// Import all models
const User = require('./User');
const Company = require('./Company');
const UserCompany = require('./UserCompany');
const Video = require('./Video');
const Schedule = require('./Schedule');
const ScheduleItem = require('./ScheduleItem');
const Device = require('./Device');

// Define relationships
// User <-> Company (Many-to-Many through UserCompany)
User.belongsToMany(Company, {
  through: UserCompany,
  foreignKey: 'userId',
  otherKey: 'companyId',
  as: 'companies'
});

Company.belongsToMany(User, {
  through: UserCompany,
  foreignKey: 'companyId',
  otherKey: 'userId',
  as: 'users'
});

// Direct associations for easier queries
User.hasMany(UserCompany, {
  foreignKey: 'userId',
  as: 'userCompanies'
});

Company.hasMany(UserCompany, {
  foreignKey: 'companyId',
  as: 'companyUsers'
});

UserCompany.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

UserCompany.belongsTo(Company, {
  foreignKey: 'companyId',
  as: 'company'
});

// Video associations
Video.belongsTo(Company, {
  foreignKey: 'companyId',
  as: 'company'
});

Video.belongsTo(User, {
  foreignKey: 'uploadedBy',
  as: 'uploader'
});

Company.hasMany(Video, {
  foreignKey: 'companyId',
  as: 'videos'
});

User.hasMany(Video, {
  foreignKey: 'uploadedBy',
  as: 'uploadedVideos'
});

// Schedule associations
Schedule.belongsTo(Company, {
  foreignKey: 'companyId',
  as: 'company'
});

Schedule.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

Company.hasMany(Schedule, {
  foreignKey: 'companyId',
  as: 'schedules'
});

User.hasMany(Schedule, {
  foreignKey: 'createdBy',
  as: 'createdSchedules'
});

// ScheduleItem associations
ScheduleItem.belongsTo(Schedule, {
  foreignKey: 'scheduleId',
  as: 'schedule'
});

ScheduleItem.belongsTo(Video, {
  foreignKey: 'videoId',
  as: 'video'
});

Schedule.hasMany(ScheduleItem, {
  foreignKey: 'scheduleId',
  as: 'items'
});

Video.hasMany(ScheduleItem, {
  foreignKey: 'videoId',
  as: 'scheduleItems'
});

// Device associations
Device.belongsTo(Schedule, {
  foreignKey: 'scheduleId',
  as: 'schedule'
});

Schedule.hasMany(Device, {
  foreignKey: 'scheduleId',
  as: 'devices'
});

module.exports = {
  sequelize,
  Sequelize,
  testConnection,
  User,
  Company,
  UserCompany,
  Video,
  Schedule,
  ScheduleItem,
  Device,
};

