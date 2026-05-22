const express = require("express");
const router = express.Router();
const { incidents, hazardZones, sensors } = require("../store");

router.get("/dashboard", (req, res) => {
  const mineId = req.query.mine_id;
  
  const filteredIncidents = mineId 
    ? incidents.filter(i => i.mine_id === mineId) 
    : incidents;
  
  const filteredHazards = mineId 
    ? hazardZones.filter(h => h.mine_id === mineId) 
    : hazardZones;
  
  const openIncidents = filteredIncidents.filter(i => !i.resolved);
  const criticalIncidents = openIncidents.filter(i => i.severity === "critical");
  const activeHazards = filteredHazards.filter(h => h.status === "active");
  
  res.json({
    timestamp: new Date().toISOString(),
    open_incidents: openIncidents.length,
    critical_incidents: criticalIncidents.length,
    active_hazard_zones: activeHazards.length,
    incidents: openIncidents,
    hazard_zones: activeHazards,
  });
});

router.get("/incidents", (req, res) => {
  const mineId = req.query.mine_id;
  const resolved = req.query.resolved;
  
  let result = mineId ? incidents.filter(i => i.mine_id === mineId) : [...incidents];
  
  if (resolved !== undefined) {
    const isResolved = resolved === "true";
    result = result.filter(i => i.resolved === isResolved);
  }
  
  res.json({
    count: result.length,
    incidents: result,
  });
});

router.post("/incidents", (req, res) => {
  const { mine_id, sensor_id, type, severity, description } = req.body;
  
  if (!mine_id || !type || !description) {
    return res.status(400).json({ error: "mine_id, type, and description required" });
  }
  
  const incident = {
    id: `inc-${Date.now()}`.slice(-8),
    mine_id,
    sensor_id: sensor_id || null,
    asset_id: null,
    type,
    category: "safety",
    severity: severity || "warning",
    description,
    resolved: false,
    resolved_at: null,
    resolution_note: null,
    created_at: new Date().toISOString(),
  };
  
  incidents.push(incident);
  res.status(201).json(incident);
});

router.patch("/incidents/:id/resolve", (req, res) => {
  const incident = incidents.find(i => i.id === req.params.id);
  
  if (!incident) return res.status(404).json({ error: "Incident not found" });
  
  incident.resolved = true;
  incident.resolved_at = new Date().toISOString();
  incident.resolution_note = req.body.resolution_note || req.body.notes || "Resolved";
  
  res.json({ incident });
});

router.get("/hazard-zones", (req, res) => {
  const mineId = req.query.mine_id;
  const result = mineId 
    ? hazardZones.filter(h => h.mine_id === mineId) 
    : hazardZones;
  res.json(result);
});

router.post("/hazard-zones", (req, res) => {
  const { mine_id, name, type, coordinates, radius_m, reason } = req.body;
  
  if (!mine_id || !name || !type || !coordinates) {
    return res.status(400).json({ error: "mine_id, name, type, and coordinates required" });
  }
  
  const zone = {
    id: `hz-${Date.now()}`.slice(-8),
    mine_id,
    name,
    type,
    status: "active",
    coordinates,
    radius_m: radius_m || 100,
    active_from: new Date().toISOString(),
    active_until: null,
    reason: reason || "Safety hazard declared",
    created_by: "Safety API",
  };
  
  hazardZones.push(zone);
  res.status(201).json(zone);
});

router.patch("/hazard-zones/:id/clear", (req, res) => {
  const zone = hazardZones.find(h => h.id === req.params.id);
  
  if (!zone) return res.status(404).json({ error: "Hazard zone not found" });
  
  zone.status = "cleared";
  zone.active_until = new Date().toISOString();
  
  res.json(zone);
});

router.post("/compliance/generate", (req, res) => {
  const { mine_id, period_start, period_end, report_type } = req.body;
  
  if (!mine_id) {
    return res.status(400).json({ error: "mine_id required" });
  }
  
  const mineIncidents = incidents.filter(i => i.mine_id === mine_id);
  const openIncidents = mineIncidents.filter(i => !i.resolved);
  const criticalIncidents = openIncidents.filter(i => i.severity === "critical");
  const mineSensors = sensors.filter(s => s.mine_id === mine_id);
  
  const status = criticalIncidents.length > 0 ? "NON-COMPLIANT" : openIncidents.length > 0 ? "CONDITIONALLY_COMPLIANT" : "COMPLIANT";
  
  res.json({
    mine_id,
    mine_name: "Kakamega Gold Belt – Site A",
    license_number: "KE-MIN-2021-0042",
    period: { start: period_start, end: period_end },
    report_type: report_type || "safety_and_environmental",
    generated_at: new Date().toISOString(),
    summary: {
      total_incidents: mineIncidents.length,
      unresolved_incidents: openIncidents.length,
      critical_incidents: criticalIncidents.length,
      sensors_deployed: mineSensors.length,
      sensors_online: mineSensors.filter(s => s.status === "online").length,
      compliance_status: status,
    },
    submitted_to: "DOSHI",
  });
});

module.exports = router;