const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

// Database connections
const {
  plantcare,
  collectionofficer,
  marketPlace,
  admin,
} = require("./startup/database");

// Route import
const addCropDetails = require("./routes/collection/unregistered-crop-farmer-routes");
const farmerRoutes = require("./routes/collection/farmer-routes");
const complainRoutes = require("./routes/common/complains-routes");
const priceUpdatesRoutes = require("./routes/collection/price-routes");
const managerRoutes = require("./routes/common/manager-routes");
const heathRoutes = require("./routes/common/heath-routes");
const distribution = require("./routes/distribution/distribution-routes");
const distributionManager = require("./routes/distribution/distibution-manager-routes");
const pickupRoute = require("./routes/common/pickup-routes");
const pensionRoute = require("./routes/collection/pension-routes");
const collectionOfficerRoutes = require("./routes/common/user-routes");
const searchRoutes = require("./routes/common/search-routes");
const targetRoutes = require("./routes/collection/target-routes");
const emailRoutes = require("./routes/common/email-routes");
const packingRoute = require("./routes/distribution/packing-route");
const purchaseShortageRoute = require("./routes/distribution/purchase-shortage-route");
const webRoute = require("./routes/web/web-route");
const farmerEp = require("./end-point/collection/farmer-ep");

// Initialize Express app and HTTP server with Socket.IO
const mainApp = express();
const server = http.createServer(mainApp);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("⚡ Client connected to Socket.IO:", socket.id);

  socket.on("join_row", (rowId) => {
    socket.join(`row_${rowId}`);
    console.log(`Socket ${socket.id} joined room row_${rowId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected from Socket.IO:", socket.id);
  });
});

// Attach io instance to express app
mainApp.set("io", io);

// CORS and body parser configuration
[mainApp].forEach((app) => {
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );
  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
});

// Database connection test function
const testConnection = (pool, name) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(
          `❌ Error connecting to the ${name} database:`,
          err.message
        );
        reject(err);
      } else {
        console.log(`✅ Successfully connected to the MySQL database: ${name}`);
        connection.release();
        resolve();
      }
    });
  });
};

// Check all database connections
const checkConnections = async () => {
  console.log("🔄 Testing database connections...\n");
  try {
    await testConnection(plantcare, "PlantCare");
    await testConnection(collectionofficer, "CollectionOfficer");
    await testConnection(marketPlace, "MarketPlace");
    await testConnection(admin, "Admin");
    console.log("\n🎉 All databases connected successfully!\n");
  } catch (error) {
    console.error("\n⚠️ Some databases failed to connect. Check logs above.\n");
  }
};

// Start the connection checks
checkConnections();

// Base path configuration
const basePathMain = "/agro-api/collection-api";

// Route registrations
mainApp.use(`${basePathMain}`, heathRoutes);
mainApp.use(`${basePathMain}/api/collection-officer`, collectionOfficerRoutes);
mainApp.use(`${basePathMain}/api/farmer`, farmerRoutes);
mainApp.use(`${basePathMain}/api/unregisteredfarmercrop`, addCropDetails);
mainApp.use(`${basePathMain}/api/auth`, searchRoutes);
mainApp.use(`${basePathMain}/api/complain`, complainRoutes);
mainApp.use(`${basePathMain}/api/auth`, priceUpdatesRoutes);
mainApp.use(`${basePathMain}/api/collection-manager`, managerRoutes);
mainApp.use(`${basePathMain}/api/target`, targetRoutes);
mainApp.use(`${basePathMain}/api/distribution`, distribution);
mainApp.use(`${basePathMain}/api/distribution-manager`, distributionManager);
mainApp.use(`${basePathMain}/api/pickup`, pickupRoute);
mainApp.use(`${basePathMain}/api/pension`, pensionRoute);
mainApp.use(`${basePathMain}/api/email`, emailRoutes);
mainApp.use(`${basePathMain}/api/packing`, packingRoute);
mainApp.use(`${basePathMain}/api/purchase-shortage`, purchaseShortageRoute);
mainApp.use(`${basePathMain}/api/web`, webRoute);
mainApp.use(`/api/web`, webRoute);

// Cron job for SMS sending
cron.schedule(
  "16 18 * * *",
  async () => {
    console.log("Running SMS sending task at 18:00");
    await farmerEp.sendSMSToFarmers();
    console.log("SMS sending task completed");
  },
  {
    scheduled: true,
    timezone: "Asia/Colombo",
  }
);

// Attach io and mainApp to server instance
server.io = io;
server.mainApp = mainApp;

// Only listen locally, Vercel will export the handler and call listen internally
const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
  server.listen(PORT, () =>
    console.log(
      `🚀 Main API server running with Socket.IO on port ${PORT} with base path ${basePathMain}`
    )
  );
}

module.exports = server;