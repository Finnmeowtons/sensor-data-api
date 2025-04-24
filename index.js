const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.json());


// In-memory storage for device IPs
const deviceIpMap = {};

// ESP32 posts its IP here
app.post('/api/register-ip', (req, res) => {
    const { device_id, ip } = req.body;
    if (!device_id || !ip) {
        return res.status(400).json({ error: "Missing device_id or ip" });
    }

    deviceIpMap[device_id] = {
        ip,
        timestamp: new Date().toISOString()
    };

    console.log(`🌐 IP registered: ${device_id} -> ${ip}`);
    res.json({ message: "IP registered successfully" });
});

// Flutter fetches latest IP for a device
app.get('/api/device-ip', (req, res) => {
    const { device_id } = req.query;
    if (!device_id || !deviceIpMap[device_id]) {
        return res.status(404).json({ error: "Device IP not found" });
    }

    res.json({
        device_id,
        ...deviceIpMap[device_id]
    });
});

app.use('/api', routes);
app.listen(PORT, () => {
    console.log('Server running on http://localhost:3000');
  });



const mqtt = require("mqtt");
const connection = require("./connection");
const mqttBroker = 'mqtt://157.245.204.46:1883';
const mqttClient = mqtt.connect(mqttBroker);


let currentMode = "tank";

mqttClient.on("connect", () => {
    console.log("Connected to MQTT broker");
    mqttClient.subscribe("sensor/+/data", (err) => {
        if (!err) {
            console.log("Subscribed to sensor data topic");
        }
    });

    mqttClient.subscribe("water-level/full-state", (err) => {
        if (!err) console.log("Subscribed to water-level/full-state");
    });
});

mqttClient.on("message", (topic, message) => {
    try {
        if (topic === "water-level/full-state") {
            const state = JSON.parse(message.toString());
            if (state.mode) {
                currentMode = state.mode.toLowerCase();
                console.log(`📡 Current mode updated to: ${currentMode}`);
            }
            return; // Done with full-state
        }

        const data = JSON.parse(message.toString());

        if (!data.device_id) {
            console.error("Invalid JSON: Missing device_id", data);
            return;
        }
        

        let {
            device_id,
            temperature,
            humidity,
            soil_moisture_raw,
            soil_moisture_percentage,
            soil_temperature,
            soil_ph,
            nitrogen = null,
            phosphorus = null,
            potassium = null
        } = data;

        // Check if soil_ph is "N/A" or a string and set it to null
        if (typeof soil_ph === 'string') {
            soil_ph = soil_ph.toUpperCase();
        } else {
            console.warn("⚠️ soil_ph is not a string:", soil_ph);
            soil_ph = String(soil_ph).toUpperCase(); // force it to string just in case
        }
        

        console.log(`${new Date().toISOString()} - Received data from device ${device_id}`);

        // Insert all data into 'data' table
        const query = `
            INSERT INTO data (
                device_id, temperature, humidity, soil_moisture_raw,
                soil_moisture_percentage, soil_temperature, soil_ph,
                nitrogen, phosphorus, potassium
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            device_id,
            temperature,
            humidity,
            soil_moisture_raw,
            soil_moisture_percentage,
            soil_temperature,
            soil_ph,
            nitrogen,
            phosphorus,
            potassium
        ];

        connection.query(query, values, (err, result) => {
            if (err) {
                console.error("❌ Database insert error:", err);
            } else {
                console.log("✅ Data inserted successfully");
            }
        });

        // Auto-pump control based on soil moisture, only if mode is MAIS
        if (soil_moisture_raw !== undefined && currentMode === "mais") {
            const pumpState = soil_moisture_raw <= 200;
            console.log(`💧 Soil moisture: ${soil_moisture_raw}. Sending pump state: ${pumpState}`);
            mqttClient.publish("water-level/pump-control", pumpState.toString());
        } else if (soil_moisture_raw !== undefined) {
            console.log(`🚫 Skipping pump control. Current mode is "${currentMode}"`);
        }
    } catch (error) {
        console.error("❌ Error parsing MQTT message:", error);
    }
});
