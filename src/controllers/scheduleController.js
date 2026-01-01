const { Repository } = require('../models');
const scheduleAppService = require('../services/ScheduleAppService');

exports.form = async (req, res) => {
    const { id } = req.params;
    try {
        const repo = await Repository.findByPk(id);
        const tasks = await scheduleAppService.getRepoTasks(id);
        res.render('schedule', { repo, tasks });
    } catch (error) {
        res.status(500).send('Error loading schedule form');
    }
};

exports.schedule = async (req, res) => {
    const { id } = req.params;
    const { type, datetime } = req.body;

    try {
        await scheduleAppService.scheduleTask(id, type, datetime);
        res.redirect(`/repo/${id}/schedule?message=Task+Scheduled`);
    } catch (error) {
        console.error(error);
        if (error.message.includes('future')) {
            // Re-render logic involves fetching data again, simpler to redirect with error for now or handle better
            // Ideally we pass error to view. For brevity using redirect pattern or simple error page.
             return res.redirect(`/repo/${id}/schedule?error=${encodeURIComponent(error.message)}`);
        }
        res.status(500).send('Error creating schedule');
    }
};

exports.scheduleSingleTag = async (req, res) => {
    const { id, tagName } = req.params;
    const { datetime } = req.body;

    try {
        await scheduleAppService.scheduleTask(id, 'push-tag-single', datetime, tagName);
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
        await scheduleAppService.scheduleTask(id, 'push-commit', datetime, commitHash);
        res.redirect(`/repo/${id}?message=Push+for+commit+${commitHash.substring(0,7)}+scheduled`);
    } catch (error) {
        console.error(error);
        res.redirect(`/repo/${id}?error=Scheduling+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.loadPendingTasks = async () => {
    await scheduleAppService.loadPendingTasks();
};

exports.cancel = async (req, res) => {
    const { id, taskId } = req.params;
    try {
        await scheduleAppService.cancelTask(id, taskId);
        res.redirect(`/repo/${id}/schedule?message=Task+Cancelled`);
    } catch (error) {
        console.error(error);
        res.redirect(`/repo/${id}/schedule?error=Cancellation+Failed:+${encodeURIComponent(error.message)}`);
    }
};