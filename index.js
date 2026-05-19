const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");

const { auth }          = require("./middleware/auth");
const dashboardRouter   = require("./routes/dashboard");
const minesRouter       = require("./routes/mines");
const sensorsRouter     = require("./routes/sensors");
const safetyRouter      = require("./routes/safety");
const assetsRouter      = require("./routes/assets");
const maintenanceRouter = require("./routes/maintenance");
const fleetRouter       = require("./routes/fleet");
const analyticsRouter   = require("./routes/analytics");

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "GroundPulse – Integrated Mine Health Dashboard API",
    description: "AI-driven platform combining predictive equipment maintenance, smart mine safety & hazard alerts, and fleet operational efficiency monitoring.",
    version: "2.0.0",
    pillars: {
      "1": "Predictive Equipment Maintenance",
      "2": "Smart Mine Safety & Hazard Alerts",
      "3": "Fleet & Operational Efficiency Monitoring",
    },
    environment: "demo",
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.json({
    name: "GroundPulse – Integrated Mine Health Dashboard",
    tagline: "Predictive maintenance + Safety & hazard alerts + Fleet efficiency — the balance every mine manager or artisanal miner wants to achieve.",
    version: "2.0.0",
    auth: { header: "X-API-Key", demo_keys: {
      operator: "demo-operator-key-001", admin: "demo-admin-key-999", viewer: "demo-readonly-key-002"
    }},
    endpoints: {
      "━━ INTEGRATED DASHBOARD ━━": "",
      "GET  /dashboard":                                "Integrated Mine Health Dashboard — all 3 pillars in one call",
      "GET  /dashboard?mine_id=mine-001":               "Single-mine dashboard view",
      "━━ PILLAR 1 — PREDICTIVE MAINTENANCE ━━": "",
      "GET  /assets":                                   "Equipment registry — centralized asset data backbone",
      "GET  /assets/:id":                               "Asset detail + maintenance summary + AI recommendations",
      "GET  /assets/:id/telemetry":                     "Live IoT telemetry for an asset",
      "POST /assets":                                   "Register new asset",
      "GET  /maintenance/schedule":                     "Upcoming maintenance across all assets (urgency-ranked)",
      "GET  /maintenance/recommendations":              "AI proactive alerts with failure risk % and ROI analysis",
      "POST /maintenance/recommendations/generate":     "Run predictive model for a specific asset",
      "PATCH /maintenance/recommendations/:id/acknowledge": "Acknowledge a recommendation",
      "GET  /maintenance":                              "List work orders",
      "POST /maintenance":                              "Create work order",
      "PATCH /maintenance/:id/complete":                "Complete work order (logs parts, cost, downtime)",
      "━━ PILLAR 2 — SAFETY & HAZARD ALERTS ━━": "",
      "GET  /safety/dashboard":                         "Safety-only overview (subset of integrated dashboard)",
      "GET  /safety/incidents":                         "All incidents (gas, seismic, dust, temperature, equipment)",
      "POST /safety/incidents":                         "Log manual incident",
      "PATCH /safety/incidents/:id/resolve":            "Resolve incident with notes",
      "POST /sensors/readings":                         "Ingest sensor reading — triggers full hazard detection suite",
      "GET  /sensors/:id/history":                      "Time-series reading history",
      "POST /sensors/simulate":                         "Generate realistic sensor reading (demo helper)",
      "GET  /fleet/hazard-zones":                       "Active geo-fenced unsafe zones (blast, geotechnical, dust)",
      "POST /fleet/hazard-zones":                       "Declare a new hazard zone — auto-logs safety incident",
      "PATCH /fleet/hazard-zones/:id/clear":            "Clear a hazard zone",
      "POST /safety/ore-grade/predict":                 "XRF → AI ore grade classification",
      "POST /safety/compliance/generate":               "Kenya Mining Act 2016 / DOSHI compliance report",
      "━━ PILLAR 3 — FLEET & OPERATIONAL EFFICIENCY ━━": "",
      "GET  /fleet/utilization":                        "Shift-level utilization: operating hours, idle time, loads, tonnes",
      "POST /fleet/utilization":                        "Log a shift session",
      "GET  /fleet/productivity":                       "Per-asset productivity with efficiency flags",
      "GET  /fleet/fuel-analysis":                      "Fuel consumption, cost breakdown, litres-per-tonne",
      "GET  /fleet/idle-alerts":                        "Assets with excessive idle time — improvement opportunities",
      "━━ ANALYTICS ━━": "",
      "GET  /analytics/operational":                    "Per-mine KPIs: uptime, MTBF, costs, risk score",
      "GET  /analytics/risk":                           "Risk matrix: likelihood × consequence for all assets",
      "GET  /analytics/maintenance-performance":        "Predictive AI share %, cost savings, ROI",
      "GET  /analytics/sensor-health":                  "Sensor coverage, calibration status, alert rates",
    },
  });
});

app.use("/dashboard",   auth, dashboardRouter);
app.use("/mines",       auth, minesRouter);
app.use("/sensors",     auth, sensorsRouter);
app.use("/safety",      auth, safetyRouter);
app.use("/assets",      auth, assetsRouter);
app.use("/maintenance", auth, maintenanceRouter);
app.use("/fleet",       auth, fleetRouter);
app.use("/analytics",   auth, analyticsRouter);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found. GET / for the full endpoint map.` });
});
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🟢 GroundPulse Integrated Mine Health Dashboard API v2.0.0`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n   Pillar 1 — Predictive Equipment Maintenance`);
  console.log(`   Pillar 2 — Smart Mine Safety & Hazard Alerts`);
  console.log(`   Pillar 3 — Fleet & Operational Efficiency Monitoring`);
  console.log(`\n   Keys: demo-operator-key-001 | demo-admin-key-999 | demo-readonly-key-002\n`);
});

module.exports = app;
