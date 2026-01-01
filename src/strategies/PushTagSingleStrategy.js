class PushTagSingleStrategy {
    async execute(gitService, task) {
        await gitService.pushToRemote('origin', task.target);
    }
}

module.exports = PushTagSingleStrategy;
