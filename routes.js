const express = require('express');
const router = express.Router();
const analyticsController = require('./controllers/analyticsController.js');

router.get('/raw-data', analyticsController.rawData);
router.get('/analytics-data', analyticsController.analyticsData);
router.get('/graph-data', analyticsController.graphData);


module.exports = router;