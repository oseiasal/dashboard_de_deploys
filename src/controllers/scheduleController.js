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
        } else if (task.type === 'push-tag-single') {
            // Push specific tag: git push origin <tagname>
            await git.push('origin', task.target);
        } else if (task.type === 'push-commit') {
            // Push specific commit to current branch: git push origin <hash>:<current_branch>
            const branchSummary = await git.branchLocal();
            const currentBranch = branchSummary.current;
            await git.push('origin', `${task.target}:${currentBranch}`);
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
        // Schedule the job in memory
        schedule.scheduleJob(String(task.id), scheduledTime, function() {
            executeTask(task.id);
        });

        res.redirect(`/repo/${id}/schedule?message=Task+Scheduled`);

        res.redirect(`/repo/${id}/schedule?message=Task+Scheduled`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating schedule');
    }
};

exports.scheduleSingleTag = async (req, res) => {
    const { id, tagName } = req.params;
    const { datetime } = req.body;

    try {
        const scheduledTime = new Date(datetime);
        
        if (scheduledTime <= new Date()) {
            // Simple validation redirect for now
            return res.redirect(`/repo/${id}?error=Schedule+time+must+be+in+the+future.`);
        }

        const task = await ScheduledTask.create({
            repoId: id,
            type: 'push-tag-single',
            target: tagName,
            scheduledTime
        });

        // Schedule the job in memory
        schedule.scheduleJob(String(task.id), scheduledTime, function() {
            executeTask(task.id);
        });

        res.redirect(`/repo/${id}/schedule?message=Task+Scheduled`);

        res.redirect(`/repo/${id}?message=Push+for+tag+${tagName}+scheduled`);
    } catch (error) {
        console.error(error);
        res.redirect(`/repo/${id}?error=Scheduling+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.scheduleCommit = async (req, res) => {
    const { id, commitHash } = req.params;
    const { datetime } = req.body;

    try {
        const scheduledTime = new Date(datetime);
        
        if (scheduledTime <= new Date()) {
            return res.redirect(`/repo/${id}?error=Schedule+time+must+be+in+the+future.`);
        }

        const task = await ScheduledTask.create({
            repoId: id,
            type: 'push-commit',
            target: commitHash,
            scheduledTime
        });

        // Schedule the job in memory
        schedule.scheduleJob(String(task.id), scheduledTime, function() {
            executeTask(task.id);
        });

        res.redirect(`/repo/${id}/schedule?message=Task+Scheduled`);

        res.redirect(`/repo/${id}?message=Push+for+commit+${commitHash.substring(0,7)}+scheduled`);
    } catch (error) {
        console.error(error);
        res.redirect(`/repo/${id}?error=Scheduling+Failed:+${encodeURIComponent(error.message)}`);
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
            // Use task ID as the job name for cancellation purposes
            schedule.scheduleJob(String(task.id), task.scheduledTime, function() {
                executeTask(task.id);
            });
        }
    });
};

exports.cancel = async (req, res) => {
    const { id, taskId } = req.params;
    try {
        const task = await ScheduledTask.findOne({ where: { id: taskId, repoId: id } });
        
        if (!task) {
             return res.redirect(`/repo/${id}/schedule?error=Task+not+found`);
        }

        if (task.status !== 'pending') {
            return res.redirect(`/repo/${id}/schedule?error=Only+pending+tasks+can+be+cancelled`);
        }

        // Cancel the job in node-schedule
        const currentJob = schedule.scheduledJobs[String(taskId)];
        if (currentJob) {
            currentJob.cancel();
        }

        // Remove from DB
        await task.destroy();

        res.redirect(`/repo/${id}/schedule?message=Task+Cancelled`);
    } catch (error) {
        console.error(error);
        res.redirect(`/repo/${id}/schedule?error=Cancellation+Failed:+${encodeURIComponent(error.message)}`);
    }
};
