const express = require("express");
const router = express.Router();
const auth = require("../Middlewares/auth.middleware");

const serachFarmerEp = require("../end-point/searchFarmer-ep");

router.get("/getall", serachFarmerEp.getAllUsers);
router.get("/get-users/:NICnumber", serachFarmerEp.getUsers);

module.exports = router;
