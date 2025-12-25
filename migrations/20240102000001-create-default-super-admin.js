'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if super admin already exists
    const existingAdmin = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'test@test.com' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existingAdmin.length > 0) {
      console.log('Super admin already exists, skipping...');
      return;
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('12341234', salt);
    
    // Generate UUID using crypto
    const { randomUUID } = require('crypto');
    const adminId = randomUUID();

    // Create default super admin user
    await queryInterface.bulkInsert('users', [{
      id: adminId,
      email: 'test@test.com',
      password: hashedPassword,
      first_name: 'Super',
      last_name: 'Admin',
      phone_number: null,
      is_active: true,
      is_super_admin: true,
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }]);

    console.log('✅ Default super admin created:');
    console.log('   Email: test@test.com');
    console.log('   Password: 12341234');
    console.log('   ⚠️  Please change the password after first login!');
  },

  async down(queryInterface, Sequelize) {
    // Remove the default super admin
    await queryInterface.bulkDelete('users', {
      email: 'test@test.com'
    });
  }
};

