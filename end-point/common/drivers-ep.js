const driverDao = require("../../dao/common/drivers-dao");
const uploadFileToS3 = require("../../middleware/s3upload");
const { driverWithVehicleSchema } = require("../../validation/driver-validation");




exports.checkPhoneExists = async (req, res) => {
  try {
    const phoneNumber = req.params.phoneNumber;

    if (!phoneNumber) {
      return res.status(400).json({
        error: "Phone number is required"
      });
    }

    const exists = await driverDao.checkPhoneExists(phoneNumber);

    return res.status(200).json({
      exists: exists
    });
  } catch (error) {
    console.error("Error checking phone existence:", error);
    return res.status(500).json({
      error: "An error occurred while checking phone number",
      details: error.message
    });
  }
};




exports.checkNicExists = async (req, res) => {
  try {
    const nicNumber = req.params.nicNumber;

    if (!nicNumber) {
      return res.status(400).json({
        error: "NIC number is required" // Changed from "Phone number"
      });
    }

    const exists = await driverDao.checkNICExists(nicNumber);

    return res.status(200).json({
      exists: exists
    });
  } catch (error) {
    console.error("Error checking NIC existence:", error); // Changed error message
    return res.status(500).json({
      error: "An error occurred while checking NIC number", // Changed error message
      details: error.message
    });
  }
};

exports.checkemailExists = async (req, res) => {
  console.log('check email exists')
  try {
    const email = req.params.email;

    if (!email) {
      return res.status(400).json({
        error: "Email is required" // Changed from "Phone number"
      });
    }

    const exists = await driverDao.checkemailExists(email);

    return res.status(200).json({
      exists: exists
    });
  } catch (error) {
    console.error("Error checking Email existence:", error); // Changed error message
    return res.status(500).json({
      error: "An error occurred while checking Email number", // Changed error message
      details: error.message
    });
  }
};