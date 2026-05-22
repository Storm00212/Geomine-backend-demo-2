const express = require("express");
const router = express.Router();
const { fleetSessions, hazardZones, assets } = require("../store");

router.get("/utilization", (req, res) => {
  const mineId = req.query.mine_id;
  const date = req.query.date;
  
  let result = [...fleetSessions];
  
  if (mineId) result = result.filter(s => s.mine_id === mineId);
  if (date) result = result.filter(s => s.date === date);
  
  if (result.length === 0) {
    return res.json({
      fleet_summary: {
        sessions_included: 0,
        avg_utilization_percent: 0,
        total_operating_hours: 0,
        total_idle_hours: 0,
        idle_to_operating_ratio: 0,
        total_fuel_consumed_litres: 0,
        total_fuel_cost_ksh: 0,
        fuel_efficiency_litres_per_tonne: 0,
        total_tonnes_moved: 0,
      },
      sessions: [],
    });
  }
  
  const totalOperating = result.reduce((sum, s) => sum + s.operating_hours, 0);
  const totalIdle = result.reduce((sum, s) => sum + s.idle_hours, 0);
  const totalFuel = result.reduce((sum, s) => sum + (s.fuel_consumed_litres || 0), 0);
  const totalCost = result.reduce((sum, s) => sum + (s.fuel_cost_ksh || 0), 0);
  const totalTonnes = result.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
  const totalUtil = result.reduce((sum, s) => sum + s.utilization_percent, 0);
  
  res.json({
    fleet_summary: {
      sessions_included: result.length,
      avg_utilization_percent: Math.round(totalUtil / result.length),
      total_operating_hours: totalOperating,
      total_idle_hours: totalIdle,
      idle_to_operating_ratio: totalOperating > 0 ? Math.round((totalIdle / totalOperating) * 100) / 100 : 0,
      total_fuel_consumed_litres: totalFuel,
      total_fuel_cost_ksh: totalCost,
      fuel_efficiency_litres_per_tonne: totalTonnes > 0 ? Math.round((totalFuel / totalTonnes) * 10) / 10 : 0,
      total_tonnes_moved: totalTonnes,
    },
    sessions: result,
  });
});

router.post("/utilization", (req, res) => {
  const { asset_id, mine_id, shift, date, operating_hours, idle_hours, downtime_hours, fuel_consumed_litres, fuel_cost_ksh, loads_completed, tonnes_moved, avg_cycle_time_min, avg_speed_kmh, gps_distance_km, operator } = req.body;
  
  if (!asset_id || !mine_id || !shift || !date) {
    return res.status(400).json({ error: "asset_id, mine_id, shift, and date required" });
  }
  
  const total = (operating_hours || 0) + (idle_hours || 0) + (downtime_hours || 0);
  const utilization = total > 0 ? ((operating_hours || 0) / total) * 100 : 0;
  
  const asset = assets.find(a => a.id === asset_id);
  
  const session = {
    id: `fs-${Date.now()}`.slice(-8),
    asset_id,
    mine_id,
    asset_tag: asset?.asset_tag || "",
    shift,
    date,
    operating_hours: operating_hours || 0,
    idle_hours: idle_hours || 0,
    downtime_hours: downtime_hours || 0,
    utilization_percent: Math.round(utilization * 10) / 10,
    fuel_consumed_litres: fuel_consumed_litres || 0,
    fuel_cost_ksh: fuel_cost_ksh || 0,
    loads_completed: loads_completed,
    tonnes_moved: tonnes_moved,
    avg_cycle_time_min: avg_cycle_time_min,
    avg_speed_kmh: avg_speed_kmh,
    gps_distance_km: gps_distance_km,
    operator: operator || "",
  };
  
  fleetSessions.push(session);
  res.status(201).json(session);
});

router.get("/productivity", (req, res) => {
  const mineId = req.query.mine_id;
  
  const assetsList = assets
    .filter(a => !mineId || a.mine_id === mineId)
    .map(asset => {
      const sessions = fleetSessions.filter(s => s.asset_id === asset.id);
      const totalHours = sessions.reduce((sum, s) => sum + s.operating_hours, 0);
      const totalTonnes = sessions.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
      const totalIdle = sessions.reduce((sum, s) => sum + s.idle_hours, 0);
      
      const avgUtil = sessions.length > 0 ? sessions.reduce((sum, s) => sum + s.utilization_percent, 0) / sessions.length : 0;
      const fuelPerTonne = totalTonnes > 0 ? sessions.reduce((sum, s) => sum + (s.fuel_consumed_litres || 0), 0) / totalTonnes : 0;
      const idleRatio = totalHours > 0 ? totalIdle / totalHours : 0;
      
      let efficiencyFlag = "high_performer";
      let improvementOpportunity = null;
      
      if (avgUtil < 50 || idleRatio > 0.4) {
        efficiencyFlag = "underperforming";
        improvementOpportunity = "High idle time or low utilization — check operator breaks, haul road congestion, or shift scheduling";
      } else if (avgUtil < 70 || idleRatio > 0.25) {
        efficiencyFlag = "adequate";
      }
      
      return {
        asset_id: asset.id,
        asset_tag: asset.asset_tag,
        avg_utilization_percent: Math.round(avgUtil),
        efficiency_flag: efficiencyFlag,
        idle_ratio: Math.round(idleRatio * 100) / 100,
        fuel_per_tonne: Math.round(fuelPerTonne * 10) / 10,
        total_tonnes_moved: totalTonnes,
        improvement_opportunity: improvementOpportunity,
      };
    });
  
  res.json({
    fleet_health: assetsList.filter(a => a.efficiency_flag === "high_performer").length === assetsList.length ? "healthy" : "needs_attention",
    assets_underperforming: assetsList.filter(a => a.efficiency_flag === "underperforming").length,
    productivity_by_asset: assetsList,
  });
});

