const express = require("express");
const router = express.Router();
const { sensors, readings, incidents, generateGasReading, generateSeismicReading, generateXRFReading } = require("../store");

const GAS_THRESHOLDS = {
  co_ppm: 10,
  ch4_percent_lel: 5,
  co2_percent: 0.5,
  o2_percent: { min: 19.5, max: 23.5 },
  dust_mg_m3: 3.0,
  temperature_c: 35,
  humidity_percent: { min: 20, max: 90 },
};

const SEISMIC_THRESHOLDS = {
  peak_particle_velocity_mm_s: 12,
};

function checkGasAnomalies(reading) {
  const anomalies = [];
  const { co_ppm, ch4_percent_lel, o2_percent, dust_mg_m3, temperature_c, humidity_percent } = reading;
  
  if (co_ppm > GAS_THRESHOLDS.co_ppm) {
    anomalies.push({
      field: "co_ppm",
      value: co_ppm,
      threshold: GAS_THRESHOLDS.co_ppm,
      unit: "ppm",
      hazard_description: `CO levels exceed safe limit — risk of carbon monoxide poisoning. Evacuate and ventilate area immediately.`,
    });
  }
  
  if (ch4_percent_lel > GAS_THRESHOLDS.ch4_percent_lel) {
    anomalies.push({
      field: "ch4_percent_lel",
      value: ch4_percent_lel,
      threshold: GAS_THRESHOLDS.ch4_percent_lel,
      unit: "%LEL",
      hazard_description: `Methane concentration above safe limit — explosion risk. No open flame, activate ventilation.`,
    });
  }
  
  if (o2_percent < GAS_THRESHOLDS.o2_percent.min || o2_percent > GAS_THRESHOLDS.o2_percent.max) {
    anomalies.push({
      field: "o2_percent",
      value: o2_percent,
      threshold: `${GAS_THRESHOLDS.o2_percent.min}-${GAS_THRESHOLDS.o2_percent.max}`,
      unit: "%",
      hazard_description: o2_percent < 19.5 ? `Oxygen deficiency detected — risk of asphyxiation.` : `Oxygen enrichment — fire risk.`,
    });
  }
  
  if (dust_mg_m3 > GAS_THRESHOLDS.dust_mg_m3) {
    anomalies.push({
      field: "dust_mg_m3",
      value: dust_mg_m3,
      threshold: GAS_THRESHOLDS.dust_mg_m3,
      unit: "mg/m³",
      hazard_description: `Dust concentration exceeds limit — silicosis and respiratory hazard.`,
    });
  }
  
  if (temperature_c > GAS_THRESHOLDS.temperature_c) {
    anomalies.push({
      field: "temperature_c",
      value: temperature_c,
      threshold: GAS_THRESHOLDS.temperature_c,
      unit: "°C",
      hazard_description: `Temperature above safe limit — heat stress risk.`,
    });
  }
  
  return anomalies;
}

function checkSeismicAnomalies(reading) {
  const anomalies = [];
  const { peak_particle_velocity_mm_s } = reading;
  
  if (peak_particle_velocity_mm_s > SEISMIC_THRESHOLDS.peak_particle_velocity_mm_s) {
    anomalies.push({
      field: "peak_particle_velocity_mm_s",
      value: peak_particle_velocity_mm_s,
      threshold: SEISMIC_THRESHOLDS.peak_particle_velocity_mm_s,
      unit: "mm/s",
      hazard_description: `PPV exceeds safe blasting limit — structural damage risk. Evacuate exclusion zone.`,
    });
  }
  
  return anomalies;
}

router.get("/", (req, res) => {
  const mineId = req.query.mine_id;
  const result = mineId 
    ? sensors.filter(s => s.mine_id === mineId) 
    : sensors;
  res.json({ sensors: result, count: result.length });
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
  const { sensor_id, readings: data } = req.body;
  
  if (!sensor_id) {
    return res.status(400).json({ error: "sensor_id required" });
  }
  
  const sensor = sensors.find(s => s.id === sensor_id);
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });
  
  let anomalies = [];
  let status = "normal";
  let incident_id = null;
  
  if (sensor.type === "gas" && data) {
    anomalies = checkGasAnomalies(data);
    if (anomalies.length > 0) status = "alert";
  } else if (sensor.type === "seismic" && data) {
    anomalies = checkSeismicAnomalies(data);
    if (anomalies.length > 0) status = "alert";
  }
  
  const reading = {
    id: Date.now().toString(),
    sensor_id,
    timestamp: new Date().toISOString(),
    readings: data,
    status,
    anomalies_detected: anomalies.length,
  };
  
  if (!readings[sensor_id]) readings[sensor_id] = [];
  readings[sensor_id].unshift(reading);
  if (readings[sensor_id].length > 50) readings[sensor_id] = readings[sensor_id].slice(0, 50);
  
  if (status === "alert") {
    const incident = {
      id: `inc-${Date.now()}`,
      mine_id: sensor.mine_id,
      sensor_id,
      asset_id: null,
      type: anomalies[0].field + "_threshold_breach",
      category: "safety",
      severity: anomalies.some(a => a.value > a.threshold * 1.5) ? "critical" : "warning",
      description: `${sensor.type} sensor ${sensor_id} detected ${anomalies.length} anomaly(ies)`,
      reading_value: data,
      threshold: anomalies[0],
      resolved: false,
      created_at: new Date().toISOString(),
      hazards: anomalies,
    };
    incidents.push(incident);
    incident_id = incident.id;
  }
  
  const response = { ...reading };
  if (incident_id) response.incident_id = incident_id;
  if (anomalies.length > 0) response.anomalies = anomalies;
  
  res.status(201).json(response);
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