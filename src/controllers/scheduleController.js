const { Repository, ScheduledTask } = require('../models');
const simpleGit = require('simple-git');
const schedule = require('node-schedule');

// Helper to execute the job
const executeTask = async (taskId) => {
    const task = await ScheduledTask.findByPk(taskId, { include: Repository });
    if (!task || task.status !== 'pending') return;

    try {
        const git = simpleGit(task.repository.path);
        
        if (task.type === 'push') {
            await git.push();
        } else if (task.type === 'push-tags') {
            await git.pushTags();
        }

        task.status = 'completed';
        task.log = 'Executed successfully at ' + new Date().toISOString();
        await task.save();
        console.log(`Task ${taskId} executed successfully.`);
    } catch (error) {
        task.status = 'failed';
        task.log = error.message;
        await task.save();
        console.error(`Task ${taskId} failed:`, error);
    }
};

exports.form = async (req, res) => {
    const { id } = req.params;
    try {
        const repo = await Repository.findByPk(id);
        const tasks = await ScheduledTask.findAll({ 
            where: { repoId: id },
            order: [['scheduledTime', 'DESC']]
        });
        res.render('schedule', { repo, tasks });
    } catch (error) {
        res.status(500).send('Error loading schedule form');
    }
};

exports.schedule = async (req, res) => {
    const { id } = req.params;
    const { type, datetime } = req.body;

    try {
        const scheduledTime = new Date(datetime);
        
        if (scheduledTime <= new Date()) {
            return res.render('schedule', { 
                repo: await Repository.findByPk(id),
                tasks: await ScheduledTask.findAll({ where: { repoId: id } }),
                error: 'Schedule time must be in the future.' 
            });
        }

        const task = await ScheduledTask.create({
            repoId: id,
            type,
            scheduledTime
        });

        // Schedule the job in memory
        schedule.scheduleJob(scheduledTime, function() {
            executeTask(task.id);
        });

        res.redirect(`/repo/${id}/schedule?message=Task+Scheduled`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating schedule');
    }
};

// Function to reload pending tasks on server restart
exports.loadPendingTasks = async () => {
    const pendingTasks = await ScheduledTask.findAll({ 
        where: { status: 'pending' },
        include: Repository
    });

    console.log(`Reloading ${pendingTasks.length} pending tasks...`);

    pendingTasks.forEach(task => {
        if (new Date(task.scheduledTime) <= new Date()) {
            // Missed execution while offline, execute now or mark failed? 
            // Let's execute immediately for this simple app.
            console.log(`Executing missed task ${task.id}...`);
            executeTask(task.id);
        } else {
            schedule.scheduleJob(task.scheduledTime, function() {
                executeTask(task.id);
            });
        }
    });
};
