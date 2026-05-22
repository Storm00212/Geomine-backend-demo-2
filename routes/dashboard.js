const express = require("express");
const router = express.Router();
const { mines, assets, sensors, maintenanceRecords, maintenanceRecommendations, fleetSessions, hazardZones, readings, incidents } = require("../store");

router.get("/", (req, res) => {
  const mineId = req.query.mine_id;
  
  const filteredMines = mineId 
    ? mines.filter(m => m.id === mineId) 
    : mines;
  
  const filteredAssets = mineId 
    ? assets.filter(a => a.mine_id === mineId) 
    : assets;
  
  const filteredSensors = mineId 
    ? sensors.filter(s => s.mine_id === mineId) 
    : sensors;
  
  const openRecommendations = maintenanceRecommendations.filter(r => r.status === "open");
  const criticalIncidents = incidents.filter(i => !i.resolved);
  const activeHazards = hazardZones.filter(h => h.status === "active");
  
  const assetHealth = filteredAssets.map(a => {
    const recs = maintenanceRecommendations.filter(r => r.asset_id === a.id && r.status === "open");
    const sessions = fleetSessions.filter(s => s.asset_id === a.id);
    const utilization = sessions.length > 0 
      ? sessions.reduce((sum, s) => sum + s.utilization_percent, 0) / sessions.length 
      : 0;
    
    return {
      id: a.id,
      asset_tag: a.asset_tag,
      name: a.name,
      status: a.status,
      operating_hours: a.operating_hours,
      next_service_due_hours: a.next_service_due_hours,
      health_score: recs.length > 0 ? 75 : 92,
      open_recommendations: recs.length,
      utilization_percent: Math.round(utilization),
    };
  });

  res.json({
    timestamp: new Date().toISOString(),
    mines: filteredMines,
    assets: assetHealth,
    open_maintenance_recommendations: openRecommendations.length,
    critical_safety_incidents: criticalIncidents.length,
    active_hazard_zones: activeHazards.length,
    summary: {
      total_assets: filteredAssets.length,
      operational_assets: filteredAssets.filter(a => a.status === "operational").length,
      under_maintenance: filteredAssets.filter(a => a.status === "under_maintenance").length,
      total_sensors: filteredSensors.length,
      online_sensors: filteredSensors.filter(s => s.status === "online").length,
    },
  });
});

module.exports = router;