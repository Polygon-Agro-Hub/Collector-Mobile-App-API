const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const TargetEp = require("../end-point/TargetNew-ep");

router.get("/officer", authMiddleware, TargetEp.getTargetForOfficerManagerView);

router.get("/officer/:officerId", TargetEp.getDailyTargetsForOfficer);

router.get("/get-center-target", authMiddleware, TargetEp.getCenterTarget);

router.put("/pass-target", TargetEp.transferTarget);

router.put("/recieve-target", TargetEp.receiveTarget);

router.put(
  "/manager/pass-target",
  authMiddleware,
  TargetEp.ManagertransferTarget,
);
router.put(
  "/manager/recieve-target",
  authMiddleware,
  TargetEp.ManagereceiveTarget,
);

router.get(
  "/get-daily-todo-byvariety/:officerId/:varietyId/:grade",
  TargetEp.getDailyTarget,
);

router.get(
  "/officer-task-summary",
  authMiddleware,
  TargetEp.getOfficerTaskSummary,
);
router.get(
  "/officer-task-summary/:collectionOfficerId",
  TargetEp.getOfficerTaskSummaryManagerView,
);

module.exports = router;
