const { Repository, ScheduledTask } = require('../models');
const simpleGit = require('simple-git');
const fs = require('fs');

const { spawn } = require('child_process');

exports.browseFolder = (req, res) => {
    // PowerShell command to open Folder Browser Dialog
    const psCommand = `
        Add-Type -AssemblyName System.Windows.Forms
        $f = New-Object System.Windows.Forms.FolderBrowserDialog
        $f.ShowDialog() | Out-Null
        $f.SelectedPath
    `;

    const child = spawn('powershell.exe', ['-Command', psCommand]);
    let path = '';

    child.stdout.on('data', (data) => {
        path += data.toString().trim();
    });

    child.on('close', (code) => {
        if (path) {
            res.json({ path });
        } else {
            res.json({ cancelled: true });
        }
    });
};

exports.index = async (req, res) => {
    try {
        // Fetch repos including their scheduled tasks
        const dbRepos = await Repository.findAll({
            include: [{ model: ScheduledTask }]
        });

        // Enhance repos with Git data (Last Commit Date) in parallel
        const repositories = await Promise.all(dbRepos.map(async (repoInstance) => {
            const repo = repoInstance.toJSON(); // Convert to plain object
            const git = simpleGit(repo.path);
            
            try {
                // Get last commit info
                const log = await git.log({ maxCount: 1 });
                repo.lastCommitDate = log.latest ? new Date(log.latest.date) : new Date(0);
                repo.lastCommitMsg = log.latest ? log.latest.message : 'No commits yet';
            } catch (err) {
                // If repo path is invalid or empty
                repo.lastCommitDate = new Date(0); // Put at the end
                repo.lastCommitMsg = 'Error accessing git';
            }

            // Calculate pending tasks
            repo.pendingTasksCount = repo.scheduledTasks.filter(t => t.status === 'pending').length;
            
            return repo;
        }));

        // Sort by Last Commit Date (Newest First)
        repositories.sort((a, b) => b.lastCommitDate - a.lastCommitDate);

        res.render('index', { repositories });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching repositories');
    }
};

exports.create = (req, res) => {
    res.render('add-repo', { error: null });
};

exports.store = async (req, res) => {
    const { name, path: repoPath, method, url } = req.body;
    
    try {
        if (method === 'clone') {
            // CLONE LOGIC
            if (fs.existsSync(repoPath)) {
                return res.render('add-repo', { error: 'Destination path already exists. Please choose a new folder.' });
            }

            // Create directory (optional, simple-git might handle it, but safer to let git do it or just pass the parent)
            // Actually, simple-git clone takes (repo, localPath). LocalPath must be empty or not exist.
            
            const git = simpleGit();
            await git.clone(url, repoPath);

        } else {
            // LOCAL IMPORT LOGIC
            const git = simpleGit(repoPath);
            const isRepo = await git.checkIsRepo(); // Check if it's a repo
            
            if (!isRepo) {
                return res.render('add-repo', { error: 'The provided path is not a valid Git repository.' });
            }
        }

        // Save to DB
        await Repository.create({ name, path: repoPath });
        res.redirect('/');

    } catch (error) {
        console.error(error);
        res.render('add-repo', { error: 'Error processing repository: ' + error.message });
    }
};

exports.destroy = async (req, res) => {
    const { id } = req.params;
    try {
        await Repository.destroy({ where: { id } });
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting repository');
    }
};

exports.show = async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const repo = await Repository.findByPk(id);
        if (!repo) return res.status(404).send('Repository not found');

        const git = simpleGit(repo.path);
        
        // Parallel execution for speed
        const [status, log, tags, scheduledTasks, branches] = await Promise.all([
            git.status(),
            git.log({ maxCount: limit }),
            git.tags(),
            ScheduledTask.findAll({ 
                where: { repoId: id, status: 'pending' },
                order: [['scheduledTime', 'ASC']]
            }),
            git.branchLocal()
        ]);

        res.render('repo-detail', { repo, status, log, tags, limit, scheduledTasks, branches });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading repository details: ' + error.message);
    }
};

exports.checkout = async (req, res) => {
    const { id } = req.params;
    const { branch } = req.body;
    try {
        const repo = await Repository.findByPk(id);
        const git = simpleGit(repo.path);
        
        await git.checkout(branch);
        res.redirect(`/repo/${id}?message=Switched+to+branch+${branch}`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Checkout+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.commit = async (req, res) => {
    const { id } = req.params;
    const { message, files } = req.body; // files can be an array or 'all'

    try {
        const repo = await Repository.findByPk(id);
        const git = simpleGit(repo.path);

        if (files === 'all') {
            await git.add('.');
        } else if (Array.isArray(files)) {
            await git.add(files);
        } else if (files) {
             await git.add(files);
        }

        await git.commit(message);
        res.redirect(`/repo/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Commit failed: ' + error.message);
    }
};

exports.push = async (req, res) => {
    const { id } = req.params;
    try {
        const repo = await Repository.findByPk(id);
        const git = simpleGit(repo.path);
        
        await git.push();
        res.redirect(`/repo/${id}?message=Push+Successful`);
    } catch (error) {
        console.error(error);
        res.redirect(`/repo/${id}?error=Push+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.pull = async (req, res) => {
    const { id } = req.params;
    try {
        const repo = await Repository.findByPk(id);
        const git = simpleGit(repo.path);
        
        await git.pull();
        res.redirect(`/repo/${id}?message=Pull+Successful`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Pull+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.pullTags = async (req, res) => {
    const { id } = req.params;
    try {
        const repo = await Repository.findByPk(id);
        const git = simpleGit(repo.path);
        
        // Execute 'git pull --tags'
        await git.pull(['--tags']);
        res.redirect(`/repo/${id}?message=Tags+Pulled`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Pull+Tags+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.createTag = async (req, res) => {
    const { id } = req.params;
    const { tagName, message, commitHash } = req.body;

    try {
        const repo = await Repository.findByPk(id);
        const git = simpleGit(repo.path);
        
        // If commitHash is provided, tag that specific commit. 
        if (commitHash) {
             await git.addAnnotatedTag(tagName, message || tagName, commitHash);
        } else {
            // Default behavior (HEAD)
            if (message) {
                await git.addAnnotatedTag(tagName, message);
            } else {
                await git.addTag(tagName);
            }
        }
        res.redirect(`/repo/${id}`);
    } catch (error) {
         res.redirect(`/repo/${id}?error=Tag+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.pushTags = async (req, res) => {
    const { id } = req.params;
    try {
        const repo = await Repository.findByPk(id);
        const git = simpleGit(repo.path);
        
        await git.pushTags();
        res.redirect(`/repo/${id}?message=Tags+Pushed`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Push+Tags+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.deleteTag = async (req, res) => {
    const { id, tagName } = req.params;
    try {
        const repo = await Repository.findByPk(id);
        const git = simpleGit(repo.path);
        
        await git.tagDelete(tagName);
        res.redirect(`/repo/${id}?message=Tag+Deleted`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Delete+Tag+Failed:+${encodeURIComponent(error.message)}`);
    }
};
