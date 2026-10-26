const express = require("express");
const auth = require("../../middleware/auth.middleware");
const router = express.Router();
const farmerEp = require("../../end-point/collection/farmer-ep");

router.post("/register-farmer", farmerEp.addUserAndPaymentDetails);

router.get("/register-farmer/:userId", farmerEp.getRegisteredFarmerDetails);

router.get("/report-user-details/:id", auth, farmerEp.getUserWithBankDetails);

router.post("/farmer-register-checker", farmerEp.signupChecker);

router.post("/farmer-register", farmerEp.addFarmer);

router.post("/FarmerBankDetails", farmerEp.addFarmerBankDetails);

router.post("/send-otp", farmerEp.sendOtp);

router.post("/verify-otp", farmerEp.verifyOtp);

router.post("/send-sms", farmerEp.sendCustomSms);

module.exports = router;
