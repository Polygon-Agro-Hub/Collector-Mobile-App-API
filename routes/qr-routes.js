const express = require("express");
const router = express.Router();
const qrGenerateEp = require("../end-point/qr-generate-ep");

router.post("/getUserData", qrGenerateEp.getUserData);

module.exports = router;
