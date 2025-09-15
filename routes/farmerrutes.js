const express = require('express');
const auth = require('../Middlewares/auth.middleware');
const router = express.Router();

const farmerEp = require('../end-point/farmer-ep');

router.post('/register-farmer', farmerEp.addUserAndPaymentDetails);
router.get('/register-farmer/:userId', farmerEp.getRegisteredFarmerDetails);

router.get('/report-user-details/:id', auth, farmerEp.getUserWithBankDetails);
router.post('/farmer-register-checker', farmerEp.signupChecker);


router.post('/farmer-register', farmerEp.addFarmer);
router.post('/FarmerBankDetails', farmerEp.addFarmerBankDetails);

module.exports = router;