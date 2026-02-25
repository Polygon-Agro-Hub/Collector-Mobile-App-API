const express = require('express');
const authMiddleware = require('../Middlewares/auth.middleware');
const TargetEP = require('../end-point/Target-ep')

const router = express.Router();


router.get(
    "/get-daily-target-officer",
    authMiddleware,
    TargetEP.getTargetForOfficer
)


router.get(
    "/get-daily-target-officer/:officerId",
    TargetEP.getTargetForOfficer
)

router.get("/get-daily-center-target/:varietyId/:grade/:centerId", authMiddleware, TargetEP.getCenterTargetEp)

router.get("/get-center-target", authMiddleware, TargetEP.getCenterTarget)

router.get('/officer', authMiddleware, TargetEP.getTargetForOfficerManagerView);
router.get('/officer/:officerId', authMiddleware, TargetEP.getTargetForOfficer);


router.put('/pass-target', TargetEP.transferTarget);
router.put('/recieve-target', TargetEP.receiveTarget);

router.put('/manager/pass-target', authMiddleware, TargetEP.ManagertransferTarget);
router.put('/manager/recieve-target', authMiddleware, TargetEP.ManagereceiveTarget);

router.get('/get-daily-todo-byvariety/:officerId/:varietyId/:grade', TargetEP.getDailyTarget);

router.get("/officer-task-summary", authMiddleware, TargetEP.getOfficerTaskSummary);
router.get("/officer-task-summary/:collectionOfficerId", TargetEP.getOfficerTaskSummaryManagerView);



module.exports = router;