const { v4: uuidv4 } = require("uuid");

// ── Seed data ─────────────────────────────────────────────────────────────────

// ── ASSETS (equipment registry — the centralized data backbone) ───────────────
const assets = [
  {
    id: "asset-001",
    mine_id: "mine-001",
    asset_tag: "CAT-785C-KAK01",
    name: "Caterpillar 785C Haul Truck",
    category: "heavy_equipment",
    manufacturer: "Caterpillar",
    model: "785C",
    serial_number: "CAT785C-2018-04471",
    commissioned_at: "2018-06-01",
    location_zone: "Haul Road – North Circuit",
    status: "operational",
    operating_hours: 14820,
    maintenance_interval_hours: 500,
    last_service_at: "2025-04-10T08:00:00Z",
    next_service_due_hours: 15000,
    criticality: "high",
  },
  {
    id: "asset-002",
    mine_id: "mine-001",
    asset_tag: "SAND-DP1100-KAK02",
    name: "Sandvik DP1100i Drill Rig",
    category: "drilling",
    manufacturer: "Sandvik",
    model: "DP1100i",
    serial_number: "SDVK-DP-2020-00312",
    commissioned_at: "2020-03-15",
    location_zone: "Shaft B – Level 3",
    status: "operational",
    operating_hours: 8340,
    maintenance_interval_hours: 250,
    last_service_at: "2025-05-02T08:00:00Z",
    next_service_due_hours: 8500,
    criticality: "high",
  },
  {
    id: "asset-003",
    mine_id: "mine-001",
    asset_tag: "VENT-FAN-KAK03",
    name: "ABB Auxiliary Ventilation Fan",
    category: "ventilation",
    manufacturer: "ABB",
    model: "AXC-800",
    serial_number: "ABB-AXC-2019-00884",
    commissioned_at: "2019-09-01",
    location_zone: "Shaft B – Entry Portal",
    status: "operational",
    operating_hours: 42100,
    maintenance_interval_hours: 2000,
    last_service_at: "2025-01-15T06:00:00Z",
    next_service_due_hours: 43000,
    criticality: "critical",
  },
  {
    id: "asset-004",
    mine_id: "mine-002",
    asset_tag: "CAT-793F-KWL01",
    name: "Caterpillar 793F Haul Truck",
    category: "heavy_equipment",
    manufacturer: "Caterpillar",
    model: "793F",
    serial_number: "CAT793F-2021-08821",
    commissioned_at: "2021-01-10",
    location_zone: "Haul Road – Sector 2",
    status: "operational",
    operating_hours: 9650,
    maintenance_interval_hours: 500,
    last_service_at: "2025-04-28T07:00:00Z",
    next_service_due_hours: 10000,
    criticality: "high",
  },
  {
    id: "asset-005",
    mine_id: "mine-002",
    asset_tag: "CONV-B1-KWL02",
    name: "Joy Global Conveyor – Belt 1",
    category: "conveyor",
    manufacturer: "Joy Global",
    model: "14BU-30",
    serial_number: "JOY-14BU-2019-00117",
    commissioned_at: "2019-04-01",
    location_zone: "Processing Plant – Feed Belt",
    status: "under_maintenance",
    operating_hours: 38900,
    maintenance_interval_hours: 1000,
    last_service_at: "2025-05-14T06:00:00Z",
    next_service_due_hours: 39500,
    criticality: "critical",
  },
  {
    id: "asset-006",
    mine_id: "mine-003",
    asset_tag: "PUMP-D1-KER01",
    name: "Grundfos Dewatering Pump",
    category: "pumping",
    manufacturer: "Grundfos",
    model: "DP-65-400",
    serial_number: "GF-DP65-2020-00293",
    commissioned_at: "2020-07-01",
    location_zone: "Shaft C – Sump Level 4",
    status: "operational",
    operating_hours: 19400,
    maintenance_interval_hours: 1000,
    last_service_at: "2025-03-01T06:00:00Z",
    next_service_due_hours: 20000,
    criticality: "critical",
  },
];

