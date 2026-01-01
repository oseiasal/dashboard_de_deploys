const PushStrategy = require('./PushStrategy');
const PushTagsStrategy = require('./PushTagsStrategy');
const PushTagSingleStrategy = require('./PushTagSingleStrategy');
const PushCommitStrategy = require('./PushCommitStrategy');

class TaskStrategyFactory {
    static getStrategy(type) {
        switch (type) {
            case 'push':
                return new PushStrategy();
            case 'push-tags':
                return new PushTagsStrategy();
            case 'push-tag-single':
                return new PushTagSingleStrategy();
            case 'push-commit':
                return new PushCommitStrategy();
            default:
                throw new Error(`Unknown task type: ${type}`);
        }
    }
}

module.exports = TaskStrategyFactory;
