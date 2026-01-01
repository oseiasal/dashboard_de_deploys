const GitService = require('./gitService');

class GitServiceFactory {
    create(repoPath) {
        return new GitService(repoPath);
    }
}

module.exports = new GitServiceFactory();
