const express = require('express');
const router = express.Router();
const CollectionEp = require('../end-point/collection-ep');
const auth = require('../Middlewares/auth.middleware');

// Get collection requests
router.get('/all-collectionrequest', auth, CollectionEp.getAllCollectionRequest);

router.get('/view-details/:requestId', auth, CollectionEp.getViewDetailsById);

router.put('/cancell-request/:requestId', auth, CollectionEp.cancellRequest);

router.post('/update-collectionrequest/:requestId', auth, CollectionEp.updateCollectionRequest);


module.exports = router;
