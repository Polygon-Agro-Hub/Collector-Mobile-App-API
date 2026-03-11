const express = require("express");
const router = express.Router();
const serachFarmerEp = require("../end-point/search-farmer-ep");

router.get("/getall", serachFarmerEp.getAllUsers);

router.get("/get-users/:NICnumber", serachFarmerEp.getUsers);

module.exports = router;
