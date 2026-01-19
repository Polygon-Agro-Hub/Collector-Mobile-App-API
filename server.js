const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
require('dotenv').config();

// ===== ROUTES =====
const addCropDetails = require('./routes/unregisteredcropfarmer');
const farmerRoutes = require('./routes/farmerrutes');
const getUserdata = require('./routes/QRroutes');
const complainRoutes = require('./routes/complains.routes');
const priceUpdatesRoutes = require('./routes/price.routes');
const managerRoutes = require('./routes/manager.routes');
const collectionrequest = require('./routes/collection.routes');
const distribution = require('./routes/distribution.routes');
const distributionManager = require('./routes/distibutionManager.routes');
const pickupRoute = require('./routes/pickup.routes');
const searchRoutes = require('./routes/search.routes');
const targetRoutes = require('./routes/TargetNew-routes');
const collectionOfficerRoutes = require('./routes/userroutes');
const emailRoutes = require('./routes/email.routes');

// ✅ HEALTH ROUTE (FIXED)
const healthRoutes = require('./routes/health.routes');

// ===== DATABASE =====
const {
  plantcare,
  collectionofficer,
  marketPlace,
  admin,
} = require('./startup/database');

// ===== APP INIT =====
const mainApp = express();
const PORT = process.env.PORT || 3000;
const basePathMain = '/collection';

// ===== CORS & BODY PARSER =====
mainApp.use(
  cors({
    origin: "http://localhost:8081",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

mainApp.options("*", cors());

mainApp.use(bodyParser.json({ limit: '10mb' }));
mainApp.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// ===== DATABASE CONNECTION TEST =====
const testConnection = (pool, name) => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(`❌ Error connecting to ${name} DB:`, err.message);
        reject(err);
      } else {
        console.log(`✅ Connected to ${name} DB`);
        connection.release();
        resolve();
      }
    });
  });
};

const checkConnections = async () => {
  console.log('🔄 Testing database connections...\n');
  try {
    await testConnection(plantcare, 'PlantCare');
    await testConnection(collectionofficer, 'CollectionOfficer');
    await testConnection(marketPlace, 'MarketPlace');
    await testConnection(admin, 'Admin');
    console.log('\n🎉 All databases connected successfully!\n');
  } catch (error) {
    console.error('\n⚠️ Database connection failed\n');
  }
};

checkConnections();

// ===== API ROUTES =====
mainApp.use(`${basePathMain}/api/collection-officer`, collectionOfficerRoutes);
mainApp.use(`${basePathMain}/api/farmer`, farmerRoutes);
mainApp.use(`${basePathMain}/api/unregisteredfarmercrop`, addCropDetails);
mainApp.use(`${basePathMain}/api/getUserData`, getUserdata);
mainApp.use(`${basePathMain}/api/auth`, searchRoutes);
mainApp.use(`${basePathMain}/api/auth`, priceUpdatesRoutes);
mainApp.use(`${basePathMain}/api/complain`, complainRoutes);
mainApp.use(`${basePathMain}/api/collection-manager`, managerRoutes);
mainApp.use(`${basePathMain}/api/target`, targetRoutes);
mainApp.use(`${basePathMain}/api/collectionrequest`, collectionrequest);
mainApp.use(`${basePathMain}/api/distribution`, distribution);
mainApp.use(`${basePathMain}/api/distribution-manager`, distributionManager);
mainApp.use(`${basePathMain}/api/pickup`, pickupRoute);
mainApp.use(`${basePathMain}/api/email`, emailRoutes);

// ✅ HEALTH ENDPOINT
mainApp.use(basePathMain, healthRoutes);

// ===== CRON JOB =====
const farmerEp = require('./end-point/farmer-ep');

cron.schedule(
  '16 18 * * *',
  async () => {
    console.log('📨 Running SMS sending task');
    await farmerEp.sendSMSToFarmers();
    console.log('✅ SMS task completed');
  },
  {
    scheduled: true,
    timezone: "Asia/Colombo",
  }
);

// ===== SERVER START =====
mainApp.listen(PORT, () => {
  console.log(
    `🚀 Main API server running on port ${PORT} with base path ${basePathMain}`
  );
});

module.exports = mainApp;
