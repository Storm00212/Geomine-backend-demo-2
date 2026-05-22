const express = require("express");
const router = express.Router();
const { mines, assets, sensors, fleetSessions } = require("../store");

router.get("/", (req, res) => {
  res.json(mines);
});

router.get("/:id", (req, res) => {
  const mine = mines.find(m => m.id === req.params.id);
  if (!mine) return res.status(404).json({ error: "Mine not found" });
  
  const mineAssets = assets.filter(a => a.mine_id === mine.id);
  const mineSensors = sensors.filter(s => s.mine_id === mine.id);
  const sessions = fleetSessions.filter(s => s.mine_id === mine.id);
  
  res.json({
    ...mine,
    assets: mineAssets,
    sensors: mineSensors,
    fleet_sessions: sessions,
  });
});

module.exports = router;