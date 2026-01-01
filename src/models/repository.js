const Sequelize = require('sequelize');
const sequelize = require('../config/database');

const Repository = sequelize.define('repository', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    path: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
    },
    lastStatus: {
        type: Sequelize.TEXT, // JSON stringified status or simple status text
        allowNull: true
    }
});

module.exports = Repository;
