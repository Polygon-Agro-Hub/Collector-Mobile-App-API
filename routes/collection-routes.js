const express = require("express");
const router = express.Router();
const CollectionEp = require("../end-point/collection-ep");
const auth = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");
const { ROLES } = require("../constants/user-roles");

// Get collection requests
router.get(
  "/all-collectionrequest",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER]),
  CollectionEp.getAllCollectionRequest,
);

router.get(
  "/view-details/:requestId",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER]),
  CollectionEp.getViewDetailsById,
);

router.put(
  "/cancell-request/:requestId",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER]),
  CollectionEp.cancellRequest,
);

router.post(
  "/update-collectionrequest/:requestId",
  auth,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER]),
  CollectionEp.updateCollectionRequest,
);

module.exports = router;
