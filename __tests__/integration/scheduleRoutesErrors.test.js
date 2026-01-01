const request = require('supertest');
const app = require('../../src/app');
const { sequelize, Repository, ScheduledTask } = require('../../src/models');

describe('Schedule Routes Integration Tests (Edge Cases & Errors)', () => {
    let repo;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
        repo = await Repository.create({ 
            name: 'Integration Test Repo', 
            path: '/tmp/integration-test-repo' 
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(async () => {
        await ScheduledTask.destroy({ where: {} });
    });

    test('POST /repo/:id/schedule - Should fail when scheduling in the past', async () => {
        const pastDate = new Date();
        pastDate.setFullYear(pastDate.getFullYear() - 1); // 1 year ago

        const res = await request(app)
            .post(`/repo/${repo.id}/schedule`)
            .send({
                type: 'push',
                datetime: pastDate.toISOString()
            });

        expect(res.status).toBe(302);
        const location = decodeURIComponent(res.header.location);
        expect(location).toContain('error=Schedule time must be in the future');
    });

    test('POST /repo/:id/schedule/tag/:tagName - Should schedule a single tag push', async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const res = await request(app)
            .post(`/repo/${repo.id}/schedule/tag/v1.0.0`)
            .send({
                datetime: futureDate.toISOString()
            });

        expect(res.status).toBe(302);
        expect(res.header.location).toContain('message=Push+for+tag+v1.0.0+scheduled');

        // Verify DB
        const task = await ScheduledTask.findOne({ where: { repoId: repo.id, type: 'push-tag-single' } });
        expect(task).toBeDefined();
        expect(task.target).toBe('v1.0.0');
    });

    test('POST /repo/:id/schedule/commit/:commitHash - Should schedule a commit push', async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const res = await request(app)
            .post(`/repo/${repo.id}/schedule/commit/abcdef123456`)
            .send({
                datetime: futureDate.toISOString()
            });

        expect(res.status).toBe(302);
        // Expect partial match as substring(0,7) is used
        expect(res.header.location).toContain('message=Push+for+commit+abcdef1+scheduled'); 

        // Verify DB
        const task = await ScheduledTask.findOne({ where: { repoId: repo.id, type: 'push-commit' } });
        expect(task).toBeDefined();
        expect(task.target).toBe('abcdef123456');
    });

    test('POST /repo/:id/schedule/cancel/:taskId - Should handle cancellation of non-existent task', async () => {
        const res = await request(app)
            .post(`/repo/${repo.id}/schedule/cancel/9999`);

        expect(res.status).toBe(302);
        expect(res.header.location).toContain('error=Cancellation+Failed');
    });

    test('POST /repo/:id/schedule - Should handle generic errors gracefully', async () => {
        // Force an error by sending invalid data (e.g., missing datetime) which causes Date parsing issues or DB errors
        const res = await request(app)
            .post(`/repo/${repo.id}/schedule`)
            .send({
                type: 'push',
                datetime: 'invalid-date' 
            });

        // The service throws "Invalid Date" or similar, controller catches and redirects
        expect(res.status).toBe(302);
        // We now expect "Invalid date provided" or similar error in the URL
        const location = decodeURIComponent(res.header.location);
        expect(location).toContain('error');
    });
});
