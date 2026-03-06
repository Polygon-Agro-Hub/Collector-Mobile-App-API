const express = require('express');
const router = express.Router();
const DistributionEp = require('../end-point/distribution-ep');
const auth = require('../Middlewares/auth.middleware');


router.get('/officer-target', auth, DistributionEp.getOfficerTarget);

router.get('/order-data/:orderId', auth, DistributionEp.getOrderData);

router.put('/update-order/:orderId', auth, DistributionEp.updateOrderItems);

router.get('/all-retail-items/:orderId', auth, DistributionEp.getAllRetailItems);

router.post('/replace-order-package', auth, DistributionEp.replaceOrderPackage);

router.get("/get-distribution-target", auth, DistributionEp.getDistributionTarget)

router.put('/update-outForDelivery', auth, DistributionEp.updateoutForDelivery);

router.put('/update-distributed-target/:orderId', auth, DistributionEp.updateDistributedTarget);

module.exports = router;