// ── MAINTENANCE RECORDS ───────────────────────────────────────────────────────
const maintenanceRecords = [
  {
    id: "maint-001",
    asset_id: "asset-001",
    mine_id: "mine-001",
    type: "scheduled",
    work_order: "WO-2025-0441",
    description: "500-hour service: oil change, filter replacement, brake inspection, tyre rotation",
    status: "completed",
    priority: "medium",
    triggered_by: "schedule",
    assigned_to: "John Ochieng – Maintenance Tech",
    scheduled_at: "2025-04-10T06:00:00Z",
    completed_at: "2025-04-10T14:30:00Z",
    downtime_hours: 8.5,
    parts_used: ["Engine oil 15W-40 x40L", "Air filter x2", "Hydraulic filter x3"],
    cost_ksh: 48000,
  },
  {
    id: "maint-002",
    asset_id: "asset-003",
    mine_id: "mine-001",
    type: "corrective",
    work_order: "WO-2025-0389",
    description: "Bearing replacement on fan impeller — vibration anomaly detected by IoT sensor",
    status: "completed",
    priority: "critical",
    triggered_by: "predictive_alert",
    assigned_to: "Faith Wanjiku – Senior Technician",
    scheduled_at: "2025-03-22T08:00:00Z",
    completed_at: "2025-03-22T17:00:00Z",
    downtime_hours: 9,
    parts_used: ["SKF 6312 bearing x2", "Shaft seal x1"],
    cost_ksh: 32000,
    sensor_alert_id: "sns-001",
  },
  {
    id: "maint-003",
    asset_id: "asset-005",
    mine_id: "mine-002",
    type: "scheduled",
    work_order: "WO-2025-0512",
    description: "1000-hour service: belt tension check, pulley alignment, motor inspection",
    status: "in_progress",
    priority: "high",
    triggered_by: "schedule",
    assigned_to: "Peter Mutua – Belt Technician",
    scheduled_at: "2025-05-14T06:00:00Z",
    completed_at: null,
    downtime_hours: null,
    parts_used: [],
    cost_ksh: null,
  },
];

// ── MAINTENANCE RECOMMENDATIONS (predictive / proactive) ─────────────────────
const maintenanceRecommendations = [
  {
    id: "rec-001",
    asset_id: "asset-002",
    mine_id: "mine-001",
    generated_at: "2025-05-15T06:00:00Z",
    model: "PredictiveMaint-KE-v2.1",
    trigger: "operating_hours_threshold",
    finding: "Drill rig approaching 8,500-hour service interval. Current: 8,340 hours. Estimated to reach threshold in ~32 operating hours.",
    recommended_action: "Schedule 250-hour service within next 3 operating days",
    priority: "high",
    estimated_failure_risk_percent: 12,
    estimated_downtime_if_unaddressed_hours: 72,
    estimated_repair_cost_if_unaddressed_ksh: 280000,
    preventive_cost_ksh: 45000,
    status: "open",
  },
  {
    id: "rec-002",
    asset_id: "asset-006",
    mine_id: "mine-003",
    generated_at: "2025-05-16T06:00:00Z",
    model: "PredictiveMaint-KE-v2.1",
    trigger: "sensor_anomaly",
    finding: "Dewatering pump motor current draw increasing 8% above baseline over past 72 hours. Pattern consistent with impeller wear or partial blockage.",
    recommended_action: "Inspect impeller and suction inlet. Check for debris blockage. Run motor current trend report before next shift.",
    priority: "critical",
    estimated_failure_risk_percent: 34,
    estimated_downtime_if_unaddressed_hours: 48,
    estimated_repair_cost_if_unaddressed_ksh: 190000,
    preventive_cost_ksh: 28000,
    status: "open",
  },
  {
    id: "rec-003",
    asset_id: "asset-001",
    mine_id: "mine-001",
    generated_at: "2025-05-14T06:00:00Z",
    model: "PredictiveMaint-KE-v2.1",
    trigger: "telemetry_pattern",
    finding: "Haul truck tyre pressure on rear-left axle averaging 8% below spec over last 5 shifts. Fuel consumption 4% above baseline — consistent with under-inflation.",
    recommended_action: "Inspect and re-inflate rear-left tyres. Check for slow puncture. Review haul road surface at Sector 3N.",
    priority: "medium",
    estimated_failure_risk_percent: 8,
    estimated_downtime_if_unaddressed_hours: 6,
    estimated_repair_cost_if_unaddressed_ksh: 85000,
    preventive_cost_ksh: 2000,
    status: "acknowledged",
  },
];

const mines = [
  {
    id: "mine-001",
    name: "Kakamega Gold Belt – Site A",
    county: "Kakamega",
    mineral_type: "Gold",
    coordinates: { lat: 0.2827, lng: 34.7519 },
    license_number: "KE-MIN-2021-0042",
    operator: "Acacia Minerals Kenya Ltd",
    status: "active",
    created_at: "2021-03-15T08:00:00Z",
  },
  {
    id: "mine-002",
    name: "Kwale Titanium Mine",
    county: "Kwale",
    mineral_type: "Titanium / Niobium",
    coordinates: { lat: -4.1745, lng: 39.4527 },
    license_number: "KE-MIN-2019-0011",
    operator: "Base Titanium Limited",
    status: "active",
    created_at: "2019-06-01T08:00:00Z",
  },
  {
    id: "mine-003",
    name: "Kerio Valley Fluorspar",
    county: "Elgeyo-Marakwet",
    mineral_type: "Fluorspar",
    coordinates: { lat: 0.7821, lng: 35.5438 },
    license_number: "KE-MIN-2020-0078",
    operator: "Kenya Fluorspar Company",
    status: "maintenance",
    created_at: "2020-01-20T08:00:00Z",
  },
];

