const { sequelize, Repository, ScheduledTask } = require('../../src/models');
const scheduleAppService = require('../../src/services/ScheduleAppService');
const TaskStrategyFactory = require('../../src/strategies/TaskStrategyFactory');

// Mock GitService
jest.mock('../../src/services/gitService');
const GitService = require('../../src/services/gitService');

// Mock node-schedule
jest.mock('node-schedule', () => ({
    scheduleJob: jest.fn((id, time, cb) => cb()), // execute immediately for test
    scheduledJobs: {},
    cancelJob: jest.fn()
}));

describe('ScheduleAppService Unit Tests', () => {
    let repo;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
        repo = await Repository.create({ name: 'Unit Task Repo', path: '/tmp/unit-task-repo' });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup GitService mock instance
        GitService.mockImplementation(() => ({
            push: jest.fn(),
            pushTags: jest.fn(),
            pushToRemote: jest.fn(),
            getLocalBranches: jest.fn().mockResolvedValue({ current: 'main' })
        }));
    });

    test('executeTask should run strategy and complete task', async () => {
        // Create a pending task directly in DB
        const task = await ScheduledTask.create({
            repoId: repo.id,
            type: 'push',
            scheduledTime: new Date()
        });

        // Execute
        await scheduleAppService.executeTask(task.id);

        // Verify status
        const updatedTask = await ScheduledTask.findByPk(task.id);
        expect(updatedTask.status).toBe('completed');
        expect(updatedTask.log).toContain('successfully');
        
        // Verify GitService usage
        expect(GitService).toHaveBeenCalled(); 
    });

    test('executeTask should handle errors', async () => {
        // Mock GitService to throw
        GitService.mockImplementation(() => ({
            push: jest.fn().mockRejectedValue(new Error('Git Error'))
        }));

        const task = await ScheduledTask.create({
            repoId: repo.id,
            type: 'push',
            scheduledTime: new Date()
        });

        await scheduleAppService.executeTask(task.id);

        const updatedTask = await ScheduledTask.findByPk(task.id);
        expect(updatedTask.status).toBe('failed');
        expect(updatedTask.log).toBe('Git Error');
    });
});
