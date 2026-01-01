const Sequelize = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.NODE_ENV === 'test' ? ':memory:' : path.join(__dirname, '..', '..', 'database.sqlite'),
    logging: false
});

module.exports = sequelize;
