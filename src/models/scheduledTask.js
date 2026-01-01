const Sequelize = require('sequelize');
const sequelize = require('../config/database');

const ScheduledTask = sequelize.define('scheduledTask', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    repoId: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    type: {
        type: Sequelize.ENUM('push', 'push-tags', 'push-tag-single', 'push-commit'),
        allowNull: false
    },
    target: {
        type: Sequelize.STRING, // stores specific tag name or branch
        allowNull: true
    },
    scheduledTime: {
        type: Sequelize.DATE,
        allowNull: false
    },
    status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending'
    },
    log: {
        type: Sequelize.TEXT,
        allowNull: true
    }
});

module.exports = ScheduledTask;
