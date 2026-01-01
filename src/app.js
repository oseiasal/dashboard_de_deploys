const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const { syncDatabase } = require('./models');
const scheduleController = require('./controllers/scheduleController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const repositoryRoutes = require('./routes/repositoryRoutes');
app.use('/', repositoryRoutes);

// Sync DB and Start Server
syncDatabase().then(() => {
    // Reload scheduled tasks
    scheduleController.loadPendingTasks();

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
});
