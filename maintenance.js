const router = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../data/store");

// ── MAINTENANCE RECORDS ───────────────────────────────────────────────────────

// GET /maintenance — list maintenance records with filters
router.get("/", (req, res) => {
  const { mine_id, asset_id, status, type } = req.query;
  let result = db.maintenanceRecords.filter(m => req.user.mine_ids.includes(m.mine_id));

  if (mine_id)  result = result.filter(m => m.mine_id === mine_id);
  if (asset_id) result = result.filter(m => m.asset_id === asset_id);
  if (status)   result = result.filter(m => m.status === status);
  if (type)     result = result.filter(m => m.type === type);

  res.json({ count: result.length, records: result.sort((a, b) =>
    new Date(b.scheduled_at) - new Date(a.scheduled_at))
  });
});

// POST /maintenance — create a new work order
router.post("/", (req, res) => {
  const { asset_id, mine_id, type, description, priority, assigned_to, scheduled_at } = req.body;
  if (!asset_id || !mine_id || !description) {
    return res.status(400).json({ error: "asset_id, mine_id, and description are required" });
  }

  const asset = db.assets.find(a => a.id === asset_id);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const record = {
    id: uuidv4(),
    asset_id, mine_id,
    type: type || "scheduled",
    work_order: `WO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    description,
    status: "planned",
    priority: priority || "medium",
    triggered_by: req.body.triggered_by || "manual",
    assigned_to: assigned_to || "Unassigned",
    scheduled_at: scheduled_at || db.ts(),
    completed_at: null,
    downtime_hours: null,
    parts_used: [],
    cost_ksh: null,
    created_at: db.ts(),
  };
  db.maintenanceRecords.push(record);
  res.status(201).json(record);
});

// PATCH /maintenance/:id/complete — mark a work order complete
router.patch("/:id/complete", (req, res) => {
  const record = db.maintenanceRecords.find(m => m.id === req.params.id);
  if (!record) return res.status(404).json({ error: "Maintenance record not found" });

  record.status = "completed";
  record.completed_at = db.ts();
  record.downtime_hours = req.body.downtime_hours || null;
  record.parts_used = req.body.parts_used || [];
  record.cost_ksh = req.body.cost_ksh || null;
  record.technician_notes = req.body.technician_notes || null;

  // Update asset's last_service_at
  const asset = db.assets.find(a => a.id === record.asset_id);
  if (asset) {
    asset.last_service_at = record.completed_at;
    asset.next_service_due_hours = asset.operating_hours + asset.maintenance_interval_hours;
    asset.status = "operational";
  }

  res.json({ message: "Work order completed", record });
});

// ── PREDICTIVE RECOMMENDATIONS ────────────────────────────────────────────────

// GET /maintenance/recommendations — list AI-generated proactive alerts
router.get("/recommendations", (req, res) => {
  const { mine_id, asset_id, priority, status } = req.query;
  let result = db.maintenanceRecommendations.filter(r =>
    req.user.mine_ids.includes(r.mine_id)
  );

  if (mine_id)  result = result.filter(r => r.mine_id === mine_id);
  if (asset_id) result = result.filter(r => r.asset_id === asset_id);
  if (priority) result = result.filter(r => r.priority === priority);
  if (status)   result = result.filter(r => r.status === status);

  // Sort by failure risk descending
  result = result.sort((a, b) =>
    b.estimated_failure_risk_percent - a.estimated_failure_risk_percent
  );

  const totalPreventiveCost = result
    .filter(r => r.status === "open")
    .reduce((sum, r) => sum + (r.preventive_cost_ksh || 0), 0);
  const totalAvoidedCost = result
    .filter(r => r.status === "open")
    .reduce((sum, r) => sum + (r.estimated_repair_cost_if_unaddressed_ksh || 0), 0);

  res.json({
    count: result.length,
    cost_analysis: {
      total_preventive_cost_ksh: totalPreventiveCost,
      total_avoided_failure_cost_ksh: totalAvoidedCost,
      estimated_roi_multiplier: totalPreventiveCost > 0
        ? parseFloat((totalAvoidedCost / totalPreventiveCost).toFixed(1))
        : null,
    },
    recommendations: result,
  });
});

// POST /maintenance/recommendations/generate — run AI prediction for an asset
router.post("/recommendations/generate", (req, res) => {
  const { asset_id } = req.body;
  if (!asset_id) return res.status(400).json({ error: "asset_id is required" });

  const asset = db.assets.find(a => a.id === asset_id);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  const hoursToService = asset.next_service_due_hours - asset.operating_hours;
  const overdue = hoursToService < 0;
  const urgency = overdue ? "critical" : hoursToService < 100 ? "high" : hoursToService < 250 ? "medium" : "low";
  const failureRisk = overdue
    ? randomBetween(35, 65, 0)
    : parseFloat(Math.max(2, (500 - hoursToService) / 10).toFixed(0));

  const rec = {
    id: uuidv4(),
    asset_id,
    mine_id: asset.mine_id,
    generated_at: db.ts(),
    model: "PredictiveMaint-KE-v2.1",
    trigger: overdue ? "service_overdue" : "operating_hours_threshold",
    finding: overdue
      ? `${asset.name} is ${Math.abs(hoursToService)} hours past its ${asset.maintenance_interval_hours}-hour service interval. Failure risk elevated.`
      : `${asset.name} is ${hoursToService} hours from its next scheduled service. Current operating hours: ${asset.operating_hours}.`,
    recommended_action: overdue
      ? `IMMEDIATE: Schedule corrective maintenance. Remove from service if safe operation cannot be confirmed.`
      : `Schedule ${asset.maintenance_interval_hours}-hour service within the next ${Math.ceil(hoursToService / 8)} working shifts.`,
    priority: urgency,
    estimated_failure_risk_percent: failureRisk,
    estimated_downtime_if_unaddressed_hours: overdue ? 72 : 24,
    estimated_repair_cost_if_unaddressed_ksh: overdue ? 380000 : 120000,
    preventive_cost_ksh: 45000,
    status: "open",
  };

  db.maintenanceRecommendations.push(rec);
  res.status(201).json({ message: "Predictive recommendation generated", recommendation: rec });
});

// PATCH /maintenance/recommendations/:id/acknowledge
router.patch("/recommendations/:id/acknowledge", (req, res) => {
  const rec = db.maintenanceRecommendations.find(r => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: "Recommendation not found" });
  rec.status = "acknowledged";
  rec.acknowledged_by = req.body.acknowledged_by || req.user.role;
  rec.acknowledged_at = db.ts();
  res.json({ message: "Recommendation acknowledged", recommendation: rec });
});

// ── SCHEDULE / CALENDAR VIEW ──────────────────────────────────────────────────

// GET /maintenance/schedule — upcoming maintenance for all accessible mines
router.get("/schedule", (req, res) => {
  const accessibleAssets = db.assets.filter(a => req.user.mine_ids.includes(a.mine_id));

  const schedule = accessibleAssets.map(asset => {
    const hoursToService = asset.next_service_due_hours - asset.operating_hours;
    const openRecs = db.maintenanceRecommendations.filter(
      r => r.asset_id === asset.id && r.status === "open"
    );
    const inProgress = db.maintenanceRecords.filter(
      m => m.asset_id === asset.id && m.status === "in_progress"
    );

    return {
      asset_id: asset.id,
      asset_tag: asset.asset_tag,
      name: asset.name,
      mine_id: asset.mine_id,
      category: asset.category,
      criticality: asset.criticality,
      status: asset.status,
      hours_to_service: hoursToService,
      service_urgency: hoursToService < 0 ? "overdue" : hoursToService < 100 ? "imminent" : hoursToService < 300 ? "upcoming" : "scheduled",
      open_recommendations: openRecs.length,
      work_in_progress: inProgress.length > 0,
    };
  }).sort((a, b) => a.hours_to_service - b.hours_to_service);

  const overdue   = schedule.filter(s => s.service_urgency === "overdue");
  const imminent  = schedule.filter(s => s.service_urgency === "imminent");
  const upcoming  = schedule.filter(s => s.service_urgency === "upcoming");

  res.json({
    as_of: db.ts(),
    summary: {
      total_assets: schedule.length,
      overdue: overdue.length,
      imminent_within_100_hours: imminent.length,
      upcoming_within_300_hours: upcoming.length,
    },
    schedule,
  });
});

module.exports = router;
