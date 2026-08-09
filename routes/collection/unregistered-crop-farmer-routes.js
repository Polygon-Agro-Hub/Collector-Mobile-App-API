const express = require("express");
const auth = require("../../middleware/auth.middleware");
const router = express.Router();
const unregisterdCropFamerEp = require("../../end-point/collection/unregistered-crop-farmer-ep");

router.post("/add-crops", auth, unregisterdCropFamerEp.addCropDetails);

router.post("/add-crops2", auth, unregisterdCropFamerEp.addCropDetails2);

router.get("/get-crop-names", auth, unregisterdCropFamerEp.getAllCropNames);

router.get(
  "/get-crop-names/for-collection",
  auth,
  unregisterdCropFamerEp.getAllCropNamesForCollection,
);

router.get(
  "/crops/varieties/:id",
  auth,
  unregisterdCropFamerEp.getVarietiesByCropId,
);

router.get(
  "/unitPrices/:cropId",
  auth,
  unregisterdCropFamerEp.getUnitPricesByCropId,
);

router.get(
  "/user-crops/today/:userId/:registeredFarmerId",
  unregisterdCropFamerEp.getCropDetailsByUserId,
);

router.get(
  "/invoice/latest/:empId/:currentDate",
  unregisterdCropFamerEp.getLatestInvoiceNumber,
);

router.post("/collection", unregisterdCropFamerEp.getaddCollection);

router.get("/get-all-crop", auth, unregisterdCropFamerEp.getAllCropNameId);

router.get(
  "/crops/varieties/collection/:id",
  auth,
  unregisterdCropFamerEp.getVarietiesByCropIdCollection,
);

router.get("/all-farmer", auth, unregisterdCropFamerEp.getAllUsers);

router.post(
  "/submit-collection-request",
  auth,
  unregisterdCropFamerEp.submitCollectionRequest,
);

router.put(
  "/user/update/:userId",
  auth,
  unregisterdCropFamerEp.updateUserAddress,
);

router.post(
  "/submit-collection-request",
  auth,
  unregisterdCropFamerEp.submitCollectionRequest,
);

module.exports = router;
