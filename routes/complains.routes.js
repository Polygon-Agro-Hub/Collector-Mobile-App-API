const express = require('express');
const router = express.Router();

const ComplaintEp = require('../end-point/complaint-ep')


const auth = require('../Middlewares/auth.middleware');

router.post('/farmer-complaint', auth, ComplaintEp.createFarmerComplaint);

router.post('/officer-complaint', auth, ComplaintEp.createOfficerComplain);

router.get('/get-complains', auth, ComplaintEp.getComplains);

router.get('/get-complain-category/:appName', ComplaintEp.getComplainCategory);

module.exports = router;