const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../data/store");

// ── FLEET UTILIZATION ─────────────────────────────────────────────────────────

// GET /fleet/utilization — shift-level utilization across all fleet
router.get("/utilization", (req, res) => {
  const { mine_id, asset_id, date } = req.query;
  let sessions = db.fleetSessions.filter(s => req.user.mine_ids.includes(s.mine_id));

  if (mine_id)  sessions = sessions.filter(s => s.mine_id === mine_id);
  if (asset_id) sessions = sessions.filter(s => s.asset_id === asset_id);
  if (date)     sessions = sessions.filter(s => s.date === date);

  // Aggregate across sessions
  const totalFuel      = sessions.reduce((sum, s) => sum + (s.fuel_consumed_litres || 0), 0);
  const totalFuelCost  = sessions.reduce((sum, s) => sum + (s.fuel_cost_ksh || 0), 0);
  const totalTonnes    = sessions.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
  const totalLoads     = sessions.reduce((sum, s) => sum + (s.loads_completed || 0), 0);
  const totalOpHours   = sessions.reduce((sum, s) => sum + (s.operating_hours || 0), 0);
  const totalIdleHours = sessions.reduce((sum, s) => sum + (s.idle_hours || 0), 0);
  const avgUtilization = sessions.length > 0
    ? parseFloat((sessions.reduce((sum, s) => sum + s.utilization_percent, 0) / sessions.length).toFixed(1))
    : 0;
  const fuelPerTonne   = totalTonnes > 0
    ? parseFloat((totalFuel / totalTonnes).toFixed(3))
    : null;

  res.json({
    as_of: db.ts(),
    filters: { mine_id: mine_id || "all", asset_id: asset_id || "all", date: date || "all" },
    fleet_summary: {
      sessions_included: sessions.length,
      avg_utilization_percent: avgUtilization,
      total_operating_hours: parseFloat(totalOpHours.toFixed(1)),
      total_idle_hours: parseFloat(totalIdleHours.toFixed(1)),
      idle_to_operating_ratio: totalOpHours > 0
        ? parseFloat((totalIdleHours / totalOpHours).toFixed(2))
        : null,
      total_fuel_consumed_litres: totalFuel,
      total_fuel_cost_ksh: totalFuelCost,
      fuel_efficiency_litres_per_tonne: fuelPerTonne,
      total_tonnes_moved: totalTonnes,
      total_loads_completed: totalLoads,
    },
    sessions: sessions.sort((a, b) => b.utilization_percent - a.utilization_percent),
  });
});

// POST /fleet/utilization — log a new shift session
router.post("/utilization", (req, res) => {
  const { asset_id, mine_id, shift, date } = req.body;
  if (!asset_id || !mine_id || !shift || !date) {
    return res.status(400).json({ error: "asset_id, mine_id, shift, and date are required" });
  }
  const asset = db.assets.find(a => a.id === asset_id);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const opHours   = req.body.operating_hours   || 0;
  const idleHours = req.body.idle_hours         || 0;
  const shiftHours = opHours + idleHours + (req.body.downtime_hours || 0);
  const utilization = shiftHours > 0
    ? parseFloat(((opHours / shiftHours) * 100).toFixed(1))
    : 0;

  const session = {
    id: uuidv4(),
    asset_id, mine_id,
    asset_tag: asset.asset_tag,
    shift, date,
    operating_hours:   opHours,
    idle_hours:        idleHours,
    downtime_hours:    req.body.downtime_hours   || 0,
    utilization_percent: utilization,
    fuel_consumed_litres: req.body.fuel_consumed_litres || null,
    fuel_cost_ksh:     req.body.fuel_cost_ksh    || null,
    loads_completed:   req.body.loads_completed  || null,
    tonnes_moved:      req.body.tonnes_moved     || null,
    avg_cycle_time_min:req.body.avg_cycle_time_min || null,
    avg_speed_kmh:     req.body.avg_speed_kmh    || null,
    gps_distance_km:   req.body.gps_distance_km  || null,
    metres_drilled:    req.body.metres_drilled   || null,
    operator:          req.body.operator         || "Unknown",
    created_at: db.ts(),
  };
  db.fleetSessions.push(session);
  res.status(201).json(session);
});

