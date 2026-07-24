const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");
const { ROLES } = require("../constants/user-roles");
const dmanagerEp = require("../end-point/distribution-manger-ep");
const auth = require("../middleware/auth.middleware");
const invoicePdfEp = require("../end-point/invoice-pdf-ep");

// Get distribution center targets
router.get(
  "/get-dcenter-target",
  authenticate,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getDCenterTarget,
);

router.post(
  "/process-delivery-invoices",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  invoicePdfEp.processDeliveryInvoices,
);

router.get(
  "/get-replacerequest",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getAllReplaceRequests,
);

router.get(
  "/order-package-item/:replaceId",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getOrderPackageItem,
);

router.get(
  "/retail-items/:ordreId",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getRetailItemWithOutEclist,
);
router.get(
  "/ordre-replace/:id",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getOrdreReplace,
);

router.post(
  "/approve",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.approveReplaceRequest,
);

router.get(
  "/distribution-officer/:id",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getDistributionOfficerTarget,
);

router.get(
  "/get-all-distributionOfficer",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.getAllDistributionOfficer,
);

router.post(
  "/target-pass/:officerId",
  auth,
  checkRole([ROLES.DISTRIBUTION_MANAGER]),
  dmanagerEp.targetPass,
);

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