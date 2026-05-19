const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../data/store");

// GET /sensors — list sensors, filter by mine or type
router.get("/", (req, res) => {
  const { mine_id, type, status } = req.query;
  let result = db.sensors.filter(s =>
    req.user.mine_ids.includes(s.mine_id)
  );
  if (mine_id) result = result.filter(s => s.mine_id === mine_id);
  if (type)    result = result.filter(s => s.type === type);
  if (status)  result = result.filter(s => s.status === status);
  res.json({ count: result.length, sensors: result });
});

// GET /sensors/:id — sensor detail + last reading
router.get("/:id", (req, res) => {
  const sensor = db.sensors.find(s => s.id === req.params.id);
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });

  const history = db.readings[sensor.id] || [];
  const latest = history[history.length - 1] || null;

  res.json({ ...sensor, latest_reading: latest, reading_count: history.length });
});

// POST /sensors/readings — ingest a new reading (called by edge device)
router.post("/readings", (req, res) => {
  const { sensor_id, readings: vals } = req.body;
  if (!sensor_id || !vals) {
    return res.status(400).json({ error: "sensor_id and readings are required" });
  }

  const sensor = db.sensors.find(s => s.id === sensor_id);
  if (!sensor) return res.status(404).json({ error: "Unknown sensor_id" });

  // Full hazard threshold set — Pillar 2: Smart Mine Safety & Hazard Alerts
  const thresholds = {
    // Gas hazards
    co_ppm:              { limit: 15,   unit: "ppm",      hazard: "Carbon monoxide — risk of poisoning" },
    ch4_percent_lel:     { limit: 10,   unit: "% LEL",    hazard: "Methane — explosion risk" },
    h2s_ppm:             { limit: 10,   unit: "ppm",      hazard: "Hydrogen sulphide — toxic gas" },
    so2_ppm:             { limit: 2,    unit: "ppm",      hazard: "Sulphur dioxide — respiratory hazard" },
    // Atmospheric
    o2_percent_low:      { limit: 19.5, unit: "%",        hazard: "Oxygen deficiency — asphyxiation risk", mode: "below" },
    temperature_c:       { limit: 35,   unit: "°C",       hazard: "High ambient temperature — heat stress" },
    humidity_percent:    { limit: 90,   unit: "%",        hazard: "High humidity — heat stress amplifier" },
    // Dust
    dust_mg_m3:          { limit: 3.0,  unit: "mg/m³",   hazard: "Respirable dust — silicosis risk (Kenya OEL)" },
    pm10_mg_m3:          { limit: 5.0,  unit: "mg/m³",   hazard: "PM10 dust — respiratory disease" },
    // Seismic / structural
    peak_particle_velocity_mm_s: { limit: 12, unit: "mm/s", hazard: "Ground vibration — structural damage risk" },
    sound_db:            { limit: 85,   unit: "dB",       hazard: "Noise — hearing damage (8hr TWA)" },
  };

  const anomalies = [];
  Object.entries(thresholds).forEach(([key, cfg]) => {
    if (vals[key] === undefined) return;
    const breach = cfg.mode === "below"
      ? vals[key] < cfg.limit
      : vals[key] > cfg.limit;
    if (breach) {
      anomalies.push({
        field: key,
        value: vals[key],
        threshold: cfg.limit,
        unit: cfg.unit,
        hazard_description: cfg.hazard,
        breach_type: cfg.mode === "below" ? "below_minimum" : "above_maximum",
      });
    }
  });

  const reading = {
    id: uuidv4(),
    sensor_id,
    timestamp: new Date().toISOString(),
    readings: vals,
    anomalies_detected: anomalies.length > 0,
    anomalies,
    status: anomalies.length > 0 ? "alert" : "normal",
  };

  if (!db.readings[sensor_id]) db.readings[sensor_id] = [];
  db.readings[sensor_id].push(reading);
  // Keep last 50 readings per sensor
  if (db.readings[sensor_id].length > 50) db.readings[sensor_id].shift();

  // Auto-create incident if anomaly detected
  if (anomalies.length > 0) {
    const isCritical = anomalies.some(a => {
      const val = a.value, lim = a.threshold;
      return a.breach_type === "below_minimum" ? val < lim * 0.95 : val > lim * 1.5;
    });
    const incident = {
      id: uuidv4(),
      mine_id: sensor.mine_id,
      sensor_id,
      asset_id: null,
      type: "sensor_threshold_breach",
      category: "safety",
      severity: isCritical ? "critical" : "warning",
      description: `Hazard detected: ${anomalies.map(a => `${a.field} ${a.value}${a.unit} (limit ${a.threshold}${a.unit})`).join("; ")}`,
      hazards: anomalies.map(a => ({ field: a.field, hazard: a.hazard_description })),
      reading_value: vals,
      resolved: false,
      resolved_at: null,
      created_at: new Date().toISOString(),
    };
    db.incidents.push(incident);
    reading.incident_id = incident.id;
  }

  res.status(201).json(reading);
});

// GET /sensors/:id/history — paginated reading history
router.get("/:id/history", (req, res) => {
  const sensor = db.sensors.find(s => s.id === req.params.id);
  if (!sensor) return res.status(404).json({ error: "Sensor not found" });

  const limit  = Math.min(parseInt(req.query.limit)  || 20, 50);
  const offset = parseInt(req.query.offset) || 0;
  const history = (db.readings[sensor.id] || []).slice().reverse();

  res.json({
    sensor_id: req.params.id,
    total: history.length,
    limit, offset,
    readings: history.slice(offset, offset + limit),
  });
});

// POST /sensors/simulate — generate a simulated reading (demo helper)
router.post("/simulate", (req, res) => {
  const { sensor_id } = req.body;
  const sensor = db.sensors.find(s => s.id === sensor_id);
  if (!sensor) return res.status(404).json({ error: "Unknown sensor_id" });

  const generators = {
    gas:       db.generateGasReading,
    seismic:   db.generateSeismicReading,
    xrf:       db.generateXRFReading,
    equipment: db.generateEquipmentReading,
  };

  const reading = generators[sensor.type](sensor_id);
  if (!db.readings[sensor_id]) db.readings[sensor_id] = [];
  db.readings[sensor_id].push(reading);

  res.status(201).json({ message: "Simulated reading created", reading });
});

module.exports = router;
