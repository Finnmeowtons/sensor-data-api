const mqtt = require("mqtt");
const connection = require("./connection");

const mqttBroker = 'mqtt://157.245.204.46:1883';
const mqttClient = mqtt.connect(mqttBroker);

let lastValues = {};

mqttClient.on("connect", () => {
    console.log("Connected to MQTT broker");
    const topics = [
        "sensor/+/temperature",
        "sensor/+/humidity",
        "sensor/+/soilTemperature",
        "sensor/+/soilMoisture",
        "sensor/+/phLevel",
        "device/+/waterPump",
        "device/+/faucet"
    ];

    mqttClient.subscribe(topics, (err) => {
        if (!err) {
            console.log("Subscribed to all sensor and device topics");
        }
    });
});

mqttClient.on("message", (topic, message) => {
  try {
      const parsedMessage = JSON.parse(message.toString());
      if (!parsedMessage.deviceId || parsedMessage.value === undefined) {
          console.error("Invalid JSON format", parsedMessage);
          return;
      }

      const deviceId = parsedMessage.deviceId;
      const value = parsedMessage.value;
      console.log(new Date().toISOString());
      
      const sensorType = topic.split("/")[2];
      
      if (!lastValues[deviceId]) {
          lastValues[deviceId] = {};
      }

      if (lastValues[deviceId][sensorType] !== value) {
          lastValues[deviceId][sensorType] = value;
          saveToDatabase(deviceId, sensorType, value);
      }
  } catch (error) {
      console.error("Error parsing message", error);
  }
});

function saveToDatabase(deviceId, sensorType, value) {
  console.log(`Saving device ${deviceId} - ${sensorType}: ${value}`);
  connection.query("INSERT INTO readings (device_id, sensor_type, value) VALUES (?, ?, ?)", 
      [deviceId, sensorType, value], (err, result) => {
          if (err) console.error("Database insert error:", err);
      });
}

