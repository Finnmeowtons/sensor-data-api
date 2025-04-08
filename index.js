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
        

        const {
            device_id,
            temperature,
            humidity,
            soil_moisture_raw,
            soil_moisture_percentage,
            soil_temperature,
            soil_ph = null,
            nitrogen = null,
            phosphorus = null,
            potassium = null
        } = data;

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
