const express = require("express");
const router = express.Router();
const { authLimiter } = require("../../middleware/rateLimiter");
const webEp = require("../../end-point/web/web-ep");

// DCM Web Login
router.post("/login", authLimiter, webEp.dcmLogin);

// Get available rows overview
router.get("/rows", webEp.getAvailableRows);

// Get live row monitor data
router.get("/rows/:rowId/live-monitor", webEp.getRowLiveMonitor);

// Get web order package details
router.get("/orders/:processOrderId/details", webEp.getWebOrderDetails);

// Toggle/Free position occupancy status
router.post("/positions/:positionId/toggle", webEp.togglePositionOccupancy);

module.exports = router;