const sensors = [
  {
    id: "sns-001",
    mine_id: "mine-001",
    type: "gas",
    model: "RKI GX-3R",
    location_zone: "Shaft B – Level 3",
    status: "online",
    calibrated_at: "2025-04-01T06:00:00Z",
  },
  {
    id: "sns-002",
    mine_id: "mine-001",
    type: "seismic",
    model: "Instantel Minimate Pro",
    location_zone: "Shaft A – Surface",
    status: "online",
    calibrated_at: "2025-04-01T06:00:00Z",
  },
  {
    id: "sns-003",
    mine_id: "mine-001",
    type: "xrf",
    model: "Olympus Vanta XRF",
    location_zone: "Processing Bay",
    status: "online",
    calibrated_at: "2025-05-01T06:00:00Z",
  },
  {
    id: "sns-004",
    mine_id: "mine-002",
    type: "gas",
    model: "Dräger X-am 5600",
    location_zone: "Open Pit – North Face",
    status: "online",
    calibrated_at: "2025-03-15T06:00:00Z",
  },
  {
    id: "sns-005",
    mine_id: "mine-002",
    type: "equipment",
    model: "Caterpillar 793F Telematics",
    location_zone: "Haul Road – Sector 2",
    status: "online",
    calibrated_at: "2025-05-10T06:00:00Z",
  },
];

// Rolling sensor readings buffer (last 50 per sensor)
const readings = {};
const incidents = [];
const alerts = [];
const oreGradeSamples = [];
const complianceReports = [];
const riskAssessments = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString();
}

function randomBetween(min, max, dp = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}

function generateGasReading(sensorId) {
  return {
    id: uuidv4(),
    sensor_id: sensorId,
    timestamp: ts(),
    readings: {
      co_ppm: randomBetween(0.5, 12),
      ch4_percent_lel: randomBetween(0, 5),
      co2_percent: randomBetween(0.03, 0.5),
      o2_percent: randomBetween(19.8, 21),
      dust_mg_m3: randomBetween(0.1, 2.5),
    },
    status: "normal",
  };
}

function generateSeismicReading(sensorId) {
  return {
    id: uuidv4(),
    sensor_id: sensorId,
    timestamp: ts(),
    readings: {
      peak_particle_velocity_mm_s: randomBetween(0.1, 8),
      frequency_hz: randomBetween(8, 60),
      peak_vector_sum_mm_s: randomBetween(0.1, 10),
    },
    status: "normal",
  };
}

function generateXRFReading(sensorId) {
  return {
    id: uuidv4(),
    sensor_id: sensorId,
    timestamp: ts(),
    sample_id: `SAMP-${Date.now()}`,
    readings: {
      au_ppb: randomBetween(500, 12000),
      fe_percent: randomBetween(8, 42),
      si_percent: randomBetween(14, 55),
      al_percent: randomBetween(1.2, 10),
      cu_ppm: randomBetween(10, 300),
      as_ppm: randomBetween(1, 50),
    },
    predicted_ore_grade: randomBetween(0.8, 12),
    grade_unit: "g/t Au",
    status: "normal",
  };
}

// Asset-aware equipment reading — links to actual asset registry
const assetTelemetryProfiles = {
  "asset-001": { asset_tag: "CAT-785C-KAK01", lat_range: [0.278, 0.287], lng_range: [34.748, 34.756], base_hours: 14820 },
  "asset-004": { asset_tag: "CAT-793F-KWL01", lat_range: [-4.177, -4.171], lng_range: [39.451, 39.456], base_hours: 9650 },
};

