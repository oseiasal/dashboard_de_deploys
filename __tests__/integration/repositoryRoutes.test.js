const request = require('supertest');
const app = require('../../src/app');
const { sequelize, Repository } = require('../../src/models');

// Mock simple-git
jest.mock('simple-git');
const simpleGit = require('simple-git');

// Mock implementation
const mockGit = {
    checkIsRepo: jest.fn().mockResolvedValue(true),
    log: jest.fn().mockResolvedValue({ latest: { date: new Date(), message: 'test' }, all: [] }),
    status: jest.fn().mockResolvedValue({ files: [], current: 'main' }),
    tags: jest.fn().mockResolvedValue({ all: [] }),
    branchLocal: jest.fn().mockResolvedValue({ current: 'main', all: ['main'] }),
    listRemote: jest.fn().mockResolvedValue(''),
    add: jest.fn().mockResolvedValue(),
    commit: jest.fn().mockResolvedValue(),
    push: jest.fn().mockResolvedValue(),
    pull: jest.fn().mockResolvedValue(),
    checkout: jest.fn().mockResolvedValue(),
    pushTags: jest.fn().mockResolvedValue(),
    addTag: jest.fn().mockResolvedValue(),
    tagDelete: jest.fn().mockResolvedValue(),
    clone: jest.fn().mockResolvedValue(),
    addAnnotatedTag: jest.fn().mockResolvedValue(),
};

// simpleGit() returns the mockGit object
simpleGit.mockReturnValue(mockGit);

describe('Repository Integration Tests', () => {
    beforeAll(async () => {
        // Sync database (in-memory)
        await sequelize.sync({ force: true });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET / should return 200 and render index', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.text).toContain('Dashboard');
    });

    test('POST /add should create a repository and redirect', async () => {
        const repoData = {
            name: 'Test Repo',
            path: '/tmp/test-repo',
            method: 'local'
        };

        const response = await request(app)
            .post('/add')
            .send(repoData);

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/');

        // Verify DB
        const repo = await Repository.findOne({ where: { name: 'Test Repo' } });
        expect(repo).toBeTruthy();
        expect(repo.path).toBe('/tmp/test-repo');
    });

    test('GET /repo/:id should return details', async () => {
        // Create a repo first
        const repo = await Repository.create({ name: 'Detail Repo', path: '/tmp/detail-repo' });

        const response = await request(app).get(`/repo/${repo.id}`);
        if (response.status !== 200) {
            console.error('Test Failed Response:', response.text);
        }
        expect(response.status).toBe(200);
        expect(response.text).toContain('Detail Repo');
        
        // Verify git calls
        expect(simpleGit).toHaveBeenCalledWith('/tmp/detail-repo');
        expect(mockGit.status).toHaveBeenCalled();
        expect(mockGit.log).toHaveBeenCalled();
    });

    test('POST /repo/:id/push should trigger git push', async () => {
        const repo = await Repository.create({ name: 'Push Repo', path: '/tmp/push-repo' });

        const response = await request(app).post(`/repo/${repo.id}/push`);
        
        expect(response.status).toBe(302);
        expect(mockGit.push).toHaveBeenCalled();
    });

    test('POST /repo/:id/checkout should switch branch', async () => {
        const repo = await Repository.create({ name: 'Checkout Repo', path: '/tmp/checkout-repo' });
        
        const response = await request(app)
            .post(`/repo/${repo.id}/checkout`)
            .send({ branch: 'develop' });

        expect(response.status).toBe(302);
        expect(mockGit.checkout).toHaveBeenCalledWith('develop');
    });

    test('POST /repo/:id/commit should add files and commit', async () => {
        const repo = await Repository.create({ name: 'Commit Repo', path: '/tmp/commit-repo' });
        
        const response = await request(app)
            .post(`/repo/${repo.id}/commit`)
            .send({ message: 'wip', files: 'all' });

        expect(response.status).toBe(302);
        expect(mockGit.add).toHaveBeenCalledWith('.');
        expect(mockGit.commit).toHaveBeenCalledWith('wip');
    });

    test('POST /repo/:id/pull should pull changes', async () => {
        const repo = await Repository.create({ name: 'Pull Repo', path: '/tmp/pull-repo' });
        
        const response = await request(app).post(`/repo/${repo.id}/pull`);

        expect(response.status).toBe(302);
        expect(mockGit.pull).toHaveBeenCalled();
    });

    test('POST /repo/:id/tag should create a tag', async () => {
        const repo = await Repository.create({ name: 'Tag Repo', path: '/tmp/tag-repo' });
        
        const response = await request(app)
            .post(`/repo/${repo.id}/tag`)
            .send({ tagName: 'v1.0.0', message: 'Release v1' });

        expect(response.status).toBe(302);
        // createTag in GitService calls addAnnotatedTag if message provided
        expect(mockGit.addAnnotatedTag).toHaveBeenCalledWith('v1.0.0', 'Release v1');
    });

    test('DELETE /repo/:id/tag/:tagName should delete tag', async () => {
        const repo = await Repository.create({ name: 'Del Tag Repo', path: '/tmp/deltag-repo' });
        
        const response = await request(app).delete(`/repo/${repo.id}/tag/v1.0.0`);

        expect(response.status).toBe(302);
        expect(mockGit.tagDelete).toHaveBeenCalledWith('v1.0.0');
    });

    test('POST /repo/:id/push-tags should push tags', async () => {
        const repo = await Repository.create({ name: 'Push Tags Repo', path: '/tmp/pushtags-repo' });
        
        const response = await request(app).post(`/repo/${repo.id}/push-tags`);

        expect(response.status).toBe(302);
        expect(mockGit.pushTags).toHaveBeenCalled();
    });

    test('POST /repo/:id/pull-tags should pull tags', async () => {
        const repo = await Repository.create({ name: 'Pull Tags Repo', path: '/tmp/pulltags-repo' });
        
        const response = await request(app).post(`/repo/${repo.id}/pull-tags`);

        expect(response.status).toBe(302);
        expect(mockGit.pull).toHaveBeenCalledWith(['--tags']);
    });
});
