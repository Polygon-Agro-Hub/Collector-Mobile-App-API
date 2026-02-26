const express = require("express");
const auth = require("../Middlewares/auth.middleware");
const router = express.Router();
const unRegisterdcropfamerEp = require("../end-point/unRegisteredCropFarmer-ep");

router.post("/add-crops", auth, unRegisterdcropfamerEp.addCropDetails);
router.post("/add-crops2", auth, unRegisterdcropfamerEp.addCropDetails2);
router.get("/get-crop-names", auth, unRegisterdcropfamerEp.getAllCropNames);
router.get(
    "/get-crop-names/for-collection",
    auth,
    unRegisterdcropfamerEp.getAllCropNamesForCollection,
);

router.get(
    "/crops/varieties/:id",
    auth,
    unRegisterdcropfamerEp.getVarietiesByCropId,
);

router.get(
    "/unitPrices/:cropId",
    auth,
    unRegisterdcropfamerEp.getUnitPricesByCropId,
);

router.get(
    "/user-crops/today/:userId/:registeredFarmerId",
    unRegisterdcropfamerEp.getCropDetailsByUserId,
);

router.get(
    "/invoice/latest/:empId/:currentDate",
    unRegisterdcropfamerEp.getLatestInvoiceNumber,
);

router.post("/collection", unRegisterdcropfamerEp.getaddCollection);
router.get("/get-all-crop", auth, unRegisterdcropfamerEp.getAllCropNameId);
router.get(
    "/crops/varieties/collection/:id",
    auth,
    unRegisterdcropfamerEp.getVarietiesByCropIdCollection,
);

router.get("/all-farmer", auth, unRegisterdcropfamerEp.getAllUsers);

router.post(
    "/submit-collection-request",
    auth,
    unRegisterdcropfamerEp.submitCollectionRequest,
);

router.put(
    "/user/update/:userId",
    auth,
    unRegisterdcropfamerEp.updateUserAddress,
);

router.post(
    "/submit-collection-request",
    auth,
    unRegisterdcropfamerEp.submitCollectionRequest,
);

module.exports = router;
