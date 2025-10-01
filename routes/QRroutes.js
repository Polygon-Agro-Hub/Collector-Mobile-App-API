const express = require('express');
const router = express.Router();

const qrGenerateEp = require('../end-point/qrGenerate-ep')
// Route for fetching user and bank details from the scanned QR code
router.post('/getUserData', qrGenerateEp.getUserData);

module.exports = router;