const express = require("express");
const router = express.Router();
const checkRole = require("../../middleware/role.middleware");
const { ROLES } = require("../../constants/user-roles");
const dmanagerEp = require("../../end-point/distribution/distribution-manger-ep");
const auth = require("../../middleware/auth.middleware");

// Get distribution center targets

router.get(
  "/user-profile",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getProfile,
);

router.post(
  "/get-claim-officer",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getClaimOfficer,
);
router.post(
  "/claim-officer",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.createClaimOfficer,
);

module.exports = router;