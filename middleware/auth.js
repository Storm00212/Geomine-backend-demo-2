const demoKeys = {
  operator: "demo-operator-key-001",
  admin: "demo-admin-key-999",
  viewer: "demo-readonly-key-002",
};

function auth(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  
  if (!apiKey) {
    return res.status(401).json({ error: "API key required. Provide X-API-Key header." });
  }
  
  const validKeys = Object.values(demoKeys);
  if (!validKeys.includes(apiKey)) {
    return res.status(403).json({ error: "Invalid API key." });
  }
  
  req.apiKey = apiKey;
  next();
}

module.exports = { auth, demoKeys };