const mqtt = require("mqtt");
const connection = require("./connection");

const mqttBroker = 'mqtt://157.245.204.46:1883';
const mqttClient = mqtt.connect(mqttBroker);

let lastValues = {};

mqttClient.on("connect", () => {
    console.log("Connected to MQTT broker");
    mqttClient.subscribe("sensor/+/data", (err) => {
        if (!err) {
            console.log("Subscribed to sensor data topic");
        }
    });
});

mqttClient.on("message", (topic, message) => {
    try {
        const parsedMessage = JSON.parse(message.toString());
        
        if (!parsedMessage.device_id) {
            console.error("Invalid JSON: Missing device_id", parsedMessage);
            return;
        }

        const deviceId = parsedMessage.device_id;
        console.log(`${new Date().toISOString()} - Received data from device ${deviceId}`);

        // Initialize storage for the device if not exists
        if (!lastValues[deviceId]) {
            lastValues[deviceId] = {};
        }

        // List of sensors and their values
        const sensorData = {
            "temperature": parsedMessage.temperature,
            "humidity": parsedMessage.humidity,
            "soil_moisture_raw": parsedMessage.soil_moisture_raw,
            "soil_moisture_percentage": parsedMessage.soil_moisture_percentage,
            "soil_temperature": parsedMessage.soil_temperature,
            "soil_ph": parsedMessage.soil_ph
        };

        // Save only if the value has changed
        Object.entries(sensorData).forEach(([sensorType, value]) => {
            if (value !== undefined && lastValues[deviceId][sensorType] !== value) {
                lastValues[deviceId][sensorType] = value;
                saveToDatabase(deviceId, sensorType, value);

                // if (sensorType === "soil_moisture_raw" && value === "dry") {
                //     const faucetState = true; // Faucet turns ON if soil is dry
                //     const payload = JSON.stringify({ faucet_state: faucetState });

                //     console.log(`🚰 Soil is dry. Sending faucet state: ${faucetState}`);
                //     mqttClient.publish("water-level/full-state", payload);
                // }
            }
        });

    } catch (error) {
        console.error("Error parsing MQTT message:", error);
    }
});

function saveToDatabase(deviceId, sensorType, value) {
    console.log(`📌 Saving: Device ${deviceId} - ${sensorType}: ${value}`);
    connection.query(
        "INSERT INTO readings (device_id, sensor_type, value) VALUES (?, ?, ?)", 
        [deviceId, sensorType, value], 
        (err, result) => {
            if (err) console.error("❌ Database insert error:", err);
        }
    );
}
