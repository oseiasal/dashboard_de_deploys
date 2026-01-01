const { Repository, ScheduledTask } = require('../models');
// const GitService = require('./gitService'); // Removed: Injected via Factory
const defaultGitServiceFactory = require('./GitServiceFactory');
const fs = require('fs');

class RepositoryAppService {

    constructor(gitServiceFactory = defaultGitServiceFactory) {
        this.gitServiceFactory = gitServiceFactory;
    }
    
    async getAllRepositories() {
        // Fetch repos including their scheduled tasks
        const dbRepos = await Repository.findAll({
            include: [{ model: ScheduledTask }]
        });

        // Enhance repos with Git data (Last Commit Date) in parallel
        const repositories = await Promise.all(dbRepos.map(async (repoInstance) => {
            const repo = repoInstance.toJSON(); // Convert to plain object
            const gitService = this.gitServiceFactory.create(repo.path);
            
            try {
                // Get last commit info
                const log = await gitService.getLog(1);
                repo.lastCommitDate = log.latest ? new Date(log.latest.date) : new Date(0);
                repo.lastCommitMsg = log.latest ? log.latest.message : 'No commits yet';
            } catch (err) {
                // If repo path is invalid or empty
                repo.lastCommitDate = new Date(0); 
                repo.lastCommitMsg = 'Error accessing git';
            }

            // Calculate pending tasks
            repo.pendingTasksCount = repo.scheduledTasks.filter(t => t.status === 'pending').length;
            
            return repo;
        }));

        // Sort by Last Commit Date (Newest First)
        repositories.sort((a, b) => b.lastCommitDate - a.lastCommitDate);
        
        return repositories;
    }

    async createRepository({ name, path: repoPath, method, url }) {
        // Note: GitService.clone is static, so we might keep it or wrap it in factory too. 
        // For strict DIP, the factory should handle it, but for now we focus on instance methods.
        // However, checking isRepo requires an instance.
        
        const GitService = require('./gitService'); // Still needed for static .clone unless moved to factory

        if (method === 'clone') {
            if (fs.existsSync(repoPath)) {
                throw new Error('Destination path already exists. Please choose a new folder.');
            }
            await GitService.clone(url, repoPath);
        } else {
            const gitService = this.gitServiceFactory.create(repoPath);
            const isRepo = await gitService.checkIsRepo();
            
            if (!isRepo) {
                throw new Error('The provided path is not a valid Git repository.');
            }
        }

        return await Repository.create({ name, path: repoPath });
    }

    async deleteRepository(id) {
        return await Repository.destroy({ where: { id } });
    }

    async getRepositoryDetails(id, options = {}) {
        const { limit = 10, tagPage = 1, tagLimit = 10, tagSearch = '' } = options;

        const repo = await Repository.findByPk(id);
        if (!repo) throw new Error('Repository not found');

        const gitService = this.gitServiceFactory.create(repo.path);
        
        // Parallel execution for speed
        const [status, log, tags, scheduledTasks, branches, remoteTags, unpushedHashes] = await Promise.all([
            gitService.getStatus(),
            gitService.getLog(limit),
            gitService.getTags(),
            ScheduledTask.findAll({ 
                where: { repoId: id, status: 'pending' },
                order: [['scheduledTime', 'ASC']]
            }),
            gitService.getLocalBranches(),
            gitService.getRemoteTags(),
            gitService.getUnpushedHashes() 
        ]);

        // Process Tags
        let allTags = tags.all.slice().reverse();
        
        if (tagSearch) {
            allTags = allTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()));
        }

        const totalTags = allTags.length;
        const totalTagPages = Math.ceil(totalTags / tagLimit);
        const pagedTags = allTags.slice((tagPage - 1) * tagLimit, tagPage * tagLimit);

        return {
            repo, status, log, limit, scheduledTasks, branches, remoteTags, unpushedHashes,
            pagedTags, currentTagPage: tagPage, totalTagPages, tagSearch
        };
    }

    // Git Operations Wrappers

    async checkoutBranch(id, branchName) {
        const repo = await Repository.findByPk(id);
        if (!repo) throw new Error('Repository not found');
        
        const gitService = this.gitServiceFactory.create(repo.path);
        await gitService.checkout(branchName);
        return repo;
    }

    async commitChanges(id, message, files) {
        const repo = await Repository.findByPk(id);
        if (!repo) throw new Error('Repository not found');

        const gitService = this.gitServiceFactory.create(repo.path);

        if (files === 'all') {
            await gitService.add('.');
        } else if (files) {
             await gitService.add(files);
        }

        await gitService.commit(message);
        return repo;
    }

    async pushRepository(id) {
        const repo = await Repository.findByPk(id);
        if (!repo) throw new Error('Repository not found');
        
        const gitService = this.gitServiceFactory.create(repo.path);
        await gitService.push();
        return repo;
    }

    async pullRepository(id) {
        const repo = await Repository.findByPk(id);
        if (!repo) throw new Error('Repository not found');
        
        const gitService = this.gitServiceFactory.create(repo.path);
        await gitService.pull();
        return repo;
    }

    async pullTags(id) {
        const repo = await Repository.findByPk(id);
        if (!repo) throw new Error('Repository not found');
        
        const gitService = this.gitServiceFactory.create(repo.path);
        await gitService.pull(['--tags']);
        return repo;
    }

    async pushTags(id) {
        const repo = await Repository.findByPk(id);
        if (!repo) throw new Error('Repository not found');
        
        const gitService = this.gitServiceFactory.create(repo.path);
        await gitService.pushTags();
        return repo;
    }

    async createTag(id, { tagName, message, commitHash }) {
        const repo = await Repository.findByPk(id);
        if (!repo) throw new Error('Repository not found');
        
        const gitService = this.gitServiceFactory.create(repo.path);
        await gitService.createTag(tagName, message, commitHash);
        return repo;
    }

    async deleteTag(id, tagName) {
        const repo = await Repository.findByPk(id);
        if (!repo) throw new Error('Repository not found');
        
        const gitService = this.gitServiceFactory.create(repo.path);
        await gitService.deleteTag(tagName);
        return repo;
    }
}

module.exports = new RepositoryAppService();
