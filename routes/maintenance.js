const express = require("express");
const router = express.Router();
const { maintenanceRecords, maintenanceRecommendations, assets } = require("../store");

router.get("/", (req, res) => {
  const mineId = req.query.mine_id;
  const result = mineId 
    ? maintenanceRecords.filter(r => r.mine_id === mineId) 
    : maintenanceRecords;
  res.json(result);
});

router.post("/", (req, res) => {
  const { asset_id, mine_id, type, description, priority, scheduled_at, triggered_by, assigned_to } = req.body;
  
  if (!asset_id || !mine_id || !type || !description) {
    return res.status(400).json({ error: "asset_id, mine_id, type, and description required" });
  }
  
  const record = {
    id: `maint-${Date.now()}`.slice(-8),
    asset_id,
    mine_id,
    type,
    work_order: `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`,
    description,
    status: "scheduled",
    priority: priority || "medium",
    triggered_by: triggered_by || "manual",
    assigned_to: assigned_to || "",
    scheduled_at: scheduled_at || new Date().toISOString(),
    completed_at: null,
    downtime_hours: null,
    parts_used: [],
    cost_ksh: null,
  };
  
  maintenanceRecords.push(record);
  res.status(201).json({ record });
});

router.patch("/:id/complete", (req, res) => {
  const record = maintenanceRecords.find(r => r.id === req.params.id);
  
  if (!record) return res.status(404).json({ error: "Maintenance record not found" });
  
  record.status = "completed";
  record.completed_at = new Date().toISOString();
  record.downtime_hours = req.body.downtime_hours || 0;
  record.parts_used = req.body.parts_used || [];
  record.cost_ksh = req.body.cost_ksh || 0;
  
  res.json({ record });
});

router.get("/schedule", (req, res) => {
  const mineId = req.query.mine_id;
  
  const filteredAssets = mineId 
    ? assets.filter(a => a.mine_id === mineId) 
    : assets;
  
  const openRecs = maintenanceRecommendations
    .filter(r => r.status === "open")
    .sort((a, b) => b.estimated_failure_risk_percent - a.estimated_failure_risk_percent);
  
  const schedule = filteredAssets.map(asset => {
    const recs = openRecs.filter(r => r.asset_id === asset.id);
    const hrs = asset.next_service_due_hours - asset.operating_hours;
    const serviceUrgency = hrs < 0 ? "overdue" : hrs < 200 ? "imminent" : "upcoming";
    
    return {
      asset_id: asset.id,
      asset_tag: asset.asset_tag,
      name: asset.name,
      category: asset.category,
      operating_hours: asset.operating_hours,
      next_service_due_hours: asset.next_service_due_hours,
      hours_to_service: hrs,
      service_urgency,
      open_recommendations: recs.length,
    };
  });
  
  const overdue = schedule.filter(a => a.service_urgency === "overdue").length;
  const imminent = schedule.filter(a => a.service_urgency === "imminent").length;
  const upcoming = schedule.filter(a => a.service_urgency === "upcoming").length;
  
  res.json({
    schedule,
    summary: {
      overdue,
      imminent_within_100_hours: schedule.filter(a => a.hours_to_service < 100 && a.hours_to_service >= 0).length,
      upcoming_within_300_hours: schedule.filter(a => a.hours_to_service >= 100 && a.hours_to_service < 300).length,
    },
  });
});

router.get("/recommendations", (req, res) => {
  const mineId = req.query.mine_id;
  let result = [...maintenanceRecommendations];
  
  if (mineId) {
    result = result.filter(r => r.mine_id === mineId);
  }
  
  const costAnalysis = {
    total_preventive_cost_ksh: result.reduce((sum, r) => sum + (r.preventive_cost_ksh || 0), 0),
    total_avoided_failure_cost_ksh: result.reduce((sum, r) => sum + (r.estimated_repair_cost_if_unaddressed_ksh || 0), 0),
    estimated_roi_multiplier: Math.round((result.reduce((sum, r) => sum + (r.estimated_repair_cost_if_unaddressed_ksh || 0), 0) / Math.max(1, result.reduce((sum, r) => sum + (r.preventive_cost_ksh || 0), 0))) * 10) / 10,
  };
  
  res.json({
    recommendations: result,
    count: result.length,
    cost_analysis: costAnalysis,
  });
});

router.post("/recommendations/generate", (req, res) => {
  const { asset_id, mine_id } = req.body;
  
  if (!asset_id) return res.status(400).json({ error: "asset_id required" });
  
  const asset = assets.find(a => a.id === asset_id);
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  
  const recommendation = {
    id: `rec-${Date.now()}`.slice(-8),
    asset_id,
    mine_id: mine_id || asset.mine_id,
    generated_at: new Date().toISOString(),
    model: "PredictiveMaint-KE-v2.1",
    trigger: "manual_request",
    finding: `Predictive analysis for ${asset.name}`,
    recommended_action: "Review asset condition and schedule appropriate maintenance",
    priority: "medium",
    estimated_failure_risk_percent: 15,
    estimated_downtime_if_unaddressed_hours: 24,
    estimated_repair_cost_if_unaddressed_ksh: 100000,
    preventive_cost_ksh: 25000,
    status: "open",
  };
  
  maintenanceRecommendations.push(recommendation);
  res.status(201).json({ recommendation });
});

router.patch("/recommendations/:id/acknowledge", (req, res) => {
  const rec = maintenanceRecommendations.find(r => r.id === req.params.id);
  
  if (!rec) return res.status(404).json({ error: "Recommendation not found" });
  
  rec.status = "acknowledged";
  rec.acknowledged_at = new Date().toISOString();
  
  res.json({ recommendation: rec });
});

module.exports = router;