router.get("/fuel-analysis", (req, res) => {
  const mineId = req.query.mine_id;
  
  const sessions = mineId 
    ? fleetSessions.filter(s => s.mine_id === mineId) 
    : fleetSessions;
  
  const totalFuel = sessions.reduce((sum, s) => sum + (s.fuel_consumed_litres || 0), 0);
  const totalCost = sessions.reduce((sum, s) => sum + (s.fuel_cost_ksh || 0), 0);
  const totalTonnes = sessions.reduce((sum, s) => sum + (s.tonnes_moved || 0), 0);
  const totalHours = sessions.reduce((sum, s) => sum + s.operating_hours, 0);
  
  res.json({
    summary: {
      total_fuel_consumed_litres: totalFuel,
      total_fuel_cost_ksh: totalCost,
      avg_fuel_price_per_litre_ksh: totalFuel > 0 ? Math.round((totalCost / totalFuel) * 100) / 100 : 0,
      fleet_fuel_per_tonne: totalTonnes > 0 ? Math.round((totalFuel / totalTonnes) * 10) / 10 : 0,
      fleet_fuel_per_hour: totalHours > 0 ? Math.round((totalFuel / totalHours) * 10) / 10 : 0,
    },
    by_asset: sessions.reduce((acc, s) => {
      const existing = acc.find(a => a.asset_tag === s.asset_tag);
      if (existing) {
        existing.total_fuel_litres += s.fuel_consumed_litres || 0;
      } else {
        acc.push({
          asset_tag: s.asset_tag,
          total_fuel_litres: s.fuel_consumed_litres || 0,
          share_of_fleet_fuel_percent: 0,
          fuel_per_tonne: s.tonnes_moved ? Math.round(((s.fuel_consumed_litres || 0) / s.tonnes_moved) * 10) / 10 : 0,
        });
      }
      return acc;
    }, []).map(a => ({ ...a, share_of_fleet_fuel_percent: Math.round((a.total_fuel_litres / Math.max(1, totalFuel)) * 100) })),
  });
});

router.get("/idle-alerts", (req, res) => {
  const mineId = req.query.mine_id;
  
  const sessions = mineId 
    ? fleetSessions.filter(s => s.mine_id === mineId) 
    : fleetSessions;
  
  const idleThreshold = 0.25;
  
  const alerts = sessions.filter(s => {
    const total = s.operating_hours + s.idle_hours + s.downtime_hours;
    return total > 0 && (s.idle_hours / total) > idleThreshold;
  }).map(s => {
    const total = s.operating_hours + s.idle_hours + s.downtime_hours;
    const idlePercent = Math.round((s.idle_hours / total) * 100);
    
    return {
      asset_tag: s.asset_tag,
      shift: s.shift,
      operator: s.operator || "N/A",
      idle_hours: s.idle_hours,
      idle_percent: idlePercent,
      threshold_percent: 25,
      estimated_wasted_fuel_litres: Math.round(s.fuel_consumed_litres * (idlePercent / 100) * 0.8),
      recommended_action: "Review shift scheduling and haul road congestion",
    };
  });
  
  res.json({
    idle_threshold_percent: 25,
    alerts_raised: alerts.length,
    idle_alerts: alerts,
  });
});

router.get("/hazard-zones", (req, res) => {
  const mineId = req.query.mine_id;
  const result = mineId 
    ? hazardZones.filter(h => h.mine_id === mineId) 
    : hazardZones;
  res.json({
    active_zones: result.filter(h => h.status === "active").length,
    hazard_zones: result,
  });
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
  res.status(201).json({ zone });
});

router.patch("/hazard-zones/:id/clear", (req, res) => {
  const zone = hazardZones.find(h => h.id === req.params.id);
  
  if (!zone) return res.status(404).json({ error: "Hazard zone not found" });
  
  zone.status = "cleared";
  zone.active_until = new Date().toISOString();
  
  res.json({ zone });
});

module.exports = router;