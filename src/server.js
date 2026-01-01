const app = require('./app');
const { syncDatabase } = require('./models');
const scheduleController = require('./controllers/scheduleController');

const PORT = process.env.PORT || 3000;

// Sync DB and Start Server
syncDatabase().then(() => {
    // Reload scheduled tasks
    scheduleController.loadPendingTasks();

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
});
