const express = require('express');
const router = express.Router();
const authenticate = require('../Middlewares/auth.middleware');
const dmanagerEp = require('../end-point/distributionManger-ep');
const TargetEP = require('../end-point/Target-ep');
const upload = require('../Middlewares/multer.middleware');
const auth = require('../Middlewares/auth.middleware');

// Get distribution center targets 
router.get("/get-dcenter-target", authenticate, dmanagerEp.getDCenterTarget);

router.get('/get-replacerequest', auth, dmanagerEp.getAllReplaceRequests);
router.get('/retail-items/:ordreId', auth, dmanagerEp.getRetailItemWithOutEclist)
router.get('/ordre-replace/:id', auth, dmanagerEp.getOrdreReplace)

router.post('/approve', auth, dmanagerEp.approveReplaceRequest);

router.get('/distribution-officer/:id', auth, dmanagerEp.getDistributionOfficerTarget);



router.get('/get-all-distributionOfficer', auth, dmanagerEp.getAllDistributionOfficer);

router.post('/target-pass/:officerId', auth, dmanagerEp.targetPass);


router.get('/employee/:empId', dmanagerEp.getOfficerDetailsForReport);

router.get(
    '/distributionOfficer-payments-summary',
    dmanagerEp.getDistributionPaymentsSummary
);

router.get("/officer-task-summary/:collectionOfficerId", dmanagerEp.getOfficerTaskSummaryManagerView);

router.get('/user-profile', auth, dmanagerEp.getProfile);

router.get('/get-order/:orderId', dmanagerEp.getOrderById)

router.get('/get-customer-data/:id', dmanagerEp.getCustomerDetailsCustomerId)

router.get("/get-city", dmanagerEp.getAllPCity);

router.get('/get-order-marketplace-ordash/:orderId', dmanagerEp.getOrderMarketplaceOrdash);


module.exports = router;