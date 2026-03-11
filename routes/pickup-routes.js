const express = require("express");
const auth = require("../middleware/auth.middleware");
const router = express.Router();
const upload = require("../middleware/multer.middleware");
const pickupEp = require("../end-point/pick-up-ep");

router.get("/get-pickupOrders", auth, pickupEp.getPickupOrders);

router.get("/check-customer", auth, pickupEp.checkCustomer);

router.post(
  "/update-pickup-Details",
  auth,
  upload.single("signature"),
  pickupEp.updatePickupDetails,
);

router.get("/get-received-cash", auth, pickupEp.getReceivedOrders);

router.get(
  "/get-received-cash-officer",
  auth,
  pickupEp.getReceivedOrderOfficer,
);

router.post("/update-cash-received", auth, pickupEp.updateCashReceived);

module.exports = router;
