const express = require('express');
const router = express.Router();
const repositoryController = require('../controllers/repositoryController');
const scheduleController = require('../controllers/scheduleController');

router.get('/', repositoryController.index);
router.get('/add', repositoryController.create);
router.post('/add', repositoryController.store);
router.delete('/delete/:id', repositoryController.destroy);

router.get('/repo/:id', repositoryController.show);
router.post('/repo/:id/checkout', repositoryController.checkout);
router.post('/repo/:id/commit', repositoryController.commit);
router.post('/repo/:id/push', repositoryController.push);
router.post('/repo/:id/pull', repositoryController.pull);
router.post('/repo/:id/tag', repositoryController.createTag);
router.delete('/repo/:id/tag/:tagName', repositoryController.deleteTag);
router.post('/repo/:id/push-tags', repositoryController.pushTags);
router.post('/repo/:id/pull-tags', repositoryController.pullTags);

// Scheduler Routes
router.get('/repo/:id/schedule', scheduleController.form);
router.post('/repo/:id/schedule', scheduleController.schedule);
router.post('/repo/:id/schedule/cancel/:taskId', scheduleController.cancel); // Changed to POST and updated path
router.post('/repo/:id/schedule/tag/:tagName', scheduleController.scheduleSingleTag); // Updated path
router.post('/repo/:id/schedule/commit/:commitHash', scheduleController.scheduleCommit); // Updated path

module.exports = router;
