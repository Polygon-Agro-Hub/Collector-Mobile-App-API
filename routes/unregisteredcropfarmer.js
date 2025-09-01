const express = require('express');
const auth = require('../Middlewares/auth.middleware');
const router = express.Router();
const unRegisterdcropfamerEp = require('../end-point/unRegisteredCropFarmer-ep');

router.post('/add-crops', auth, unRegisterdcropfamerEp.addCropDetails);
router.post('/add-crops2', auth, unRegisterdcropfamerEp.addCropDetails2);
router.get('/get-crop-names', auth, unRegisterdcropfamerEp.getAllCropNames);
router.get('/get-crop-names/for-collection', auth, unRegisterdcropfamerEp.getAllCropNamesForCollection);
// Route to get varieties by crop name
router.get('/crops/varieties/:id', auth, unRegisterdcropfamerEp.getVarietiesByCropId);

// Route to get unit prices by crop ID
router.get('/unitPrices/:cropId',auth, unRegisterdcropfamerEp.getUnitPricesByCropId);

// Route to get today's crop details by userId
router.get('/user-crops/today/:userId/:registeredFarmerId', unRegisterdcropfamerEp.getCropDetailsByUserId);

// Endpoint to get the latest invoice number
router.get('/invoice/latest/:empId/:currentDate', unRegisterdcropfamerEp.getLatestInvoiceNumber);

router.post('/collection', unRegisterdcropfamerEp.getaddCollection);
router.get('/get-all-crop', auth, unRegisterdcropfamerEp.getAllCropNameId);
router.get('/crops/varieties/collection/:id', auth, unRegisterdcropfamerEp.getVarietiesByCropIdCollection);

router.get('/all-farmer', auth, unRegisterdcropfamerEp.getAllUsers);

router.post('/submit-collection-request', auth, unRegisterdcropfamerEp.submitCollectionRequest);

router.put('/user/update/:userId', auth, unRegisterdcropfamerEp.updateUserAddress);

// Route for submitting collection request
router.post('/submit-collection-request', auth, unRegisterdcropfamerEp.submitCollectionRequest);

module.exports = router;