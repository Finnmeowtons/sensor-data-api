const pool = require("../connection");
const express = require('express');
const router = express.Router();

class AnalyticController {
    static async rawData(req, res) {
        const { page = 1, limit = 50, device } = req.query;
        if (!device){
            res.status(404).json({error: "No device specified"})
            return
        }
        const offset = (page - 1) * limit;

        try {
            const [rows] = await pool.query(
                'SELECT * FROM data WHERE device_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
                [device, parseInt(limit), parseInt(offset)]
            );

            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

    // 2️⃣ Aggregated analytics
    static async analyticsData(req, res) {
        const { device } = req.query;
        if (!device){
            res.status(404).json({error: "No device specified"})
            return
        }

        try {
            const [rows] = pool.query(`
                SELECT 
                    COUNT(*) as total_entries,
                    AVG(value) as average,
                    MIN(value) as minimum,
                    MAX(value) as maximum
                FROM data
                WHERE device_id = ? 
            `, [device]);
    
            res.json(rows[0]);

        } catch (err) {
            res.status(500).json({ error: err.message });

        }
    }

    static async graphData(req, res) {
        const { start, end, device } = req.query;
        if (!device){
            res.status(404).json({error: "No device specified"})
            return
        }
        let startDate = start;
        let endDate = end;
    
        // Default: last 7 days
        if (!startDate || !endDate) {
            const today = new Date();
            endDate = today.toISOString().split('T')[0];
            const past = new Date();
            past.setDate(today.getDate() - 7);
            startDate = past.toISOString().split('T')[0];
        }
    
        try {
            const [rows] = await pool.query(`
                SELECT 
                    id,
                    timestamp,
                    temperature,
                    humidity,
                    soil_moisture_percentage,
                    soil_ph
                FROM data
                WHERE device_id = ? AND timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
            `, [device, startDate, endDate]);
    
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

}

module.exports = AnalyticController;
