const express = require("express");
const router = express.Router();
const ep = require("../../end-point/distribution/purchase-shortage-ep");
const auth = require("../../middleware/auth.middleware");
const checkRole = require("../../middleware/role.middleware");
const { ROLES } = require("../../constants/user-roles");

router.get(
  "/",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  ep.getOfficerShortages
);

router.post(
  "/submit",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  ep.submitPurchase
);

module.exports = router;
