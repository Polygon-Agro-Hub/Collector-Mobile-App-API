const express = require("express");
const router = express.Router();
const DistributionEp = require("../../end-point/distribution/distribution-ep");
const TransportEp = require("../../end-point/collection/transport-ep");
const auth = require("../../middleware/auth.middleware");
const checkRole = require("../../middleware/role.middleware");
const { ROLES } = require("../../constants/user-roles");

router.get(
  "/get-distribution-target",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.getDistributionTarget,
);

router.get("/received-today", auth, TransportEp.getReceivedProductsToday);
router.get("/load/:transportId", auth, TransportEp.getTransportLoadDetails);
router.post("/verify-load-qr", auth, TransportEp.verifyLoadQR);
router.post("/finish-unloading", auth, TransportEp.finishUnloading);

module.exports = router;
