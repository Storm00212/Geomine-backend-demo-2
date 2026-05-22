const express = require("express");
const router = express.Router();
const { fleetSessions, hazardZones, assets, sensors } = require("../store");

router.get("/utilization", (req, res) => {
  const mineId = req.query.mine_id;
  const date = req.query.date;
  
  let result = [...fleetSessions];
  
  if (mineId) result = result.filter(s => s.mine_id === mineId);
  if (date) result = result.filter(s => s.date === date);
  
  res.json(result);
});

router.post("/utilization", (req, res) => {
  const { asset_id, mine_id, shift, date, operating_hours, idle_hours, downtime_hours, operator } = req.body;
  
  if (!asset_id || !mine_id || !shift || !date) {
    return res.status(400).json({ error: "asset_id, mine_id, shift, and date required" });
  }
  
  const total = (operating_hours || 0) + (idle_hours || 0) + (downtime_hours || 0);
  const utilization = total > 0 ? ((operating_hours || 0) / total) * 100 : 0;
  
  const session = {
    id: `fs-${Date.now()}`.slice(-8),
    asset_id,
    mine_id,
    asset_tag: assets.find(a => a.id === asset_id)?.asset_tag || "",
    shift,
    date,
    operating_hours: operating_hours || 0,
    idle_hours: idle_hours || 0,
    downtime_hours: downtime_hours || 0,
    utilization_percent: Math.round(utilization * 10) / 10,
    fuel_consumed_litres: req.body.fuel_consumed_litres || 0,
    fuel_cost_ksh: req.body.fuel_cost_ksh || 0,
    loads_completed: req.body.loads_completed,
    tonnes_moved: req.body.tonnes_moved,
    avg_cycle_time_min: req.body.avg_cycle_time_min,
    avg_speed_kmh: req.body.avg_speed_kmh,
    gps_distance_km: req.body.gps_distance_km,
    operator: operator || "",
  };
  
  fleetSessions.push(session);
  res.status(201).json(session);
});

router.get("/productivity", (req, res) => {
  const mineId = req.query.mine_id;
  
  const result = assets
    .filter(a => !mineId || a.mine_id === mineId)
    .map(asset => {
      const sessions = fleetSessions.filter(s => s.asset_id === asset.id);
      const totalHours = sessions.reduce((sum, s) => sum + s.operating_hours, 0);
      const totalTonne = sessions.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
      
      return {
        asset_id: asset.id,
        asset_tag: asset.asset_tag,
        name: asset.name,
        operating_hours: totalHours,
        tonnes_moved: totalTonne,
        efficiency_flag: totalHours > 100 ? "high_utilization" : "normal",
      };
    });
  
  res.json(result);
});

router.get("/fuel-analysis", (req, res) => {
  const mineId = req.query.mine_id;
  
  const result = fleetSessions
    .filter(s => !mineId || s.mine_id === mineId)
    .map(s => ({
      asset_tag: s.asset_tag,
      fuel_litres: s.fuel_consumed_litres,
      fuel_cost_ksh: s.fuel_cost_ksh,
      litres_per_tonne: s.tonnes_moved ? (s.fuel_consumed_litres / s.tonnes_moved).toFixed(2) : null,
    }));
  
  res.json(result);
});

router.get("/idle-alerts", (req, res) => {
  const mineId = req.query.mine_id;
  
  const result = fleetSessions
    .filter(s => !mineId || s.mine_id === mineId)
    .filter(s => s.utilization_percent < 60)
    .map(s => ({
      asset_tag: s.asset_tag,
      utilization_percent: s.utilization_percent,
      idle_hours: s.idle_hours,
      recommendation: "Investigate idle time - potential efficiency improvement opportunity",
    }));
  
  res.json(result);
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
    created_by: "Fleet API",
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

module.exports = router;