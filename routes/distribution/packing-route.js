const express = require("express");
const router = express.Router();
const PackingEp = require("../../end-point/distribution/packing-ep");
const AssignGroupsEp = require("../../end-point/distribution/assign-groups-ep");
const auth = require("../../middleware/auth.middleware");
const checkRole = require("../../middleware/role.middleware");
const { ROLES } = require("../../constants/user-roles");

router.get(
  "/rows",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getPackingRows
);

router.get(
  "/rows/:rowId/positions",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getRowPositions
);

router.get(
  "/active-assignment",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getOfficerActiveAssignment
);

router.post(
  "/positions/assign",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.assignPosition
);

router.post(
  "/positions/release",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.releasePosition
);

router.get(
  "/positions/:positionId/crops",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getPositionCrops
);

router.post(
  "/qr-opened",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.markOrderAsOpened
);

router.post(
  "/qr-rollback",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.rollbackOrderOpened
);

router.post(
  "/advance-position",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.advancePositionIndex
);

router.post(
  "/qc-completed",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.markOrderAsCompleted
);

router.get(
  "/order-status/:orderId",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getOrderTrackingStatus
);

router.get(
  "/active-order",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getOfficerActiveOrder
);

router.get(
  "/packer/active-order",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getPackerActiveOrder
);

router.get(
  "/qc/active-order",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getQCActiveOrder
);

// Assign Groups (DCM) Flow Routes
router.get(
  "/groups",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  AssignGroupsEp.getGroupTimeslots
);

router.get(
  "/groups/orders",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  AssignGroupsEp.getUnassignedOrders
);

router.get(
  "/groups/rows",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  AssignGroupsEp.getRowAllocations
);

router.post(
  "/groups/assign",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  AssignGroupsEp.assignGroupOrders
);

router.get(
  "/qr-orders",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getQROrders
);

router.get(
  "/center-target",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getCenterTarget
);

router.get(
  "/order-details/:orderId",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getOrderDetails
);

module.exports = router;
