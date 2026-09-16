const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/auth.middleware");
const checkRole = require("../../middleware/role.middleware");
const { ROLES } = require("../../constants/user-roles");
const TransportEp = require("../../end-point/collection/transport-ep");


router.get("/sent-today", authMiddleware, TransportEp.getSentProductsToday);
router.get("/load/:transportId", authMiddleware, TransportEp.getTransportLoadDetails);

router.post("/verify-driver-qr", authMiddleware, TransportEp.verifyDriverQR);

router.get("/distribution-centres", authMiddleware, TransportEp.getAllDistributionCentres);

router.get("/crops-varieties", authMiddleware, TransportEp.getCropsAndVarietiesForOfficer);

router.post("/save-load", authMiddleware, TransportEp.saveTransportLoad);

module.exports = router;       