// GET /fleet/productivity — productivity trends and efficiency benchmarks
router.get("/productivity", (req, res) => {
  const { mine_id } = req.query;
  let sessions = db.fleetSessions.filter(s => req.user.mine_ids.includes(s.mine_id));
  if (mine_id) sessions = sessions.filter(s => s.mine_id === mine_id);

  // Per-asset breakdown
  const assetIds = [...new Set(sessions.map(s => s.asset_id))];
  const assetBreakdown = assetIds.map(assetId => {
    const asset = db.assets.find(a => a.id === assetId);
    const assetSessions = sessions.filter(s => s.asset_id === assetId);

    const avgUtil    = parseFloat((assetSessions.reduce((sum, s) => sum + s.utilization_percent, 0) / assetSessions.length).toFixed(1));
    const totalFuel  = assetSessions.reduce((sum, s) => sum + (s.fuel_consumed_litres || 0), 0);
    const totalTonnes= assetSessions.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
    const totalIdle  = assetSessions.reduce((sum, s) => sum + (s.idle_hours || 0), 0);
    const totalOp    = assetSessions.reduce((sum, s) => sum + (s.operating_hours || 0), 0);

    // Efficiency flag
    const efficiencyFlag = avgUtil >= 80 ? "high_performer"
      : avgUtil >= 65 ? "adequate"
      : "underperforming";

    return {
      asset_id: assetId,
      asset_tag: asset?.asset_tag || assetId,
      name: asset?.name || "Unknown",
      mine_id: asset?.mine_id,
      sessions_analysed: assetSessions.length,
      avg_utilization_percent: avgUtil,
      efficiency_flag: efficiencyFlag,
      total_idle_hours: parseFloat(totalIdle.toFixed(1)),
      total_operating_hours: parseFloat(totalOp.toFixed(1)),
      idle_ratio: totalOp > 0 ? parseFloat((totalIdle / totalOp).toFixed(2)) : null,
      total_fuel_litres: totalFuel,
      fuel_per_tonne: totalTonnes > 0 ? parseFloat((totalFuel / totalTonnes).toFixed(3)) : null,
      total_tonnes_moved: totalTonnes,
      improvement_opportunity: avgUtil < 75
        ? `Idle time ${parseFloat((totalIdle / (totalOp + totalIdle) * 100).toFixed(0))}% of shift — investigate causes (queuing, operator breaks, awaiting blast clearance)`
        : null,
    };
  }).sort((a, b) => a.avg_utilization_percent - b.avg_utilization_percent);

  const underperforming = assetBreakdown.filter(a => a.efficiency_flag === "underperforming");

  res.json({
    as_of: db.ts(),
    fleet_health: underperforming.length === 0 ? "good"
      : underperforming.length <= 1 ? "attention_needed"
      : "poor",
    assets_underperforming: underperforming.length,
    productivity_by_asset: assetBreakdown,
  });
});

// GET /fleet/fuel-analysis — fuel consumption trends and cost breakdown
router.get("/fuel-analysis", (req, res) => {
  const { mine_id } = req.query;
  let sessions = db.fleetSessions.filter(s =>
    req.user.mine_ids.includes(s.mine_id) && s.fuel_consumed_litres
  );
  if (mine_id) sessions = sessions.filter(s => s.mine_id === mine_id);

  const totalFuel     = sessions.reduce((sum, s) => sum + s.fuel_consumed_litres, 0);
  const totalFuelCost = sessions.reduce((sum, s) => sum + (s.fuel_cost_ksh || 0), 0);
  const totalTonnes   = sessions.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
  const totalOpHours  = sessions.reduce((sum, s) => sum + (s.operating_hours || 0), 0);

  // Per-asset fuel breakdown
  const byAsset = [...new Set(sessions.map(s => s.asset_id))].map(assetId => {
    const asset = db.assets.find(a => a.id === assetId);
    const asSessions = sessions.filter(s => s.asset_id === assetId);
    const fuel  = asSessions.reduce((sum, s) => sum + s.fuel_consumed_litres, 0);
    const cost  = asSessions.reduce((sum, s) => sum + (s.fuel_cost_ksh || 0), 0);
    const tonnes= asSessions.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
    const opH   = asSessions.reduce((sum, s) => sum + (s.operating_hours || 0), 0);
    return {
      asset_id: assetId,
      asset_tag: asset?.asset_tag || assetId,
      name: asset?.name,
      total_fuel_litres: fuel,
      total_fuel_cost_ksh: cost,
      fuel_per_tonne: tonnes > 0 ? parseFloat((fuel / tonnes).toFixed(3)) : null,
      fuel_per_operating_hour: opH > 0 ? parseFloat((fuel / opH).toFixed(1)) : null,
      share_of_fleet_fuel_percent: parseFloat(((fuel / totalFuel) * 100).toFixed(1)),
    };
  }).sort((a, b) => b.total_fuel_litres - a.total_fuel_litres);

  res.json({
    as_of: db.ts(),
    summary: {
      total_fuel_consumed_litres: parseFloat(totalFuel.toFixed(0)),
      total_fuel_cost_ksh: totalFuelCost,
      avg_fuel_price_per_litre_ksh: totalFuel > 0
        ? parseFloat((totalFuelCost / totalFuel).toFixed(2))
        : null,
      fleet_fuel_per_tonne: totalTonnes > 0
        ? parseFloat((totalFuel / totalTonnes).toFixed(3))
        : null,
      fleet_fuel_per_hour: totalOpHours > 0
        ? parseFloat((totalFuel / totalOpHours).toFixed(1))
        : null,
    },
    by_asset: byAsset,
  });
});

