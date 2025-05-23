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


let currentMode = "mais";

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
            nitrogen,
            phosphorus,
            potassium
        } = data;

        if (soil_ph === "N/A" || soil_ph === "n/a" || soil_ph === "NA" || soil_ph === "na" || soil_ph === undefined) {
            soil_ph = null;
        } else {
            soil_ph = parseFloat(soil_ph);
            if (isNaN(soil_ph)) soil_ph = null;
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

        if (currentMode === "mais") {
            // Temperature > 30°C triggers irrigation
            if (temperature !== undefined && temperature > 30) {
                console.log(`🌡️ High temperature (${temperature}°C) detected. Irrigation should be triggered.`);
                mqttClient.publish("water-level/faucet-control", "true");
            } else {
                mqttClient.publish("water-level/faucet-control", "false");
            }

            // Soil Moisture < 30% activates water pump
            if (soil_moisture_percentage !== undefined && soil_moisture_percentage < 30) {
                console.log(`🌱 Low soil moisture (${soil_moisture_percentage}%) detected. Irrigation should be triggered.`);
                mqttClient.publish("water-level/faucet-control", "true");
            } else {
                mqttClient.publish("water-level/faucet-control", "false");
            }

            // Humidity < 50% indicates stress condition
            if (humidity !== undefined && humidity < 50) {
                console.log(`💨 Low humidity (${humidity}%) detected. Irrigation should be triggered.`);
                mqttClient.publish("water-level/faucet-control", "true");
            } else {
                mqttClient.publish("water-level/faucet-control", "false");
            }
        }
    } catch (error) {
        console.error("❌ Error parsing MQTT message:", error);
    }
});
