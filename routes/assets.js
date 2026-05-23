const express = require("express");
const router = express.Router();
const { assets, maintenanceRecords, maintenanceRecommendations } = require("../store");

router.get("/", (req, res) => {
  const mineId = req.query.mine_id;
  const result = mineId 
    ? assets.filter(a => a.mine_id === mineId) 
    : assets;
  
  const assetsWithFlags = result.map(a => {
    const hrs = a.next_service_due_hours - a.operating_hours;
    const flag = hrs < 0 ? "🔴 OVERDUE" : hrs < 200 ? "🟡 IMMINENT" : "🟢";
    return { ...a, service_urgency_flag: flag };
  });
  
  res.json({ assets: assetsWithFlags, count: assetsWithFlags.length });
});

router.get("/:id", (req, res) => {
  const asset = assets.find(a => a.id === req.params.id);
  
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  
  const records = maintenanceRecords.filter(r => r.asset_id === asset.id);
  const recommendations = maintenanceRecommendations.filter(r => r.asset_id === asset.id);
  
  const hrs = asset.next_service_due_hours - asset.operating_hours;
  const serviceUrgency = hrs < 0 ? "overdue" : hrs < 200 ? "imminent" : "upcoming";
  
  res.json({
    ...asset,
    hours_to_next_service: hrs,
    service_urgency: serviceUrgency,
    maintenance_records: records,
    recent_recommendations: recommendations.filter(r => r.status !== "acknowledged").slice(0, 3),
    open_recommendations: recommendations.filter(r => r.status === "open").length,
    last_maintenance: records.filter(r => r.status === "completed").slice(0, 1)[0],
  });
});

router.get("/:id/telemetry", (req, res) => {
  const asset = assets.find(a => a.id === req.params.id);
  
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  
  res.json({
    asset_id: asset.id,
    operating_hours: asset.operating_hours,
    next_service_due_hours: asset.next_service_due_hours,
    status: asset.status,
    last_updated: new Date().toISOString(),
  });
});

router.post("/", (req, res) => {
  const { mine_id, asset_tag, name, category, manufacturer, model, serial_number } = req.body;
  
  if (!mine_id || !asset_tag || !name || !category) {
    return res.status(400).json({ error: "mine_id, asset_tag, name, and category required" });
  }
  
  const asset = {
    id: `asset-${Date.now()}`.slice(-8),
    mine_id,
    asset_tag,
    name,
    category,
    manufacturer: manufacturer || "",
    model: model || "",
    serial_number: serial_number || "",
    commissioned_at: new Date().toISOString().split("T")[0],
    status: "operational",
    operating_hours: 0,
    maintenance_interval_hours: 500,
    criticality: "medium",
  };
  
  assets.push(asset);
  res.status(201).json(asset);
});

module.exports = router;

//