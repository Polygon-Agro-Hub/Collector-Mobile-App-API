const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const addCropDetails = require("./routes/unregisteredcropfarmer");
const farmerRoutes = require("./routes/farmerrutes");
const bodyParser = require("body-parser");
const getUserdata = require("./routes/QRroutes");
const complainRoutes = require("./routes/complains.routes");
const priceUpdatesRoutes = require("./routes/price.routes");
const managerRoutes = require("./routes/manager.routes");
const collectionrequest = require("./routes/collection.routes");
const {
  plantcare,
  collectionofficer,
  marketPlace,
  admin,
} = require("./startup/database");
const heathRoutes = require("./routes/heathRoutes");
const distribution = require("./routes/distribution.routes");
const distributionManager = require("./routes/distibutionManager.routes");
const pickupRoute = require("./routes/pickup.routes");

const socketIo = require("socket.io");
require("dotenv").config();

const mainApp = express();

[mainApp].forEach((app) => {
  app.use(
    cors({
      origin: "http://localhost:8081",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );
  app.options(
    "*",
    cors({
      origin: "http://localhost:8081",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );
  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
});

const testConnection = (pool, name) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(
          `❌ Error connecting to the ${name} database:`,
          err.message,
        );
        reject(err);
      } else {
        console.log(`✅ Successfully connected to the MySQL database: ${name}`);
        connection.release(); // Release the connection back to the pool
        resolve();
      }
    });
  });
};

// Test all database connections sequentially
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

checkConnections();

const basePathMain = "/agro-api/collection-api";
const collectionOfficerRoutes = require("./routes/userroutes");
mainApp.use(`${basePathMain}/api/collection-officer`, collectionOfficerRoutes);
mainApp.use(`${basePathMain}/api/farmer`, farmerRoutes);
mainApp.use(`${basePathMain}/api/unregisteredfarmercrop`, addCropDetails);

mainApp.use(`${basePathMain}/api/getUserData`, getUserdata);
const searchRoutes = require("./routes/search.routes");
mainApp.use(`${basePathMain}/api/auth`, searchRoutes);
mainApp.use(`${basePathMain}/api/complain`, complainRoutes);
mainApp.use(`${basePathMain}/api/auth`, priceUpdatesRoutes);
mainApp.use(`${basePathMain}/api/collection-manager`, managerRoutes);
const targetRoutes = require("./routes/TargetNew-routes");
mainApp.use(`${basePathMain}/api/target`, targetRoutes);
mainApp.use(`${basePathMain}`, heathRoutes);
mainApp.use(`${basePathMain}/api/collectionrequest`, collectionrequest);
mainApp.use(`${basePathMain}/api/distribution`, distribution);
mainApp.use(`${basePathMain}/api/distribution-manager`, distributionManager);
mainApp.use(`${basePathMain}/api/pickup`, pickupRoute);

const basePathStatus = "/agro-api/collection-status";

const PORT = process.env.PORT || 3000;

const farmerEp = require("./end-point/farmer-ep");

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
  },
);
mainApp.listen(PORT, () =>
  console.log(
    `Main API server running on port ${PORT} with base path ${basePathMain}`,
  ),
);

const emailRoutes = require("./routes/email.routes");

mainApp.use(`${basePathMain}/api/email`, emailRoutes);

module.exports = mainApp;
