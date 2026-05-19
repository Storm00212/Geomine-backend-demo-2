const router = require("express").Router();
const db = require("../data/store");

// GET /dashboard — Integrated Mine Health Dashboard
// Combines Pillar 1 (Predictive Maintenance) + Pillar 2 (Safety & Hazard Alerts)
// + Pillar 3 (Fleet & Operational Efficiency) into a single mine-manager view.
router.get("/", (req, res) => {
  const { mine_id } = req.query;
  const accessibleMines = db.mines.filter(m => req.user.mine_ids.includes(m.id));
  const targetMines = mine_id
    ? accessibleMines.filter(m => m.id === mine_id)
    : accessibleMines;

  const dashboards = targetMines.map(mine => {

    // ── PILLAR 1: PREDICTIVE EQUIPMENT MAINTENANCE ──────────────────────────
    const mineAssets = db.assets.filter(a => a.mine_id === mine.id);
    const openRecs   = db.maintenanceRecommendations.filter(r => r.mine_id === mine.id && r.status === "open");
    const inProgress = db.maintenanceRecords.filter(r => r.mine_id === mine.id && r.status === "in_progress");

    const assetsSorted = mineAssets.map(a => ({
      asset_id: a.id, asset_tag: a.asset_tag, name: a.name,
      status: a.status, criticality: a.criticality,
      hours_to_service: a.next_service_due_hours - a.operating_hours,
    })).sort((a, b) => a.hours_to_service - b.hours_to_service);

    const criticalRec = openRecs.find(r => r.priority === "critical");

    const maintenance_pillar = {
      assets_total: mineAssets.length,
      assets_operational: mineAssets.filter(a => a.status === "operational").length,
      assets_under_maintenance: mineAssets.filter(a => a.status === "under_maintenance").length,
      open_ai_recommendations: openRecs.length,
      critical_recommendations: openRecs.filter(r => r.priority === "critical").length,
      work_orders_in_progress: inProgress.length,
      next_service_due: assetsSorted[0] || null,
      top_alert: criticalRec ? {
        asset_id: criticalRec.asset_id,
        finding: criticalRec.finding,
        failure_risk_percent: criticalRec.estimated_failure_risk_percent,
        action: criticalRec.recommended_action,
        cost_to_act_ksh: criticalRec.preventive_cost_ksh,
        cost_if_ignored_ksh: criticalRec.estimated_repair_cost_if_unaddressed_ksh,
      } : null,
    };

    // ── PILLAR 2: SMART SAFETY & HAZARD ALERTS ──────────────────────────────
    const mineSensors  = db.sensors.filter(s => s.mine_id === mine.id);
    const mineIncidents= db.incidents.filter(i => i.mine_id === mine.id);
    const activeZones  = db.hazardZones.filter(z => z.mine_id === mine.id && z.status === "active");

    const latestReadings = mineSensors.map(s => {
      const h = db.readings[s.id] || [];
      return { sensor: s, reading: h[h.length - 1] || null };
    });
    const sensorsInAlert = latestReadings.filter(r => r.reading?.status === "alert");

    const openIncidents  = mineIncidents.filter(i => !i.resolved);
    const criticalOpen   = openIncidents.filter(i => i.severity === "critical");

    // Aggregate all current hazard types from open incidents
    const activeHazardTypes = [...new Set(
      openIncidents.flatMap(i => (i.hazards || []).map(h => h.field))
    )];

    const safety_pillar = {
      sensors_total: mineSensors.length,
      sensors_online: mineSensors.filter(s => s.status === "online").length,
      sensors_in_alert: sensorsInAlert.length,
      active_hazard_zones: activeZones.length,
      open_incidents: openIncidents.length,
      critical_open_incidents: criticalOpen.length,
      active_hazard_types: activeHazardTypes,
      latest_critical: criticalOpen[0] || null,
      sensor_alerts: sensorsInAlert.map(r => ({
        sensor_id: r.sensor.id,
        type: r.sensor.type,
        zone: r.sensor.location_zone,
        status: r.reading.status,
        anomalies: r.reading.anomalies || [],
      })),
    };

    // ── PILLAR 3: FLEET & OPERATIONAL EFFICIENCY ─────────────────────────────
    const todaySessions = db.fleetSessions.filter(s => s.mine_id === mine.id);
    const totalOpHours  = todaySessions.reduce((sum, s) => sum + (s.operating_hours || 0), 0);
    const totalIdleHrs  = todaySessions.reduce((sum, s) => sum + (s.idle_hours || 0), 0);
    const totalFuel     = todaySessions.reduce((sum, s) => sum + (s.fuel_consumed_litres || 0), 0);
    const totalTonnes   = todaySessions.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
    const avgUtil = todaySessions.length > 0
      ? parseFloat((todaySessions.reduce((s, x) => s + x.utilization_percent, 0) / todaySessions.length).toFixed(1))
      : null;

    const underperformers = todaySessions.filter(s => s.utilization_percent < 70);

    const fleet_pillar = {
      active_assets_this_period: todaySessions.length,
      avg_fleet_utilization_percent: avgUtil,
      total_operating_hours: parseFloat(totalOpHours.toFixed(1)),
      total_idle_hours: parseFloat(totalIdleHrs.toFixed(1)),
      total_fuel_consumed_litres: totalFuel,
      total_tonnes_moved: totalTonnes,
      fuel_efficiency_litres_per_tonne: totalTonnes > 0
        ? parseFloat((totalFuel / totalTonnes).toFixed(3))
        : null,
      underperforming_assets: underperformers.map(s => ({
        asset_tag: s.asset_tag,
        shift: s.shift,
        utilization_percent: s.utilization_percent,
        idle_hours: s.idle_hours,
      })),
    };

    // ── MINE HEALTH SCORE (composite 0–100) ──────────────────────────────────
    // Safety (40%) + Maintenance (35%) + Fleet (25%)
    const safetyScore = Math.max(0, 100
      - (criticalOpen.length * 20)
      - (openIncidents.filter(i => i.severity !== "critical").length * 8)
      - (sensorsInAlert.length * 10)
      - (activeZones.length * 5));

    const maintScore = Math.max(0, 100
      - (openRecs.filter(r => r.priority === "critical").length * 20)
      - (openRecs.filter(r => r.priority === "high").length * 10)
      - (mineAssets.filter(a => (a.next_service_due_hours - a.operating_hours) < 0).length * 15));

    const fleetScore = avgUtil !== null ? Math.min(100, avgUtil * 1.1) : 75;

    const healthScore = Math.round((safetyScore * 0.40) + (maintScore * 0.35) + (fleetScore * 0.25));
    const healthRating = healthScore >= 80 ? "GOOD"
      : healthScore >= 60 ? "ATTENTION NEEDED"
      : "CRITICAL — IMMEDIATE ACTION REQUIRED";

    return {
      mine_id: mine.id,
      mine_name: mine.name,
      county: mine.county,
      mineral_type: mine.mineral_type,
      status: mine.status,
      as_of: db.ts(),
      mine_health_score: healthScore,
      mine_health_rating: healthRating,
      score_breakdown: {
        safety_score: Math.round(safetyScore),
        maintenance_score: Math.round(maintScore),
        fleet_score: Math.round(fleetScore),
        weights: "Safety 40% + Maintenance 35% + Fleet 25%",
      },
      pillar_1_predictive_maintenance: maintenance_pillar,
      pillar_2_safety_hazard_alerts: safety_pillar,
      pillar_3_fleet_operational_efficiency: fleet_pillar,
    };
  });

  // Platform-level summary across all mines
  const platformHealthScore = dashboards.length > 0
    ? Math.round(dashboards.reduce((sum, d) => sum + d.mine_health_score, 0) / dashboards.length)
    : 0;

  res.json({
    dashboard: "Integrated Mine Health Dashboard",
    description: "Unified view of predictive maintenance, safety & hazard alerts, and fleet operational efficiency — the balance every mine manager needs.",
    as_of: db.ts(),
    platform_health_score: platformHealthScore,
    platform_health_rating: platformHealthScore >= 80 ? "GOOD"
      : platformHealthScore >= 60 ? "ATTENTION NEEDED"
      : "CRITICAL",
    mines_assessed: dashboards.length,
    mines: dashboards,
  });
});

module.exports = router;
