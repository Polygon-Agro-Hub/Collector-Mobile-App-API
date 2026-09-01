const express = require("express");
const router = express.Router();

// Database connections
const {
  plantcare,
  collectionofficer,
  admin,
} = require("../../startup/database");

// Middleware for CORS
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Methods", "GET");
  next();
});

// Basic health check endpoint
router.get("/health", (req, res) => {
  const data = {
    uptime: process.uptime(),
    message: "OK",
    date: new Date(),
    environment: process.env.NODE_ENV || "development",
    service: "Collection API",
    status: "healthy"
  };

  res.status(200).send(data);
});

// Detailed health check with database connections
router.get("/health/details", async (req, res) => {
  try {
    // Check all database connections
    const dbChecks = await Promise.allSettled([
      testConnection(plantcare, "PlantCare"),
      testConnection(collectionofficer, "CollectionOfficer"),
      testConnection(admin, "Admin")
    ]);

    const databases = {
      plantcare: dbChecks[0].status === 'fulfilled' ? 'connected' : 'disconnected',
      collectionofficer: dbChecks[1].status === 'fulfilled' ? 'connected' : 'disconnected',
      admin: dbChecks[2].status === 'fulfilled' ? 'connected' : 'disconnected'
    };

    const allConnected = Object.values(databases).every(status => status === 'connected');

    const data = {
      uptime: process.uptime(),
      message: allConnected ? "OK" : "Degraded",
      date: new Date(),
      environment: process.env.NODE_ENV || "development",
      service: "Collection API",
      status: allConnected ? "healthy" : "degraded",
      databases: databases,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };

    const statusCode = allConnected ? 200 : 207;
    res.status(statusCode).send(data);
  } catch (error) {
    res.status(500).send({
      uptime: process.uptime(),
      message: "Error checking health",
      date: new Date(),
      environment: process.env.NODE_ENV || "development",
      service: "Collection API",
      status: "unhealthy",
      error: error.message
    });
  }
});

// Database connection test helper
const testConnection = (pool, name) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        reject(err);
      } else {
        connection.release();
        resolve();
      }
    });
  });
};

// Readiness probe endpoint (for Kubernetes)
router.get("/health/ready", (req, res) => {
  res.status(200).send({
    status: "ready",
    timestamp: new Date()
  });
});

// Liveness probe endpoint (for Kubernetes)
router.get("/health/live", (req, res) => {
  res.status(200).send({
    status: "alive",
    timestamp: new Date()
  });
});

// Home page endpoint
router.get("/home", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Collection API</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #333; }
          .endpoints { background: #f4f4f4; padding: 20px; border-radius: 5px; }
          code { background: #e0e0e0; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>Welcome to Collection API</h1>
        <div class="endpoints">
          <h3>Available Health Endpoints:</h3>
          <ul>
            <li><code>/health</code> - Basic health check</li>
            <li><code>/health/details</code> - Detailed health check with database status</li>
            <li><code>/health/ready</code> - Readiness probe</li>
            <li><code>/health/live</code> - Liveness probe</li>
            <li><code>/home</code> - This page</li>
          </ul>
        </div>
        <p>Server uptime: ${Math.floor(process.uptime() / 60)} minutes</p>
        <p>Current time: ${new Date().toLocaleString()}</p>
      </body>
    </html>
  `);
});

// Version endpoint
router.get("/version", (req, res) => {
  res.status(200).send({
    version: "1.0.0",
    name: "Collection API",
    description: "API for collection management system"
  });
});

module.exports = router;