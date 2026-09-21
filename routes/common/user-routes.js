const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const userAuthEp = require("../../end-point/common/user-auth-ep");

router.post("/login", userAuthEp.loginUser);

router.post("/online-status", userAuthEp.updateOnlineStatus);

router.get("/check-status", authenticate, (req, res) => {
    res.status(200).json({
        status: "success",
        accountStatus: "Approved",
        message: "Account is active and approved.",
    });
});

router.post("/change-password", authenticate, userAuthEp.updatePassword);

router.get("/user-profile", authenticate, userAuthEp.getProfile);

router.put("/update-phone", authenticate, userAuthEp.updatePhoneNumber);

router.get("/get-claim-status", authenticate, userAuthEp.GetClaimStatus);

router.get("/password-update", authenticate, userAuthEp.getPassword);

module.exports = router;
