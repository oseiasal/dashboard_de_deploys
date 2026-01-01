const repositoryAppService = require('../services/RepositoryAppService');

exports.index = async (req, res) => {
    try {
        const repositories = await repositoryAppService.getAllRepositories();
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
    try {
        await repositoryAppService.createRepository(req.body);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.render('add-repo', { error: 'Error processing repository: ' + error.message });
    }
};

exports.destroy = async (req, res) => {
    try {
        await repositoryAppService.deleteRepository(req.params.id);
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting repository');
    }
};

exports.show = async (req, res) => {
    try {
        const options = {
            limit: parseInt(req.query.limit) || 10,
            tagPage: parseInt(req.query.tagPage) || 1,
            tagLimit: 10,
            tagSearch: req.query.tagSearch || ''
        };

        const data = await repositoryAppService.getRepositoryDetails(req.params.id, options);
        res.render('repo-detail', data);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading repository details: ' + error.message);
    }
};

exports.checkout = async (req, res) => {
    const { id } = req.params;
    const { branch } = req.body;
    try {
        await repositoryAppService.checkoutBranch(id, branch);
        res.redirect(`/repo/${id}?message=Switched+to+branch+${branch}`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Checkout+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.commit = async (req, res) => {
    const { id } = req.params;
    const { message, files } = req.body;
    try {
        await repositoryAppService.commitChanges(id, message, files);
        res.redirect(`/repo/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Commit failed: ' + error.message);
    }
};

exports.push = async (req, res) => {
    const { id } = req.params;
    try {
        await repositoryAppService.pushRepository(id);
        res.redirect(`/repo/${id}?message=Push+Successful`);
    } catch (error) {
        console.error(error);
        res.redirect(`/repo/${id}?error=Push+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.pull = async (req, res) => {
    const { id } = req.params;
    try {
        await repositoryAppService.pullRepository(id);
        res.redirect(`/repo/${id}?message=Pull+Successful`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Pull+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.pullTags = async (req, res) => {
    const { id } = req.params;
    try {
        await repositoryAppService.pullTags(id);
        res.redirect(`/repo/${id}?message=Tags+Pulled`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Pull+Tags+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.createTag = async (req, res) => {
    const { id } = req.params;
    try {
        await repositoryAppService.createTag(id, req.body);
        res.redirect(`/repo/${id}`);
    } catch (error) {
         res.redirect(`/repo/${id}?error=Tag+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.pushTags = async (req, res) => {
    const { id } = req.params;
    try {
        await repositoryAppService.pushTags(id);
        res.redirect(`/repo/${id}?message=Tags+Pushed`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Push+Tags+Failed:+${encodeURIComponent(error.message)}`);
    }
};

exports.deleteTag = async (req, res) => {
    const { id, tagName } = req.params;
    try {
        await repositoryAppService.deleteTag(id, tagName);
        res.redirect(`/repo/${id}?message=Tag+Deleted`);
    } catch (error) {
        res.redirect(`/repo/${id}?error=Delete+Tag+Failed:+${encodeURIComponent(error.message)}`);
    }
};
