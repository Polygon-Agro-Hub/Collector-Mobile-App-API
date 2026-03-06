const express = require('express');
const router = express.Router();

const qrGenerateEp = require('../end-point/qrGenerate-ep')

router.post('/getUserData', qrGenerateEp.getUserData);

module.exports = router;