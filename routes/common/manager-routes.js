const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const checkRole = require("../../middleware/role.middleware");
const { ROLES } = require("../../constants/user-roles");
const managerEp = require("../../end-point/common/manager-ep");
const TargetEP = require("../../end-point/collection/Target-ep");
const upload = require("../../middleware/multer.middleware");
const driverEp = require("../../end-point/common/drivers-ep");

// Route to get collection officers under a specific manager
router.get(
  "/collection-officers",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER]),
  managerEp.getCollectionOfficers,
);

router.get(
  "/collection-officers-recieve/:varietyId/:grade",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER]),
  managerEp.getCollectionOfficersReciever,
);

router.get(
  "/collection-officerslist",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_MANAGER]),
  managerEp.getCollectionOfficersList,
);

//Route to add a collection officer
router.post(
  "/collection-officer/add",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_MANAGER]),
  upload.single("image"),
  managerEp.createCollectionOfficer,
);

// Route to fetch farmer payments summary
router.get("/farmer-payments-summary", managerEp.getFarmerPaymentsSummary);

// Route to get employee details by empId
router.get("/employee/:empId", managerEp.getOfficerDetailsForReport);

//route to generate empId
router.get("/generate-empId/:role", managerEp.getForCreateId);

// Define the route for fetching farmer transaction list
router.get(
  "/transaction-list",
  managerEp.getFarmerListByCollectionOfficerAndDate,
);

router.get(
  "/my-collection",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER]),
  managerEp.getFarmerListByCollectionOfficerAndDateForManager,
);

router.post(
  "/get-claim-officer",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER]),
  managerEp.getClaimOfficer,
);

router.post("/claim-officer", managerEp.createClaimOfficer);

router.post("/disclaim-officer", managerEp.disclaimOfficer);

//Route for the farmers transcation details for the manager report
router.get(
  "/transaction-details/:userId/:createdAt/:farmerId",
  managerEp.GetFarmerReportDetails,
);

//target routes

router.get("/get-crop-category", TargetEP.getAllCropCatogory);

router.post(
  "/create-daily-target",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER]),
  TargetEP.addDailyTarget,
);

router.get(
  "/get-daily-target",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER]),
  TargetEP.getAllDailyTarget,
);

router.get(
  "/download-daily-target",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER]),
  TargetEP.downloadDailyTarget,
);

router.get("/targets", TargetEP.getAllTargets);

router.get(
  "/get-officer-online/:collectionOfficerId",
  managerEp.getofficeronline,
);

router.post(
  "/driver/add",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_MANAGER]),
  driverEp.createDriverWithVehicle,
);

router.get(
  "/driver/check-phone/:phoneNumber",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_MANAGER]),
  driverEp.checkPhoneExists,
);

router.get(
  "/driver/check-nic/:nicNumber",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_MANAGER]),
  driverEp.checkNicExists,
);

router.get(
  "/driver/check-email/:email",
  authenticate,
  checkRole([ROLES.COLLECTION_MANAGER, ROLES.DISTRIBUTION_MANAGER]),
  driverEp.checkemailExists,
);

module.exports = router;