// GET /fleet/idle-alerts — assets with excessive idle time
router.get("/idle-alerts", (req, res) => {
  const IDLE_THRESHOLD_RATIO = 0.25; // flag if idle > 25% of shift hours
  let sessions = db.fleetSessions.filter(s => req.user.mine_ids.includes(s.mine_id));

  const idleAlerts = sessions
    .filter(s => {
      const total = s.operating_hours + s.idle_hours + s.downtime_hours;
      return total > 0 && (s.idle_hours / total) > IDLE_THRESHOLD_RATIO;
    })
    .map(s => {
      const asset = db.assets.find(a => a.id === s.asset_id);
      const total = s.operating_hours + s.idle_hours + s.downtime_hours;
      return {
        session_id: s.id,
        asset_tag: s.asset_tag,
        name: asset?.name,
        mine_id: s.mine_id,
        shift: s.shift,
        date: s.date,
        operator: s.operator,
        idle_hours: s.idle_hours,
        idle_percent: parseFloat(((s.idle_hours / total) * 100).toFixed(1)),
        threshold_percent: IDLE_THRESHOLD_RATIO * 100,
        estimated_wasted_fuel_litres: s.fuel_consumed_litres
          ? parseFloat((s.fuel_consumed_litres * (s.idle_hours / (s.operating_hours + s.idle_hours)) * 0.3).toFixed(1))
          : null,
        recommended_action: "Review operator log for this shift. Common causes: queue delays at loading point, blast clearance wait, unscheduled stops.",
      };
    });

  res.json({
    as_of: db.ts(),
    idle_threshold_percent: IDLE_THRESHOLD_RATIO * 100,
    alerts_raised: idleAlerts.length,
    idle_alerts: idleAlerts,
  });
});

// ── HAZARD ZONES ─────────────────────────────────────────────────────────────

// GET /fleet/hazard-zones — geo-fenced unsafe areas
router.get("/hazard-zones", (req, res) => {
  const { mine_id, type, status } = req.query;
  let zones = db.hazardZones.filter(z => req.user.mine_ids.includes(z.mine_id));

  if (mine_id) zones = zones.filter(z => z.mine_id === mine_id);
  if (type)    zones = zones.filter(z => z.type === type);
  if (status)  zones = zones.filter(z => z.status === status);

  res.json({
    as_of: db.ts(),
    count: zones.length,
    active_zones: zones.filter(z => z.status === "active").length,
    hazard_zones: zones,
  });
});

// POST /fleet/hazard-zones — declare a new hazard zone
router.post("/hazard-zones", (req, res) => {
  const { mine_id, name, type, coordinates, radius_m, reason } = req.body;
  if (!mine_id || !name || !type || !coordinates || !reason) {
    return res.status(400).json({ error: "mine_id, name, type, coordinates, and reason are required" });
  }
  const zone = {
    id: uuidv4(),
    mine_id, name, type,
    status: "active",
    coordinates,
    radius_m: radius_m || 50,
    active_from: db.ts(),
    active_until: req.body.active_until || null,
    reason,
    created_by: req.body.created_by || `API – role: ${req.user.role}`,
    created_at: db.ts(),
  };
  db.hazardZones.push(zone);

  // Auto-log a safety incident for the hazard zone declaration
  const incident = {
    id: uuidv4(),
    mine_id,
    sensor_id: null,
    asset_id: null,
    type: "hazard_zone_declared",
    category: "safety",
    severity: type === "blast_exclusion" ? "critical" : "warning",
    description: `Hazard zone declared: ${name}. Reason: ${reason}`,
    hazards: [{ field: "zone", hazard: reason }],
    resolved: false,
    resolved_at: null,
    created_at: db.ts(),
  };
  db.incidents.push(incident);

  res.status(201).json({ zone, incident_id: incident.id });
});

// PATCH /fleet/hazard-zones/:id/clear — clear a hazard zone
router.patch("/hazard-zones/:id/clear", (req, res) => {
  const zone = db.hazardZones.find(z => z.id === req.params.id);
  if (!zone) return res.status(404).json({ error: "Hazard zone not found" });
  zone.status = "cleared";
  zone.cleared_at = db.ts();
  zone.cleared_by = req.body.cleared_by || `API – role: ${req.user.role}`;
  res.json({ message: "Hazard zone cleared", zone });
});

module.exports = router;
