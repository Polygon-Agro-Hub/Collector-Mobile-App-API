const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth.middleware");
const pensionRequestController = require("../../end-point/collection/pension-ep");
const upload = require("../../middleware/multer.middleware");

router.post(
  "/pension-request/check-status-by-nic",
  auth,
  pensionRequestController.checkPensionRequestStatusByNIC,
);

router.post(
  "/pension-request/submit",
  auth,
  upload.fields([
    { name: "nicFront", maxCount: 1 },
    { name: "nicBack", maxCount: 1 },
    { name: "sucNicFront", maxCount: 1 },
    { name: "sucNicBack", maxCount: 1 },
    { name: "birthCrtFront", maxCount: 1 },
    { name: "birthCrtBack", maxCount: 1 },
  ]),
  pensionRequestController.submitPensionRequest,
);

router.get(
  "/check-eligibility/:userId",
  auth,
  pensionRequestController.checkEligibility,
);

module.exports = router;
