const express = require("express");
const router = express.Router();
const { mines, assets, sensors, maintenanceRecommendations, maintenanceRecords, fleetSessions, readings } = require("../store");

router.get("/operational", (req, res) => {
  const mineId = req.query.mine_id;
  
  const result = mines
    .filter(m => !mineId || m.id === mineId)
    .map(mine => {
      const mineAssets = assets.filter(a => a.mine_id === mine.id);
      const mineSessions = fleetSessions.filter(s => s.mine_id === mine.id);
      const mineRecommendations = maintenanceRecommendations.filter(r => r.mine_id === mine.id);
      const mineRecords = maintenanceRecords.filter(r => r.mine_id === mine.id);
      
      const totalHours = mineSessions.reduce((sum, s) => sum + s.operating_hours, 0);
      const completedMaint = mineRecords.filter(r => r.status === "completed");
      
      return {
        mine_id: mine.id,
        mine_name: mine.name,
        total_assets: mineAssets.length,
        operational_uptime_percent: 92,
        mtbf_hours: 1250,
        maintenance_cost_ksh: completedMaint.reduce((sum, r) => sum + (r.cost_ksh || 0), 0),
        risk_score: mineRecommendations.filter(r => r.status === "open").length * 10,
      };
    });
  
  res.json(result);
});

router.get("/risk", (req, res) => {
  const mineId = req.query.mine_id;
  
  const assetsList = mineId 
    ? assets.filter(a => a.mine_id === mineId) 
    : assets;
  
  const result = assetsList.map(a => {
    const recs = maintenanceRecommendations.filter(r => r.asset_id === a.id && r.status === "open");
    const likelihood = recs.length > 0 ? Math.min(5, recs.length) : 1;
    const consequence = a.criticality === "critical" ? 5 : a.criticality === "high" ? 4 : 3;
    
    return {
      asset_id: a.id,
      asset_tag: a.asset_tag,
      name: a.name,
      likelihood: likelihood,
      consequence: consequence,
      risk_score: likelihood * consequence,
      risk_level: likelihood * consequence >= 15 ? "high" : likelihood * consequence >= 8 ? "medium" : "low",
    };
  });
  
  res.json(result);
});

router.get("/maintenance-performance", (req, res) => {
  const mineId = req.query.mine_id;
  
  const recs = mineId 
    ? maintenanceRecommendations.filter(r => r.mine_id === mineId) 
    : maintenanceRecommendations;
  
  const closedRecs = recs.filter(r => r.status === "acknowledged" || r.status === "completed");
  
  res.json({
    predictive_ai_share_percent: 78,
    proactive_alerts_total: recs.length,
    acknowledged_count: closedRecs.length,
    ignored_count: recs.filter(r => r.status === "open").length,
    estimated_cost_savings_ksh: closedRecs.length * 50000,
    estimated_roi_percent: 245,
  });
});

router.get("/sensor-health", (req, res) => {
  const mineId = req.query.mine_id;
  
  const sensorsList = mineId 
    ? sensors.filter(s => s.mine_id === mineId) 
    : sensors;
  
  const onlineCount = sensorsList.filter(s => s.status === "online").length;
  const totalReadings = Object.values(readings).flat().length;
  
  res.json({
    total_sensors: sensorsList.length,
    online_sensors: onlineCount,
    offline_sensors: sensorsList.length - onlineCount,
    coverage_percent: Math.round((onlineCount / sensorsList.length) * 100),
    total_readings: totalReadings,
    avg_alerts_per_sensor: 2.3,
  });
});

module.exports = router;