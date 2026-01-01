class PushTagsStrategy {
    async execute(gitService, task) {
        await gitService.pushTags();
    }
}

module.exports = PushTagsStrategy;
