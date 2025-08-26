const express = require('express');
const router = express.Router();
const { getOfficerQRCode } = require('../Controllers/users.controller');
const auth = require('../Middlewares/auth.middleware');
const upload = require('../Middlewares/multer.middleware');

const userAuthEp = require('../end-point/userAuth-ep');

router.post('/login', userAuthEp.loginUser);
router.post('/online-status', userAuthEp.updateOnlineStatus);
router.post('/change-password', userAuthEp.updatePassword);

router.get('/user-profile', auth, userAuthEp.getProfile);

router.get('/profile-details', auth, userAuthEp.getUserDetails);

router.put('/update-phone', auth, userAuthEp.updatePhoneNumber);

router.get('/get-officer-Qr', auth, userAuthEp.getOfficerQRCode);

router.get('/get-claim-status', auth, userAuthEp.GetClaimStatus);

// router.post("/update-officer-status", auth, userAuthEp.updateOnlineStatus);
router.post('/upload-profile-image', auth, upload.single('profileImage'), userAuthEp.uploadProfileImage);

router.get('/password-update', auth, userAuthEp.getPassword);


module.exports = router;