const express = require("express");
const router = express.Router();
const { mines, assets, sensors, maintenanceRecords, maintenanceRecommendations, fleetSessions, hazardZones, incidents } = require("../store");

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
  
  const filteredRecs = mineId 
    ? maintenanceRecommendations.filter(r => r.mine_id === mineId) 
    : maintenanceRecommendations;
  
  const filteredIncidents = mineId 
    ? incidents.filter(i => i.mine_id === mineId) 
    : incidents;
  
  const filteredHazards = mineId 
    ? hazardZones.filter(h => h.mine_id === mineId) 
    : hazardZones;
  
  const filteredSessions = mineId 
    ? fleetSessions.filter(s => s.mine_id === mineId) 
    : fleetSessions;
  
  const mineResults = filteredMines.map(mine => {
    const mineAssets = filteredAssets.filter(a => a.mine_id === mine.id);
    const mineRecs = filteredRecs.filter(r => mineAssets.some(a => a.id === r.asset_id));
    const mineIncidents = filteredIncidents.filter(i => i.mine_id === mine.id);
    const mineHazards = filteredHazards.filter(h => h.mine_id === mine.id);
    const mineSessions = filteredSessions.filter(s => s.mine_id === mine.id);
    const mineSensors = filteredSensors.filter(s => s.mine_id === mine.id);
    
    const operationalAssets = mineAssets.filter(a => a.status === "operational").length;
    const openRecs = mineRecs.filter(r => r.status === "open");
    const criticalRecs = openRecs.filter(r => r.priority === "critical");
    const openIncidents = mineIncidents.filter(i => !i.resolved);
    const criticalIncidents = openIncidents.filter(i => i.severity === "critical");
    const activeHazards = mineHazards.filter(h => h.status === "active");
    
    const totalHours = mineSessions.reduce((sum, s) => sum + s.utilization_percent, 0);
    const avgUtilization = mineSessions.length > 0 ? totalHours / mineSessions.length : 0;
    const totalTonnes = mineSessions.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
    
    const openRec = openRecs.sort((a, b) => b.estimated_failure_risk_percent - a.estimated_failure_risk_percent)[0];
    
    const topAlert = openRec ? {
      asset_id: openRec.asset_id,
      finding: openRec.finding,
    } : null;
    
    const safetyScore = Math.max(0, 100 - (criticalIncidents.length * 15) - (activeHazards.length * 10));
    const maintScore = Math.max(0, 100 - (criticalRecs.length * 10) - (openRecs.length * 5));
    const fleetScore = Math.min(100, Math.max(0, avgUtilization * 0.8 + (totalTonnes > 0 ? 20 : 0)));
    
    const healthScore = Math.round(safetyScore * 0.4 + maintScore * 0.35 + fleetScore * 0.25);
    
    return {
      mine_id: mine.id,
      mine_name: mine.name,
      county: mine.county,
      mine_health_score: healthScore,
      mine_health_rating: healthScore >= 80 ? "healthy" : healthScore >= 60 ? "concern" : "critical",
      score_breakdown: {
        safety_score: safetyScore,
        maintenance_score: maintScore,
        fleet_score: fleetScore,
      },
      pillar_1_predictive_maintenance: {
        assets_total: mineAssets.length,
        assets_operational: operationalAssets,
        open_ai_recommendations: openRecs.length,
        critical_recommendations: criticalRecs.length,
        top_alert: topAlert,
      },
      pillar_2_safety_hazard_alerts: {
        sensors_total: mineSensors.length,
        sensors_in_alert: mineSensors.length - mineSensors.filter(s => s.status === "online").length,
        open_incidents: openIncidents.length,
        critical_open_incidents: criticalIncidents.length,
        active_hazard_zones: activeHazards.length,
        active_hazard_types: [...new Set(activeHazards.map(h => h.type))],
      },
      pillar_3_fleet_operational_efficiency: {
        avg_fleet_utilization_percent: Math.round(avgUtilization),
        total_tonnes_moved: totalTonnes,
        total_fuel_consumed_litres: mineSessions.reduce((sum, s) => sum + (s.fuel_consumed_litres || 0), 0),
        total_fuel_cost_ksh: mineSessions.reduce((sum, s) => sum + (s.fuel_cost_ksh || 0), 0),
        underperforming_assets: [],
      },
    };
  });
  
  const totalSafetyScore = mineResults.reduce((sum, m) => sum + m.score_breakdown.safety_score, 0) / mineResults.length;
  const totalMaintScore = mineResults.reduce((sum, m) => sum + m.score_breakdown.maintenance_score, 0) / mineResults.length;
  const totalFleetScore = mineResults.reduce((sum, m) => sum + m.score_breakdown.fleet_score, 0) / mineResults.length;
  const platformScore = Math.round(totalSafetyScore * 0.4 + totalMaintScore * 0.35 + totalFleetScore * 0.25);
  
  res.json({
    timestamp: new Date().toISOString(),
    platform_health_score: platformScore,
    platform_health_rating: platformScore >= 80 ? "healthy" : platformScore >= 60 ? "concern" : "critical",
    mines: mineResults,
  });
});

module.exports = router;