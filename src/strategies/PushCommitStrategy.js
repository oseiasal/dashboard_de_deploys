class PushCommitStrategy {
    async execute(gitService, task) {
        const branchSummary = await gitService.getLocalBranches();
        const currentBranch = branchSummary.current;
        await gitService.pushToRemote('origin', `${task.target}:${currentBranch}`);
    }
}

module.exports = PushCommitStrategy;
