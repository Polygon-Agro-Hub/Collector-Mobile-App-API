const express = require("express");
const auth = require("../../middleware/auth.middleware");
const router = express.Router();
const unregisterdCropFamerEp = require("../../end-point/collection/unregistered-crop-farmer-ep");

router.post("/add-crops", auth, unregisterdCropFamerEp.addCropDetails);

router.get("/get-crop-names", auth, unregisterdCropFamerEp.getAllCropNames);



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




module.exports = router;
