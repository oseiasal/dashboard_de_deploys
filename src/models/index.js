const sequelize = require('../config/database');
const Repository = require('./repository');
const ScheduledTask = require('./scheduledTask');

Repository.hasMany(ScheduledTask, { foreignKey: 'repoId' });
ScheduledTask.belongsTo(Repository, { foreignKey: 'repoId' });

const syncDatabase = async () => {
    try {
        await sequelize.sync({ force: false }); // force: false creates if not exists
        console.log('Database synced successfully.');
    } catch (error) {
        console.error('Unable to sync database:', error);
    }
};

module.exports = {
    sequelize,
    Repository,
    ScheduledTask,
    syncDatabase
};
