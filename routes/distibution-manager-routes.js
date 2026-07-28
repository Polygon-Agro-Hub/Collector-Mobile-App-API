const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");
const { ROLES } = require("../constants/user-roles");
const dmanagerEp = require("../end-point/distribution-manger-ep");
const auth = require("../middleware/auth.middleware");
const invoicePdfEp = require("../end-point/invoice-pdf-ep");

// Get distribution center targets


router.get("/employee/:empId", dmanagerEp.getOfficerDetailsForReport);

router.get(
  "/distributionOfficer-payments-summary",
  dmanagerEp.getDistributionPaymentsSummary,
);

router.get(
  "/officer-task-summary/:collectionOfficerId",
  dmanagerEp.getOfficerTaskSummaryManagerView,
);

router.get(
  "/user-profile",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getProfile,
);

router.get("/get-order/:orderId", dmanagerEp.getOrderById);

router.get("/get-customer-data/:id", dmanagerEp.getCustomerDetailsCustomerId);

router.get("/get-city", dmanagerEp.getAllPCity);

router.get(
  "/get-order-marketplace-ordash/:orderId",
  dmanagerEp.getOrderMarketplaceOrdash,
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

router.get(
  "/all-retail-items/:orderId",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getAllRetailItems,
);

module.exports = router;