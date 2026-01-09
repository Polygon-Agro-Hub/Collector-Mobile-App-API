const express = require('express');
const auth = require('../Middlewares/auth.middleware');
const router = express.Router();

const pickupEp = require('../end-point/pickUp-ep');


router.get('/get-pickupOrders', auth, pickupEp.getPickupOrders);

router.get('/check-customer', auth, pickupEp.checkCustomer);


module.exports = router;