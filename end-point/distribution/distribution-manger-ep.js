const targetDDao = require("../../dao/distribution/distribution-manager-dao");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const distributionofficerDao = require("../../dao/distribution/distribution-manager-dao");
const collectionofficerDao = require("../../dao/common/manager-dao");
const asyncHandler = require("express-async-handler");




exports.getProfile = async (req, res) => {
  try {
    const officerId = req.user.id;

    if (!officerId) {
      return res
        .status(400)
        .json({ status: "error", message: "Officer ID is required" });
    }

    const officerDetails =
      await distributionofficerDao.getOfficerDetailsById(officerId);

    res.status(200).json({
      status: "success",
      data: officerDetails,
    });
  } catch (error) {
    console.error("Error fetching officer details:", error.message);

    if (error.message === "Officer not found") {
      return res
        .status(404)
        .json({ status: "error", message: "Officer not found" });
    }

    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching officer details",
    });
  }
};





exports.getAllDistributionOfficer = async (req, res) => {
  try {
    const managerId = req.query.managerId || req.user.id;

    const allData = await targetDDao.getAllDistributionOfficer(managerId);

    res.status(200).json({
      success: true,
      message:
        "Distribution officers and manager details retrieved successfully",
      data: allData,
    });
  } catch (error) {
    console.error("Error getting distribution officers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve distribution officers and manager details",
      error: error.message,
    });
  }
};


exports.getClaimOfficer = async (req, res) => {
  const { empID, jobRole } = req.body;
  const OfficercompanyId = req.user.companyId;

  try {
    const results = await distributionofficerDao.getClaimOfficer(
      empID,
      jobRole,
      OfficercompanyId,
    );
    res.status(200).json({ result: results, status: true });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.createClaimOfficer = async (req, res) => {
  const { officerId } = req.body;
  const irmId = req.user.id;
  const centerId = req.user.centerId;
  const mangerJobRole = req.user.role;

  try {
    const results = await collectionofficerDao.createClaimOfficer(
      officerId,
      irmId,
      centerId,
      mangerJobRole,
    );
    res.status(200).json({ result: results, status: true });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

