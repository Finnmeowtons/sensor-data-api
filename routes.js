const express = require('express');
const router = express.Router();
const analyticsController = require('./controllers/analyticsController.js');

router.get('/raw-data', analyticsController.rawData);
router.get('/aggregated-data', analyticsController.aggregatedData);


module.exports = router;