const { sequelize, Sequelize, testConnection } = require('./sequelize');

// Import all models
const User = require('./User');
const Company = require('./Company');
const UserCompany = require('./UserCompany');
const Video = require('./Video');

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

module.exports = {
  sequelize,
  Sequelize,
  testConnection,
  User,
  Company,
  UserCompany,
  Video,
};

