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
  "/order-data/:orderId",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.getOrderData,
);

router.put(
  "/update-order/:orderId",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.updateOrderItems,
);

router.get(
  "/all-retail-items/:orderId",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.getAllRetailItems,
);

router.post(
  "/replace-order-package",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  DistributionEp.replaceOrderPackage,
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
