const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middleware/auth.middleware");
const checkRole = require("../../middleware/role.middleware");
const { ROLES } = require("../../constants/user-roles");
const TargetEp = require("../../end-point/collection/TargetNew-ep");

router.get(
  "/officer",
  authMiddleware,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER]),
  TargetEp.getTargetForOfficerManagerView,
);

router.get("/officer/:officerId", TargetEp.getDailyTargetsForOfficer);

router.get(
  "/get-center-target",
  authMiddleware,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER]),
  TargetEp.getCenterTarget,
);

router.put("/pass-target", TargetEp.transferTarget);

router.put("/recieve-target", TargetEp.receiveTarget);

router.put(
  "/manager/pass-target",
  authMiddleware,
  checkRole([ROLES.COLLECTION_MANAGER]),
  TargetEp.ManagertransferTarget,
);
router.put(
  "/manager/recieve-target",
  authMiddleware,
  checkRole([ROLES.COLLECTION_MANAGER]),
  TargetEp.ManagereceiveTarget,
);

router.get(
  "/get-daily-todo-byvariety/:officerId/:varietyId/:grade",
  TargetEp.getDailyTarget,
);

router.get(
  "/officer-task-summary",
  authMiddleware,
  checkRole([ROLES.COLLECTION_OFFICER, ROLES.COLLECTION_MANAGER]),
  TargetEp.getOfficerTaskSummary,
);
router.get(
  "/officer-task-summary/:collectionOfficerId",
  TargetEp.getOfficerTaskSummaryManagerView,
);

module.exports = router;
