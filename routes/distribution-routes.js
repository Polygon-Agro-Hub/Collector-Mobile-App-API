const express = require("express");
const router = express.Router();
const DistributionEp = require("../end-point/distribution-ep");
const auth = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");
const { ROLES } = require("../constants/user-roles");

router.get(
  "/officer-target",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.getOfficerTarget,
);



router.get(
  "/get-distribution-target",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.getDistributionTarget,
);

router.put(
  "/update-outForDelivery",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.updateoutForDelivery,
);

router.put(
  "/update-distributed-target/:orderId",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.updateDistributedTarget,
);

module.exports = router;
