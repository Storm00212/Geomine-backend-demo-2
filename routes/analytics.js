const express = require("express");
const router = express.Router();
const { mines, assets, sensors, maintenanceRecommendations, maintenanceRecords, fleetSessions, readings } = require("../store");

router.get("/operational", (req, res) => {
  const mineId = req.query.mine_id;
  
  const minesList = mineId 
    ? mines.filter(m => m.id === mineId) 
    : mines;
  
  const result = minesList.map(mine => {
    const mineAssets = assets.filter(a => a.mine_id === mine.id);
    const mineSessions = fleetSessions.filter(s => s.mine_id === mine.id);
    const mineRecommendations = maintenanceRecommendations.filter(r => r.mine_id === mine.id);
    const mineRecords = maintenanceRecords.filter(r => r.mine_id === mine.id);
    const mineIncidents = [];
    const completedMaint = mineRecords.filter(r => r.status === "completed");
    
    const totalHours = mineSessions.reduce((sum, s) => sum + s.operating_hours, 0);
    
    return {
      mine_id: mine.id,
      mine_name: mine.name,
      operational_report: {
        kpis: {
          sensor_uptime_percent: mineAssets.length > 0 ? 95 : 0,
          asset_availability_percent: mineAssets.filter(a => a.status === "operational").length / Math.max(1, mineAssets.length) * 100,
          mean_time_between_incidents_hours: 250,
          open_incidents: 0,
          total_maintenance_cost_ksh: completedMaint.reduce((sum, r) => sum + (r.cost_ksh || 0), 0),
          total_planned_downtime_hours: mineSessions.reduce((sum, s) => sum + s.downtime_hours, 0),
        },
        risk: {
          risk_score: mineRecommendations.filter(r => r.status === "open").length * 10 + 20,
          risk_level: "low",
        },
      },
    };
  });
  
  res.json({
    platform_risk_level: "low",
    operational_reports: result,
  });
});

router.get("/risk", (req, res) => {
  const mineId = req.query.mine_id;
  
  const assetsList = mineId 
    ? assets.filter(a => a.mine_id === mineId) 
    : assets;
  
  const result = assetsList.map(a => {
    const recs = maintenanceRecommendations.filter(r => r.asset_id === a.id && r.status === "open");
    const likelihood = recs.length > 0 ? Math.min(5, recs.length + 1) : 1;
    const consequence = a.criticality === "critical" ? 5 : a.criticality === "high" ? 4 : 3;
    
    return {
      asset_id: a.id,
      asset_tag: a.asset_tag,
      name: a.name,
      likelihood,
      consequence,
      risk_score: likelihood * consequence,
      risk_level: likelihood * consequence >= 15 ? "critical" : likelihood * consequence >= 8 ? "high" : "medium",
      risk_matrix: {
        likelihood,
        consequence,
      },
      failure_risk_percent: recs.length > 0 ? Math.max(...recs.map(r => r.estimated_failure_risk_percent)) : 5,
    };
  });
  
  const criticalRisk = result.filter(r => r.risk_level === "critical");
  const highRisk = result.filter(r => r.risk_level === "high");
  const mediumRisk = result.filter(r => r.risk_level === "medium");
  const lowRisk = result.filter(r => r.risk_level === "low");
  
  res.json({
    summary: {
      critical_risk: criticalRisk.length,
      high_risk: highRisk.length,
      medium_risk: mediumRisk.length,
      low_risk: lowRisk.length,
    },
    risk_matrix: {
      critical: criticalRisk,
      high: highRisk,
      medium: mediumRisk,
      low: lowRisk,
    },
  });
});

router.get("/maintenance-performance", (req, res) => {
  const mineId = req.query.mine_id;
  
  const recs = mineId 
    ? maintenanceRecommendations.filter(r => r.mine_id === mineId) 
    : maintenanceRecommendations;
  
  const records = mineId 
    ? maintenanceRecords.filter(r => r.mine_id === mineId) 
    : maintenanceRecords;
  
  const aiTriggered = records.filter(r => r.triggered_by === "predictive_alert");
  
  res.json({
    work_orders: {
      total_completed: records.filter(r => r.status === "completed").length,
      triggered_by_predictive_ai: aiTriggered.length,
      predictive_ai_share_percent: records.length > 0 ? Math.round((aiTriggered.length / records.length) * 100) : 0,
    },
    cost_analysis: {
      total_maintenance_spend_ksh: records.reduce((sum, r) => sum + (r.cost_ksh || 0), 0),
      potential_savings_from_open_recs_ksh: recs.reduce((sum, r) => sum + (r.estimated_repair_cost_if_unaddressed_ksh || 0), 0),
    },
    open_recommendations_summary: {
      critical: recs.filter(r => r.priority === "critical").length,
      high: recs.filter(r => r.priority === "high").length,
      medium: recs.filter(r => r.priority === "medium").length,
    },
  });
});

router.get("/sensor-health", (req, res) => {
  const mineId = req.query.mine_id;
  
  const sensorsList = mineId 
    ? sensors.filter(s => s.mine_id === mineId) 
    : sensors;
  
  const onlineCount = sensorsList.filter(s => s.status === "online").length;
  const overdueCount = sensorsList.filter(s => {
    const calAge = Math.floor((Date.now() - new Date(s.calibrated_at).getTime()) / (1000 * 60 * 60 * 24));
    return calAge > 180;
  }).length;
  
  const sensorsWithStatus = sensorsList.map(s => {
    const calAge = Math.floor((Date.now() - new Date(s.calibrated_at).getTime()) / (1000 * 60 * 60 * 24));
    const calStatus = calAge > 180 ? "overdue" : calAge > 150 ? "due_soon" : "current";
    
    return {
      sensor_id: s.id,
      type: s.type,
      calibration_status: calStatus,
      calibration_age_days: calAge,
      alert_rate_percent: readings[s.id] ? Math.round(readings[s.id].filter(r => r.status === "alert").length / Math.max(1, readings[s.id].length) * 100) : 0,
    };
  });
  
  res.json({
    total_sensors: sensorsList.length,
    online: onlineCount,
    offline: sensorsList.length - onlineCount,
    calibration_overdue: overdueCount,
    sensors: sensorsWithStatus,
  });
});

module.exports = router;