function generateEquipmentReading(sensorId, assetId) {
  const profile = assetTelemetryProfiles[assetId] || assetTelemetryProfiles["asset-004"];
  const hoursAccrued = profile.base_hours + randomBetween(0, 5, 1);
  const maintenanceScore = randomBetween(62, 97);
  const hoursToService = Math.max(0, Math.floor(randomBetween(20, 480)));
  return {
    id: uuidv4(),
    sensor_id: sensorId,
    asset_id: assetId || "asset-004",
    asset_tag: profile.asset_tag,
    timestamp: ts(),
    telemetry: {
      engine_temp_c: randomBetween(78, 108),
      engine_oil_pressure_kpa: randomBetween(280, 420),
      coolant_temp_c: randomBetween(75, 100),
      rpm: randomBetween(1200, 1900),
      load_percent: randomBetween(22, 95),
      fuel_level_percent: randomBetween(18, 100),
      fuel_consumption_l_hr: randomBetween(42, 88),
      hydraulic_pressure_bar: randomBetween(180, 340),
      gps: {
        lat: randomBetween(profile.lat_range[0], profile.lat_range[1], 6),
        lng: randomBetween(profile.lng_range[0], profile.lng_range[1], 6),
      },
      operating_hours: hoursAccrued,
      speed_kmh: randomBetween(0, 45),
    },
    health: {
      maintenance_health_score: maintenanceScore,
      hours_to_next_service: hoursToService,
      predicted_failure_risk_percent: parseFloat((Math.max(0, (100 - maintenanceScore) * 0.5)).toFixed(1)),
      component_alerts: maintenanceScore < 70
        ? [{ component: "Engine oil", status: "degraded", action: "Schedule service" }]
        : [],
    },
    status: maintenanceScore < 65 ? "maintenance_required" : "normal",
  };
}

// ── Pre-seed readings ─────────────────────────────────────────────────────────
sensors.forEach((s) => {
  readings[s.id] = [];
  const gen =
    s.type === "gas"      ? () => generateGasReading(s.id)
    : s.type === "seismic" ? () => generateSeismicReading(s.id)
    : s.type === "xrf"     ? () => generateXRFReading(s.id)
    : () => generateEquipmentReading(s.id, s.mine_id === "mine-001" ? "asset-001" : "asset-004");

  for (let i = 0; i < 10; i++) readings[s.id].push(gen());
});

// ── Pre-seed incidents (stable IDs for Postman demo) ─────────────────────────
incidents.push(
  {
    id: "inc-seed-001",
    mine_id: "mine-001",
    sensor_id: "sns-001",
    asset_id: null,
    type: "gas_threshold_breach",
    category: "safety",
    severity: "warning",
    description: "CO levels exceeded 10 ppm threshold in Shaft B Level 3. Ventilation fan response triggered.",
    reading_value: { co_ppm: 13.7 },
    threshold: { co_ppm: 10 },
    resolved: true,
    resolved_at: "2025-05-10T14:32:00Z",
    resolution_note: "Ventilation fan speed increased. CO returned to 3.2 ppm within 12 minutes.",
    created_at: "2025-05-10T14:15:00Z",
  },
  {
    id: "inc-seed-002",
    mine_id: "mine-001",
    sensor_id: "sns-002",
    asset_id: null,
    type: "seismic_event",
    category: "safety",
    severity: "critical",
    description: "Peak particle velocity 14.8 mm/s exceeded safe blasting limit of 12 mm/s. Zone evacuation protocol activated.",
    reading_value: { peak_particle_velocity_mm_s: 14.8 },
    threshold: { peak_particle_velocity_mm_s: 12 },
    resolved: false,
    resolved_at: null,
    resolution_note: null,
    created_at: "2025-05-16T09:04:00Z",
  },
  {
    id: "inc-seed-003",
    mine_id: "mine-002",
    sensor_id: "sns-005",
    asset_id: "asset-004",
    type: "equipment_health_degradation",
    category: "maintenance",
    severity: "warning",
    description: "CAT 793F haul truck maintenance health score dropped to 64/100. Engine oil pressure trending below spec.",
    reading_value: { maintenance_health_score: 64, engine_oil_pressure_kpa: 271 },
    threshold: { maintenance_health_score: 70, engine_oil_pressure_kpa: 280 },
    resolved: false,
    resolved_at: null,
    resolution_note: null,
    created_at: "2025-05-15T11:30:00Z",
  }
);

