class PushStrategy {
    async execute(gitService, task) {
        await gitService.push();
    }
}

module.exports = PushStrategy;
