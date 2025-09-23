const express = require('express');
const router = express.Router();

const ComplaintEp = require('../end-point/complaint-ep')

// Middleware to authenticate and extract user info from token
const auth = require('../Middlewares/auth.middleware');

router.post('/farmer-complaint', auth, ComplaintEp.createFarmerComplaint);
router.post('/officer-complaint', auth, ComplaintEp.createOfficerComplain);
router.get('/get-complains', auth, ComplaintEp.getComplains);
// router.get('api/complain/reply/:id', ComplaintEp.getComplainReplyByid );
router.get('/get-complain-category/:appName', ComplaintEp.getComplainCategory);

module.exports = router;