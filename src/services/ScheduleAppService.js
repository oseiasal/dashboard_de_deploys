const { Repository, ScheduledTask } = require('../models');
const GitService = require('./gitService');
const schedule = require('node-schedule');
const TaskStrategyFactory = require('../strategies/TaskStrategyFactory');

class ScheduleAppService {
    
    async executeTask(taskId) {
        const task = await ScheduledTask.findByPk(taskId, { include: Repository });
        if (!task || task.status !== 'pending') return;

        try {
            const gitService = new GitService(task.repository.path);
            
            const strategy = TaskStrategyFactory.getStrategy(task.type);
            await strategy.execute(gitService, task);

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
    }

    async scheduleTask(repoId, type, datetime, target = null) {
        const scheduledTime = new Date(datetime);
        
        if (scheduledTime <= new Date()) {
            throw new Error('Schedule time must be in the future.');
        }

        const taskData = {
            repoId,
            type,
            scheduledTime
        };

        if (target) {
            taskData.target = target;
        }

        const task = await ScheduledTask.create(taskData);

        // Schedule the job in memory
        schedule.scheduleJob(String(task.id), scheduledTime, () => {
            this.executeTask(task.id);
        });

        return task;
    }

    async cancelTask(repoId, taskId) {
        const task = await ScheduledTask.findOne({ where: { id: taskId, repoId } });
        
        if (!task) {
             throw new Error('Task not found');
        }

        if (task.status !== 'pending') {
            throw new Error('Only pending tasks can be cancelled');
        }

        // Cancel the job in node-schedule
        const currentJob = schedule.scheduledJobs[String(taskId)];
        if (currentJob) {
            currentJob.cancel();
        }

        // Remove from DB
        await task.destroy();
    }

    async loadPendingTasks() {
        const pendingTasks = await ScheduledTask.findAll({ 
            where: { status: 'pending' },
            include: Repository
        });

        console.log(`Reloading ${pendingTasks.length} pending tasks...`);

        pendingTasks.forEach(task => {
            if (new Date(task.scheduledTime) <= new Date()) {
                console.log(`Executing missed task ${task.id}...`);
                this.executeTask(task.id);
            } else {
                schedule.scheduleJob(String(task.id), task.scheduledTime, () => {
                    this.executeTask(task.id);
                });
            }
        });
    }

    async getRepoTasks(repoId) {
        return await ScheduledTask.findAll({ 
            where: { repoId },
            order: [['scheduledTime', 'DESC']]
        });
    }
}

module.exports = new ScheduleAppService();
