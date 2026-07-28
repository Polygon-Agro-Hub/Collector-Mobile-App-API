const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const bodyParser = require("body-parser");
require("dotenv").config();

// Database connections
const {
  plantcare,
  collectionofficer,
  marketPlace,
  admin,
} = require("./startup/database");

// Route import
const addCropDetails = require("./routes/unregistered-crop-farmer-routes");
const farmerRoutes = require("./routes/farmer-routes");
const getUserdata = require("./routes/qr-routes");
const complainRoutes = require("./routes/complains-routes");
const priceUpdatesRoutes = require("./routes/price-routes");
const managerRoutes = require("./routes/manager-routes");
const collectionrequest = require("./routes/collection-routes");
const heathRoutes = require("./routes/heath-routes");
const distribution = require("./routes/distribution-routes");
const distributionManager = require("./routes/distibution-manager-routes");
const pickupRoute = require("./routes/pickup-routes");
const pensionRoute = require("./routes/pension-routes");
const collectionOfficerRoutes = require("./routes/user-routes");
const searchRoutes = require("./routes/search-routes");
const targetRoutes = require("./routes/target-routes");
const emailRoutes = require("./routes/email-routes");
const packingRoute = require("./routes/packing-route");
const farmerEp = require("./end-point/farmer-ep");

const mainApp = express();

// CORS and body parser configuration
[mainApp].forEach((app) => {
  app.use(
    cors({
      origin: "http://localhost:8081",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );
  app.options(
    "*",
    cors({
      origin: "http://localhost:8081",
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
mainApp.use(`${basePathMain}/api/getUserData`, getUserdata);
mainApp.use(`${basePathMain}/api/auth`, searchRoutes);
mainApp.use(`${basePathMain}/api/complain`, complainRoutes);
mainApp.use(`${basePathMain}/api/auth`, priceUpdatesRoutes);
mainApp.use(`${basePathMain}/api/collection-manager`, managerRoutes);
mainApp.use(`${basePathMain}/api/target`, targetRoutes);
mainApp.use(`${basePathMain}/api/collectionrequest`, collectionrequest);
mainApp.use(`${basePathMain}/api/distribution`, distribution);
mainApp.use(`${basePathMain}/api/distribution-manager`, distributionManager);
mainApp.use(`${basePathMain}/api/pickup`, pickupRoute);
mainApp.use(`${basePathMain}/api/pension`, pensionRoute);
mainApp.use(`${basePathMain}/api/email`, emailRoutes);
mainApp.use(`${basePathMain}/api/packing`, packingRoute);

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

// Server startup
const PORT = process.env.PORT || 3000;
mainApp.listen(PORT, () =>
  console.log(
    `Main API server running on port ${PORT} with base path ${basePathMain}`
  )
);

module.exports = mainApp;