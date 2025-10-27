const express = require('express');
const auth = require('../Middlewares/auth.middleware');
const router = express.Router();
const marketPrice = require('../end-point/marketPrice-ep')

// Assuming authentication middleware sets req.user.id
// router.post('/marketpricerequest', auth, priceRequest.insertMarketPriceRequestBatch);
router.post('/marketpricerequest', auth, marketPrice.insertMarketPriceRequestBatch);

router.post('/marketpricerequest-manager', auth, marketPrice.insertMarketPriceRequestBatchManager);
module.exports = router;