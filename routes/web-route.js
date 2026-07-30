const express = require("express");
const router = express.Router();
const webEp = require("../end-point/web-ep");

// DCM Web Login
router.post("/login", webEp.dcmLogin);

// Get available rows overview
router.get("/rows", webEp.getAvailableRows);

// Get live row monitor data
router.get("/rows/:rowId/live-monitor", webEp.getRowLiveMonitor);

module.exports = router;
