const express = require("express");
const router = express.Router();
const PackingEp = require("../end-point/packing-ep");
const AssignGroupsEp = require("../end-point/assign-groups-ep");
const auth = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");
const { ROLES } = require("../constants/user-roles");

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

router.post(
  "/positions/assign",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.assignPosition
);

router.get(
  "/positions/:positionId/crops",
  auth,
  checkRole([ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  PackingEp.getPositionCrops
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

module.exports = router;