// ── FLEET SESSIONS (shift-level utilization per asset) ───────────────────────
const fleetSessions = [
  {
    id: "fs-001", asset_id: "asset-001", mine_id: "mine-001",
    asset_tag: "CAT-785C-KAK01", shift: "Day", date: "2025-05-16",
    operating_hours: 9.4, idle_hours: 2.1, downtime_hours: 0.5,
    utilization_percent: 78.3,
    fuel_consumed_litres: 892, fuel_cost_ksh: 116960,
    loads_completed: 34, tonnes_moved: 2890,
    avg_cycle_time_min: 16.6, avg_speed_kmh: 28.4,
    gps_distance_km: 267,
    operator: "Moses Otieno",
  },
  {
    id: "fs-002", asset_id: "asset-001", mine_id: "mine-001",
    asset_tag: "CAT-785C-KAK01", shift: "Night", date: "2025-05-16",
    operating_hours: 7.8, idle_hours: 3.7, downtime_hours: 0.5,
    utilization_percent: 65.0,
    fuel_consumed_litres: 760, fuel_cost_ksh: 99560,
    loads_completed: 26, tonnes_moved: 2210,
    avg_cycle_time_min: 18.0, avg_speed_kmh: 24.1,
    gps_distance_km: 188,
    operator: "Esther Achieng",
  },
  {
    id: "fs-003", asset_id: "asset-004", mine_id: "mine-002",
    asset_tag: "CAT-793F-KWL01", shift: "Day", date: "2025-05-16",
    operating_hours: 10.2, idle_hours: 1.3, downtime_hours: 0.5,
    utilization_percent: 85.0,
    fuel_consumed_litres: 1120, fuel_cost_ksh: 146720,
    loads_completed: 41, tonnes_moved: 4920,
    avg_cycle_time_min: 14.9, avg_speed_kmh: 33.2,
    gps_distance_km: 339,
    operator: "David Mwangi",
  },
  {
    id: "fs-004", asset_id: "asset-004", mine_id: "mine-002",
    asset_tag: "CAT-793F-KWL01", shift: "Night", date: "2025-05-16",
    operating_hours: 8.1, idle_hours: 3.4, downtime_hours: 0.5,
    utilization_percent: 67.5,
    fuel_consumed_litres: 830, fuel_cost_ksh: 108730,
    loads_completed: 28, tonnes_moved: 3360,
    avg_cycle_time_min: 17.4, avg_speed_kmh: 26.8,
    gps_distance_km: 217,
    operator: "Grace Njoroge",
  },
  {
    id: "fs-005", asset_id: "asset-002", mine_id: "mine-001",
    asset_tag: "SAND-DP1100-KAK02", shift: "Day", date: "2025-05-16",
    operating_hours: 8.5, idle_hours: 1.5, downtime_hours: 2.0,
    utilization_percent: 70.8,
    fuel_consumed_litres: 210, fuel_cost_ksh: 27510,
    loads_completed: null, tonnes_moved: null,
    avg_cycle_time_min: null, avg_speed_kmh: null,
    gps_distance_km: null,
    metres_drilled: 148,
    operator: "Samuel Kiptoo",
  },
];

// ── HAZARD ZONES (geo-fenced unsafe areas) ────────────────────────────────────
const hazardZones = [
  {
    id: "hz-001", mine_id: "mine-001",
    name: "Shaft B Level 3 – Restricted Blast Zone",
    type: "blast_exclusion",
    status: "active",
    coordinates: { lat: 0.2819, lng: 34.7511 },
    radius_m: 200,
    active_from: "2025-05-16T06:00:00Z",
    active_until: "2025-05-16T14:00:00Z",
    reason: "Scheduled blast 09:00 EAT — no personnel within 200m",
    created_by: "Safety Officer – Jane Muthoni",
  },
  {
    id: "hz-002", mine_id: "mine-001",
    name: "Shaft A – Unstable Hanging Wall",
    type: "geotechnical_hazard",
    status: "active",
    coordinates: { lat: 0.2821, lng: 34.7508 },
    radius_m: 50,
    active_from: "2025-05-14T10:00:00Z",
    active_until: null,
    reason: "Ground movement detected by seismic sensor sns-002. Engineering inspection pending.",
    created_by: "Geotech Engineer – Patrick Kamau",
  },
  {
    id: "hz-003", mine_id: "mine-002",
    name: "Processing Plant – High Dust Zone",
    type: "environmental_hazard",
    status: "active",
    coordinates: { lat: -4.1749, lng: 39.4522 },
    radius_m: 80,
    active_from: "2025-05-15T00:00:00Z",
    active_until: null,
    reason: "Dust suppression system offline. PM10 readings averaging 4.8 mg/m³ (limit: 3.0).",
    created_by: "Environmental Officer – Lucy Waweru",
  },
];

module.exports = {
  mines,
  sensors,
  assets,
  maintenanceRecords,
  maintenanceRecommendations,
  fleetSessions,
  hazardZones,
  readings,
  incidents,
  alerts,
  oreGradeSamples,
  complianceReports,
  riskAssessments,
  generateGasReading,
  generateSeismicReading,
  generateXRFReading,
  generateEquipmentReading,
  ts,
  randomBetween,
};
