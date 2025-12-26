'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('videos', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'company_id',
        references: {
          model: 'companies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      uploadedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'uploaded_by',
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      fileName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'file_name',
      },
      originalFileName: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'original_file_name',
      },
      filePath: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'file_path',
      },
      fileSize: {
        type: Sequelize.BIGINT,
        allowNull: false,
        field: 'file_size',
      },
      mimeType: {
        type: Sequelize.STRING,
        allowNull: false,
        field: 'mime_type',
      },
      duration: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      resolution: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
      thumbnailPath: {
        type: Sequelize.STRING,
        allowNull: true,
        field: 'thumbnail_path',
        comment: 'Path to video thumbnail image',
      },
      metadata: {
        type: Sequelize.JSONB,
        defaultValue: {},
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    });

    // Add indexes
    await queryInterface.addIndex('videos', ['company_id']);
    await queryInterface.addIndex('videos', ['uploaded_by']);
    await queryInterface.addIndex('videos', ['company_id', 'file_name'], {
      unique: true,
      name: 'unique_company_filename',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('videos');
  }
};

