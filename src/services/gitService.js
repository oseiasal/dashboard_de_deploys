const simpleGit = require('simple-git');

class GitService {
    constructor(repoPath) {
        this.git = simpleGit(repoPath);
    }

    async getStatus() {
        return await this.git.status();
    }

    async getLog(limit = 10) {
        return await this.git.log({ maxCount: limit });
    }

    async getTags() {
        return await this.git.tags();
    }

    async getLocalBranches() {
        return await this.git.branchLocal();
    }

    async getRemoteRefs(options = ['--tags', 'origin']) {
        try {
            return await this.git.listRemote(options);
        } catch (error) {
            console.warn('Failed to list remote refs:', error.message);
            return ''; 
        }
    }

    async getUnpushedCommits() {
        try {
            return await this.git.log(['--not', '--remotes']);
        } catch (error) {
            return { all: [] };
        }
    }

    async checkIsRepo() {
        return await this.git.checkIsRepo();
    }

    async checkout(branch) {
        return await this.git.checkout(branch);
    }

    async add(files) {
        return await this.git.add(files);
    }

    async commit(message) {
        return await this.git.commit(message);
    }

    async push() {
        return await this.git.push();
    }
    
    async pushToRemote(remote, branch) {
         return await this.git.push(remote, branch);
    }

    async pull(options) {
        return await this.git.pull(options);
    }

    async pushTags() {
        return await this.git.pushTags();
    }

    async createTag(tagName, message = null, commitHash = null) {
        if (commitHash) {
             return await this.git.addAnnotatedTag(tagName, message || tagName, commitHash);
        } else if (message) {
             return await this.git.addAnnotatedTag(tagName, message);
        } else {
             return await this.git.addTag(tagName);
        }
    }

    async deleteTag(tagName) {
        return await this.git.tagDelete(tagName);
    }

    static async clone(url, path) {
        const git = simpleGit();
        return await git.clone(url, path);
    }
}

module.exports = GitService;
