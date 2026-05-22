const express = require("express");
const router = express.Router();
const { incidents, hazardZones, sensors, readings, mines } = require("../store");

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
  
  res.json(result);
});

router.post("/incidents", (req, res) => {
  const { mine_id, sensor_id, type, severity, description } = req.body;
  
  if (!mine_id || !type || !description) {
    return res.status(400).json({ error: "mine_id, type, and description required" });
  }
  
  const incident = {
    id: `inc-${Date.now()}`,
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
  incident.resolution_note = req.body.notes || "Resolved";
  
  res.json(incident);
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
    id: `hz-${Date.now()}`,
    mine_id,
    name,
    type,
    status: "active",
    coordinates,
    radius_m: radius_m || 100,
    active_from: new Date().toISOString(),
    active_until: null,
    reason: reason || "Safety hazard declared",
    created_by: "API User",
  };
  
  hazardZones.push(zone);
  res.status(201).json(zone);
});

router.patch("/hazard-zones/:id/clear", (req, res) => {
  const zone = hazardZones.find(h => h.id === req.params.id);
  
  if (!zone) return res.status(404).json({ error: "Hazard zone not found" });
  
  zone.status = "cleared";
  zone.active_until = new Date().toISOString();
  zone.cleared_by = req.body.cleared_by || "API User";
  zone.clear_reason = req.body.reason || "Zone cleared";
  
  res.json(zone);
});

module.exports = router;