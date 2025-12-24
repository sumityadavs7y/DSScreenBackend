const { sequelize, Sequelize, testConnection } = require('./sequelize');

// Import all models
const User = require('./User');
const Company = require('./Company');
const UserCompany = require('./UserCompany');
const Video = require('./Video');
const Playlist = require('./Playlist');
const PlaylistItem = require('./PlaylistItem');
const Device = require('./Device');
const DevicePlaylist = require('./DevicePlaylist');

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

// Playlist associations
Playlist.belongsTo(Company, {
  foreignKey: 'companyId',
  as: 'company'
});

Playlist.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

Company.hasMany(Playlist, {
  foreignKey: 'companyId',
  as: 'playlists'
});

User.hasMany(Playlist, {
  foreignKey: 'createdBy',
  as: 'createdPlaylists'
});

// PlaylistItem associations
PlaylistItem.belongsTo(Playlist, {
  foreignKey: 'playlistId',
  as: 'playlist'
});

PlaylistItem.belongsTo(Video, {
  foreignKey: 'videoId',
  as: 'video'
});

Playlist.hasMany(PlaylistItem, {
  foreignKey: 'playlistId',
  as: 'items'
});

Video.hasMany(PlaylistItem, {
  foreignKey: 'videoId',
  as: 'playlistItems'
});

// Device <-> Playlist (Many-to-Many through DevicePlaylist)
Device.belongsToMany(Playlist, {
  through: DevicePlaylist,
  foreignKey: 'deviceId',
  otherKey: 'playlistId',
  as: 'playlists'
});

Playlist.belongsToMany(Device, {
  through: DevicePlaylist,
  foreignKey: 'playlistId',
  otherKey: 'deviceId',
  as: 'devices'
});

// Direct associations for easier queries
Device.hasMany(DevicePlaylist, {
  foreignKey: 'deviceId',
  as: 'devicePlaylists'
});

Playlist.hasMany(DevicePlaylist, {
  foreignKey: 'playlistId',
  as: 'playlistDevices'
});

DevicePlaylist.belongsTo(Device, {
  foreignKey: 'deviceId',
  as: 'device'
});

DevicePlaylist.belongsTo(Playlist, {
  foreignKey: 'playlistId',
  as: 'playlist'
});

module.exports = {
  sequelize,
  Sequelize,
  testConnection,
  User,
  Company,
  UserCompany,
  Video,
  Playlist,
  PlaylistItem,
  Device,
  DevicePlaylist,
};

