const express = require("express");
const auth = require("../Middlewares/auth.middleware");
const router = express.Router();
const marketPrice = require("../end-point/marketPrice-ep");

router.post(
    "/marketpricerequest",
    auth,
    marketPrice.insertMarketPriceRequestBatch,
);

router.post(
    "/marketpricerequest-manager",
    auth,
    marketPrice.insertMarketPriceRequestBatchManager,
);
module.exports = router;
