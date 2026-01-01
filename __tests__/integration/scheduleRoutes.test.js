const request = require('supertest');
const app = require('../../src/app');
const { sequelize, Repository, ScheduledTask } = require('../../src/models');

// Mock simple-git via GitService
jest.mock('simple-git');
const simpleGit = require('simple-git');

// Mock node-schedule
jest.mock('node-schedule', () => ({
    scheduleJob: jest.fn(),
    scheduledJobs: {},
    cancelJob: jest.fn()
}));
const schedule = require('node-schedule');

const mockGit = {
    push: jest.fn().mockResolvedValue(),
    pushTags: jest.fn().mockResolvedValue(),
    branchLocal: jest.fn().mockResolvedValue({ current: 'main' }),
};
simpleGit.mockReturnValue(mockGit);


describe('Schedule Routes Integration Tests', () => {
    let repo;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
        repo = await Repository.create({ name: 'Schedule Repo', path: '/tmp/schedule-repo' });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('POST /repo/:id/schedule should create a task', async () => {
        // Schedule for 1 hour from now
        const futureDate = new Date(Date.now() + 3600000).toISOString();

        const response = await request(app)
            .post(`/repo/${repo.id}/schedule`)
            .send({
                type: 'push',
                datetime: futureDate
            });

        expect(response.status).toBe(302);
        
        const task = await ScheduledTask.findOne({ where: { repoId: repo.id } });
        expect(task).toBeTruthy();
        expect(task.type).toBe('push');
        expect(task.status).toBe('pending');
    });

    test('DELETE /repo/:id/schedule/:taskId should cancel task', async () => {
        // Create a task manually
        const futureDate = new Date(Date.now() + 3600000);
        const task = await ScheduledTask.create({
            repoId: repo.id,
            type: 'push-tags',
            scheduledTime: futureDate
        });

        const response = await request(app)
            .delete(`/repo/${repo.id}/schedule/${task.id}`);

        expect(response.status).toBe(302);

        // Verify it is gone
        const deletedTask = await ScheduledTask.findByPk(task.id);
        expect(deletedTask).toBeNull();
    });
});
