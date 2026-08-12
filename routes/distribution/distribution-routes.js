const express = require("express");
const router = express.Router();
const DistributionEp = require("../../end-point/distribution/distribution-ep");
const auth = require("../../middleware/auth.middleware");
const checkRole = require("../../middleware/role.middleware");
const { ROLES } = require("../../constants/user-roles");

router.get(
  "/get-distribution-target",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.getDistributionTarget,
);

module.exports = router;
