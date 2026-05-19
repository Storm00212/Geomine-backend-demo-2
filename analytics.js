const router = require("express").Router();
const db = require("../data/store");

// GET /analytics/operational — per-mine operational KPIs
router.get("/operational", (req, res) => {
  const { mine_id } = req.query;
  const accessibleMines = db.mines.filter(m => req.user.mine_ids.includes(m.id));
  const targetMines = mine_id
    ? accessibleMines.filter(m => m.id === mine_id)
    : accessibleMines;

  const report = targetMines.map(mine => {
    const mineSensors  = db.sensors.filter(s => s.mine_id === mine.id);
    const mineAssets   = db.assets.filter(a => a.mine_id === mine.id);
    const mineIncidents = db.incidents.filter(i => i.mine_id === mine.id);
    const mineMaintenanceRecs = db.maintenanceRecords.filter(m => m.mine_id === mine.id);

    // Sensor uptime (% of sensors online)
    const sensorUptime = mineSensors.length > 0
      ? parseFloat(((mineSensors.filter(s => s.status === "online").length / mineSensors.length) * 100).toFixed(1))
      : 0;

    // Asset availability (% not under maintenance)
    const assetAvailability = mineAssets.length > 0
      ? parseFloat(((mineAssets.filter(a => a.status === "operational").length / mineAssets.length) * 100).toFixed(1))
      : 100;

    // MTBF — mean time between incidents (hours, simulated over last 30 days)
    const resolvedIncidents = mineIncidents.filter(i => i.resolved);
    const mtbf = resolvedIncidents.length > 1
      ? parseFloat((720 / resolvedIncidents.length).toFixed(1))   // 720h = 30 days
      : null;

    // Maintenance costs this period
    const completedMaint = mineMaintenanceRecs.filter(m => m.status === "completed");
    const totalMaintenanceCostKsh = completedMaint.reduce((sum, m) => sum + (m.cost_ksh || 0), 0);
    const totalDowntimeHours = completedMaint.reduce((sum, m) => sum + (m.downtime_hours || 0), 0);

    // Risk score (0–100): weighted by open critical incidents + overdue assets + sensor alerts
    const openCritical = mineIncidents.filter(i => !i.resolved && i.severity === "critical").length;
    const overdueAssets = mineAssets.filter(a =>
      (a.next_service_due_hours - a.operating_hours) < 0
    ).length;
    const latestReadings = mineSensors.map(s => {
      const h = db.readings[s.id] || [];
      return h[h.length - 1];
    }).filter(Boolean);
    const sensorAlerts = latestReadings.filter(r => r.status === "alert" || r.status === "maintenance_required").length;

    const riskScore = Math.min(100, (openCritical * 25) + (overdueAssets * 15) + (sensorAlerts * 10));
    const riskLevel = riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";

    return {
      mine_id: mine.id,
      mine_name: mine.name,
      county: mine.county,
      mineral_type: mine.mineral_type,
      status: mine.status,
      kpis: {
        sensor_uptime_percent: sensorUptime,
        asset_availability_percent: assetAvailability,
        mean_time_between_incidents_hours: mtbf,
        open_incidents: mineIncidents.filter(i => !i.resolved).length,
        resolved_incidents_30d: resolvedIncidents.length,
        total_maintenance_cost_ksh: totalMaintenanceCostKsh,
        total_planned_downtime_hours: totalDowntimeHours,
      },
      risk: {
        risk_score: riskScore,
        risk_level: riskLevel,
        contributing_factors: {
          open_critical_incidents: openCritical,
          overdue_asset_services: overdueAssets,
          sensors_in_alert: sensorAlerts,
        },
      },
    };
  });

  res.json({
    as_of: db.ts(),
    period: "last_30_days",
    mine_count: report.length,
    platform_risk_level: report.some(m => m.risk.risk_level === "high") ? "high"
      : report.some(m => m.risk.risk_level === "medium") ? "medium" : "low",
    operational_reports: report,
  });
});

