const express = require("express");
const auth = require("../../middleware/auth.middleware");
const checkRole = require("../../middleware/role.middleware");
const { ROLES } = require("../../constants/user-roles");
const router = express.Router();
const upload = require("../../middleware/multer.middleware");
const pickupEp = require("../../end-point/common/pick-up-ep");

router.get(
  "/get-pickupOrders",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  pickupEp.getPickupOrders,
);

router.get(
  "/check-customer",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  pickupEp.checkCustomer,
);

router.post(
  "/update-pickup-Details",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  upload.single("signature"),
  pickupEp.updatePickupDetails,
);

router.get(
  "/get-received-cash",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  pickupEp.getReceivedOrders,
);

router.get(
  "/get-received-cash-officer",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  pickupEp.getReceivedOrderOfficer,
);

router.post(
  "/update-cash-received",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_OFFICER, ROLES.DISTRIBUTION_MANAGER]),
  pickupEp.updateCashReceived,
);

router.post(
  "/deposit-cash",
  auth,
  checkRole([
    ROLES.COLLECTION_OFFICER,
    ROLES.COLLECTION_MANAGER,
    ROLES.DISTRIBUTION_OFFICER,
    ROLES.DISTRIBUTION_MANAGER,
  ]),
  upload.single("slip"),
  pickupEp.depositCash,
);

module.exports = router;
