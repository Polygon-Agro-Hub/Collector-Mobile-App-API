const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const { authLimiter } = require("../../middleware/rateLimiter");
const userAuthEp = require("../../end-point/common/user-auth-ep");

router.post("/login", authLimiter, userAuthEp.loginUser);

router.post("/online-status", userAuthEp.updateOnlineStatus);

router.get("/check-status", authenticate, (req, res) => {
    res.status(200).json({
        status: "success",
        accountStatus: req.user.status || "Approved",
        message: "Account is active and approved.",
    });
});

router.post("/change-password", authenticate, authLimiter, userAuthEp.updatePassword);

router.get("/user-profile", authenticate, userAuthEp.getProfile);

router.put("/update-phone", authenticate, userAuthEp.updatePhoneNumber);

router.get("/get-claim-status", authenticate, userAuthEp.GetClaimStatus);

router.get("/password-update", authenticate, userAuthEp.getPassword);

router.post("/notify-status-changed", userAuthEp.notifyStatusChanged);

module.exports = router;