// GET /analytics/risk — risk matrix across all assets and mines
router.get("/risk", (req, res) => {
  const accessibleMines = db.mines.filter(m => req.user.mine_ids.includes(m.id));
  const accessibleAssets = db.assets.filter(a => req.user.mine_ids.includes(a.mine_id));

  const assetRisks = accessibleAssets.map(asset => {
    const hoursToService = asset.next_service_due_hours - asset.operating_hours;
    const openRecs = db.maintenanceRecommendations.filter(r => r.asset_id === asset.id && r.status === "open");
    const highestRec = openRecs.sort((a, b) => b.estimated_failure_risk_percent - a.estimated_failure_risk_percent)[0];

    const failureRisk = highestRec
      ? highestRec.estimated_failure_risk_percent
      : Math.max(0, parseFloat(((500 - Math.max(0, hoursToService)) / 20).toFixed(1)));

    const consequence = asset.criticality === "critical" ? "high" : asset.criticality === "high" ? "medium" : "low";
    const likelihood = failureRisk > 30 ? "high" : failureRisk > 10 ? "medium" : "low";

    const matrix = {
      "high-high": "critical", "high-medium": "high", "high-low": "medium",
      "medium-high": "high",   "medium-medium": "medium", "medium-low": "low",
      "low-high": "medium",    "low-medium": "low",    "low-low": "low",
    };

    return {
      asset_id: asset.id,
      asset_tag: asset.asset_tag,
      name: asset.name,
      mine_id: asset.mine_id,
      category: asset.category,
      criticality: asset.criticality,
      status: asset.status,
      hours_to_service: hoursToService,
      failure_risk_percent: failureRisk,
      risk_matrix: {
        likelihood,
        consequence,
        overall_risk: matrix[`${likelihood}-${consequence}`] || "low",
      },
      open_recommendations: openRecs.length,
    };
  }).sort((a, b) => b.failure_risk_percent - a.failure_risk_percent);

  const critical = assetRisks.filter(a => a.risk_matrix.overall_risk === "critical");
  const high     = assetRisks.filter(a => a.risk_matrix.overall_risk === "high");
  const medium   = assetRisks.filter(a => a.risk_matrix.overall_risk === "medium");
  const low      = assetRisks.filter(a => a.risk_matrix.overall_risk === "low");

  res.json({
    as_of: db.ts(),
    summary: {
      total_assets_assessed: assetRisks.length,
      critical_risk: critical.length,
      high_risk: high.length,
      medium_risk: medium.length,
      low_risk: low.length,
    },
    risk_matrix: { critical, high, medium, low },
  });
});

// GET /analytics/maintenance-performance — cost savings and predictive accuracy
router.get("/maintenance-performance", (req, res) => {
  const completed = db.maintenanceRecords.filter(m =>
    req.user.mine_ids.includes(m.mine_id) && m.status === "completed"
  );
  const predictiveTriggers = completed.filter(m => m.triggered_by === "predictive_alert");
  const scheduledTriggers  = completed.filter(m => m.triggered_by === "schedule");
  const manualTriggers     = completed.filter(m => m.triggered_by === "manual");

  const totalCost     = completed.reduce((s, m) => s + (m.cost_ksh || 0), 0);
  const totalDowntime = completed.reduce((s, m) => s + (m.downtime_hours || 0), 0);

  const openRecs = db.maintenanceRecommendations.filter(r =>
    req.user.mine_ids.includes(r.mine_id)
  );
  const potentialSavings = openRecs.reduce((s, r) =>
    s + ((r.estimated_repair_cost_if_unaddressed_ksh || 0) - (r.preventive_cost_ksh || 0)), 0
  );

  res.json({
    as_of: db.ts(),
    period: "all_time",
    work_orders: {
      total_completed: completed.length,
      triggered_by_predictive_ai: predictiveTriggers.length,
      triggered_by_schedule: scheduledTriggers.length,
      triggered_manually: manualTriggers.length,
      predictive_ai_share_percent: completed.length > 0
        ? parseFloat(((predictiveTriggers.length / completed.length) * 100).toFixed(1))
        : 0,
    },
    cost_analysis: {
      total_maintenance_spend_ksh: totalCost,
      total_planned_downtime_hours: totalDowntime,
      potential_savings_from_open_recs_ksh: potentialSavings,
      avg_cost_per_work_order_ksh: completed.length > 0
        ? parseFloat((totalCost / completed.length).toFixed(0))
        : 0,
    },
    open_recommendations_summary: {
      total: openRecs.length,
      critical: openRecs.filter(r => r.priority === "critical").length,
      high: openRecs.filter(r => r.priority === "high").length,
      medium: openRecs.filter(r => r.priority === "medium").length,
    },
  });
});

// GET /analytics/sensor-health — aggregate sensor data quality and coverage
router.get("/sensor-health", (req, res) => {
  const accessible = db.sensors.filter(s => req.user.mine_ids.includes(s.mine_id));

  const sensorHealth = accessible.map(s => {
    const history = db.readings[s.id] || [];
    const recent = history.slice(-10);
    const alertCount = recent.filter(r => r.status === "alert" || r.status === "maintenance_required").length;
    const alertRate = recent.length > 0 ? parseFloat(((alertCount / recent.length) * 100).toFixed(1)) : 0;

    const calibrationAge = s.calibrated_at
      ? Math.floor((Date.now() - new Date(s.calibrated_at)) / (1000 * 60 * 60 * 24))
      : null;

    return {
      sensor_id: s.id,
      mine_id: s.mine_id,
      type: s.type,
      model: s.model,
      location_zone: s.location_zone,
      status: s.status,
      reading_count: history.length,
      alert_rate_percent: alertRate,
      calibration_age_days: calibrationAge,
      calibration_status: calibrationAge === null ? "unknown"
        : calibrationAge > 180 ? "overdue"
        : calibrationAge > 90 ? "due_soon"
        : "current",
      latest_reading_at: history.length > 0 ? history[history.length - 1].timestamp : null,
    };
  });

  res.json({
    as_of: db.ts(),
    total_sensors: sensorHealth.length,
    online: sensorHealth.filter(s => s.status === "online").length,
    calibration_overdue: sensorHealth.filter(s => s.calibration_status === "overdue").length,
    sensors: sensorHealth,
  });
});

module.exports = router;
