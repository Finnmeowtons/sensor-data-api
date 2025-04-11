const pool = require("../connection");
const express = require('express');
const router = express.Router();


class AnalyticController {
    static async rawData(req, res) {
        const { page = 1, limit = 50, device } = req.query;
        const offset = (page - 1) * limit;
    
        try {
            let dataQuery = 'SELECT * FROM data';
            let countQuery = 'SELECT COUNT(*) as total FROM data';
            const queryParams = [];
    
            if (device && device != '0') {
                dataQuery += ' WHERE device_id = ?';
                countQuery += ' WHERE device_id = ?';
                queryParams.push(device);
            }
    
            dataQuery += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
            queryParams.push(parseInt(limit), parseInt(offset));
    
            const [rows] = await pool.query(dataQuery, queryParams);
            const [[{ total }]] = await pool.query(countQuery, device ? [device] : []);
    
            res.json({
                total,
                data: rows,
            });
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
        if (!device) {
            return res.status(404).json({ error: "No device specified" });
        }
    
        let startDate = start;
        let endDate = end;
    
        if (!startDate || !endDate) {
            const today = new Date();
            endDate = today.toISOString().split('T')[0];
            const past = new Date();
            past.setDate(today.getDate() - 7);
            startDate = past.toISOString().split('T')[0];
        }
    
        try {
            // 1. Get real data
            const [dataRows] = await pool.query(`
                SELECT 
                    FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / 600) * 600) AS interval_start,
                    AVG(temperature) AS avg_temp,
                    AVG(humidity) AS avg_humidity,
                    AVG(soil_moisture_percentage) AS avg_moisture,
                    AVG(soil_ph) AS avg_ph
                FROM data
                WHERE device_id = ? AND timestamp BETWEEN ? AND ?
                GROUP BY interval_start
                ORDER BY interval_start ASC
            `, [device, startDate, endDate]);
    
            // 2. Generate full 10-min intervals in JS
            const result = [];
            const intervalMap = new Map();
            dataRows.forEach(row => intervalMap.set(row.interval_start.toISOString(), row));
    
            let current = new Date(startDate);
            const endTime = new Date(endDate);
            while (current <= endTime) {
                const intervalStr = new Date(current.getTime() - current.getTime() % (600000)).toISOString(); // Round down to nearest 10 min
    
                result.push(intervalMap.get(intervalStr) || {
                    interval_start: intervalStr,
                    avg_temp: null,
                    avg_humidity: null,
                    avg_moisture: null,
                    avg_ph: null
                });
    
                current = new Date(current.getTime() + 600000); // add 10 minutes
            }
    
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

}

module.exports = AnalyticController;
