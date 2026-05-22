const express = require("express");
const router = express.Router();
const { sensors, readings, generateGasReading, generateSeismicReading, generateXRFReading } = require("../store");

router.get("/", (req, res) => {
  const mineId = req.query.mine_id;
  const result = mineId 
    ? sensors.filter(s => s.mine_id === mineId) 
    : sensors;
  res.json(result);
});

router.get("/:id/history", (req, res) => {
  const sensorId = req.params.id;
  const sensor = sensors.find(s => s.id === sensorId);
  
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });
  
  const history = readings[sensorId] || [];
  res.json({
    sensor: sensor,
    readings: history,
    count: history.length,
  });
});

router.post("/readings", (req, res) => {
  const { sensor_id, type, readings: data } = req.body;
  
  if (!sensor_id) {
    return res.status(400).json({ error: "sensor_id required" });
  }
  
  const sensor = sensors.find(s => s.id === sensor_id);
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });
  
  let reading;
  if (type || sensor.type) {
    const readingType = type || sensor.type;
    switch (readingType) {
      case "gas":
        reading = generateGasReading(sensor_id);
        break;
      case "seismic":
        reading = generateSeismicReading(sensor_id);
        break;
      case "xrf":
        reading = generateXRFReading(sensor_id);
        break;
      default:
        return res.status(400).json({ error: "Invalid reading type" });
    }
  } else if (data) {
    reading = { id: Date.now().toString(), sensor_id, timestamp: new Date().toISOString(), readings: data };
  } else {
    return res.status(400).json({ error: "No reading data provided" });
  }
  
  if (!readings[sensor_id]) readings[sensor_id] = [];
  readings[sensor_id].unshift(reading);
  if (readings[sensor_id].length > 50) readings[sensor_id] = readings[sensor_id].slice(0, 50);
  
  res.status(201).json(reading);
});

router.post("/simulate", (req, res) => {
  const { sensor_id, mine_id } = req.body;
  
  let sensor;
  if (sensor_id) {
    sensor = sensors.find(s => s.id === sensor_id);
  } else if (mine_id) {
    sensor = sensors.find(s => s.mine_id === mine_id);
  }
  
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });
  
  let reading;
  switch (sensor.type) {
    case "gas":
      reading = generateGasReading(sensor.id);
      break;
    case "seismic":
      reading = generateSeismicReading(sensor.id);
      break;
    case "xrf":
      reading = generateXRFReading(sensor.id);
      break;
    default:
      return res.status(400).json({ error: "Cannot simulate unknown sensor type" });
  }
  
  if (!readings[sensor.id]) readings[sensor.id] = [];
  readings[sensor.id].unshift(reading);
  if (readings[sensor.id].length > 50) readings[sensor.id] = readings[sensor.id].slice(0, 50);
  
  res.status(201).json(reading);
});

module.exports = router;