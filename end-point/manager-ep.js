const collectionofficerDao = require("../dao/manager-dao");
const jwt = require("jsonwebtoken");
const Joi = require("joi");

const uploadFileToS3 = require("../Middlewares/s3upload");

const createCollectionOfficerSchema = require("../Validations/manager-validation");

exports.createCollectionOfficer = async (req, res) => {
  try {
    const { error, value } =
      createCollectionOfficerSchema.createCollectionOfficerSchema.validate(
        req.body,
        {
          abortEarly: false,
          stripUnknown: true,
        },
      );

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        error: "Validation failed",
        details: errorMessages,
      });
    }

    const { id: irmId, role: jobRole } = req.user;

    const irmDetails = await collectionofficerDao.getIrmDetails(irmId, jobRole);
    if (!irmDetails) {
      return res.status(404).json({ error: "IRM details not found" });
    }
    const { companyId, centerId } = irmDetails;

    const nicExists = await collectionofficerDao.checkNICExist(
      req.body.nicNumber,
    );
    if (nicExists) {
      return res.status(400).json({ error: "NIC or Email already exists" });
    }

    const emailExists = await collectionofficerDao.checkEmailExist(
      req.body.email,
    );
    if (emailExists) {
      return res.status(400).json({ error: "Email already exists." });
    }

    const generatedEmpId = await collectionofficerDao.generateEmpId(
      req.body.jobRole,
    );

    const convertBase64ToBuffer = (base64String) => {
      try {
        const base64Data = base64String.includes(";base64,")
          ? base64String.split(";base64,").pop()
          : base64String;

        return Buffer.from(base64Data, "base64");
      } catch (error) {
        console.error("Error converting base64 to buffer:", error);
        throw new Error("Invalid base64 format");
      }
    };

    const generateUniqueFileName = (originalName) => {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);

      let fileExt = "jpg";
      if (originalName && originalName.includes(".")) {
        fileExt = originalName.split(".").pop();
      }

      return `${timestamp}-${randomStr}.${fileExt}`;
    };

    let profileImageUrl = null;
    if (req.body.profileImage) {
      try {
        const fileBuffer = convertBase64ToBuffer(req.body.profileImage);

        const fileName = generateUniqueFileName("profile.jpg");

        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "collection-officers/profile-images",
        );
      } catch (uploadError) {
        console.error("Error uploading image to S3:", uploadError);
        return res
          .status(400)
          .json({ error: "Invalid image format or upload failed" });
      }
    }

    const officerData = {
      ...req.body,
      empId: generatedEmpId,
      phoneNumber01: req.body.phoneNumber1,
      phoneNumber02: req.body.phoneNumber2 || null,
      nic: req.body.nicNumber,
      accHolderName: req.body.accountHolderName,
      accNumber: req.body.accountNumber,
      phoneCode01: req.body.phoneCode1,
      phoneCode02: req.body.phoneCode2 || null,
      profileImageUrl,
    };

    const resultsPersonal =
      await collectionofficerDao.createCollectionOfficerPersonal(
        officerData,
        centerId,
        companyId,
        irmId,
        jobRole,
      );

    return res.status(201).json({
      message: "Collection Officer created successfully",
      id: resultsPersonal.insertId,
      empId: generatedEmpId,
      status: true,
    });
  } catch (error) {
    console.error("Error creating collection officer:", error);
    return res.status(500).json({
      error: "An error occurred while creating the collection officer",
    });
  }
};

exports.getForCreateId = async (req, res) => {
  try {
    const { role } = req.params;

    let rolePrefix;

    if (role === "Collection Officer") {
      rolePrefix = "COO";
    } else if (role === "Distribution Officer") {
      rolePrefix = "DIO";
    }

    const results = await collectionofficerDao.getForCreateId(rolePrefix);

    if (results.length === 0) {
      return res.json({ result: { empId: "00001" }, status: true });
    }

    res.status(200).json({ result: results[0], status: true });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};

exports.getFarmerListByCollectionOfficerAndDate = async (req, res) => {
  const { collectionOfficerId, date } = req.query;

  if (!collectionOfficerId || !date) {
    return res.status(400).json({
      error: "Both collectionOfficerId and date are required.",
    });
  }

  try {
    const farmers =
      await collectionofficerDao.getFarmerListByCollectionOfficerAndDate(
        collectionOfficerId,
        date,
      );
    res.status(200).json(farmers);
  } catch (error) {
    console.error("Error fetching farmer list:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the farmer list" });
  }
};

exports.getFarmerListByCollectionOfficerAndDateForManager = async (
  req,
  res,
) => {
  const { date } = req.query;
  const collectionOfficerId = req.user.id;

  if (!date) {
    return res.status(400).json({
      error: "Date is required.",
    });
  }

  try {
    const farmers =
      await collectionofficerDao.getFarmerListByCollectionOfficerAndDate(
        collectionOfficerId,
        date,
      );
    res.status(200).json(farmers);
  } catch (error) {
    console.error("Error fetching farmer list:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the farmer list" });
  }
};

exports.getClaimOfficer = async (req, res) => {
  const { empID, jobRole } = req.body;
  const OfficercompanyId = req.user.companyId;

  try {
    const results = await collectionofficerDao.getClaimOfficer(
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
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Authorization token is missing" });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const irmId = decoded.id;
  const centerId = decoded.centerId;
  const mangerJobRole = decoded.role;

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

exports.disclaimOfficer = async (req, res) => {
  const { collectionOfficerId, jobRole } = req.body;

  if (!collectionOfficerId) {
    return res
      .status(400)
      .json({
        status: "error",
        message: "Missing collectionOfficerId in request body.",
      });
  }

  try {
    const results = await collectionofficerDao.disclaimOfficer(
      collectionOfficerId,
      jobRole,
    );
    if (results.affectedRows > 0) {
      res.status(200).json({
        status: "success",
        data: results,
        message: "Officer disclaimed successfully.",
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "Officer not found or already disclaimed.",
      });
    }
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).json({
      status: "error",
      message: "An error occurred while disclaiming the officer.",
    });
  }
};

exports.GetFarmerReportDetails = async (req, res) => {
  const { userId, createdAt, farmerId } = req.params;

  try {
    if (!userId || !createdAt || !farmerId) {
      return res
        .status(400)
        .json({
          error: "userId, createdAt, and farmerId parameters are required.",
        });
    }

    const cropDetails = await collectionofficerDao.GetFarmerReportDetailsDao(
      userId,
      createdAt,
      farmerId,
    );
    res.status(200).json(cropDetails);
  } catch (error) {
    console.error("Error fetching crop details:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching crop details" });
  }
};

exports.getCollectionOfficers = async (req, res) => {
  try {
    const managerId = req.user.id;

    const [rows] = await collectionofficerDao.getCollectionOfficers(managerId);

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No collection officers found for the given manager ID.",
      });
    }

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching collection officers:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching collection officers.",
    });
  }
};

exports.getCollectionOfficersReciever = async (req, res) => {
  try {
    const managerId = req.user.id;
    const companycenterId = req.user.companycenterId;
    const { varietyId, grade } = req.params;

    if (!varietyId || !grade) {
      return res.status(400).json({
        status: "error",
        message: "Variety ID and grade are required.",
      });
    }

    const [rows] = await collectionofficerDao.getCollectionOfficersReciever(
      managerId,
      companycenterId,
      varietyId,
      grade,
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message:
          "No collection officers found with targets for the given criteria.",
      });
    }

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching collection officers:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching collection officers.",
    });
  }
};

exports.getCollectionOfficersList = async (req, res) => {
  try {
    const managerId = req.user.id;
    const [rows] =
      await collectionofficerDao.getCollectionOfficersList(managerId);

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No collection officers found for the given manager ID.",
      });
    }

    res.status(200).json({
      status: "success",
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching collection officers:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching collection officers.",
    });
  }
};

exports.getFarmerPaymentsSummary = async (req, res) => {
  const schema = Joi.object({
    collectionOfficerId: Joi.number().integer().required(),
    fromDate: Joi.date().iso().required(),
    toDate: Joi.date().iso().required().min(Joi.ref("fromDate")).messages({
      "date.min": '"toDate" must be the same as or after "fromDate".',
    }),
  });

  try {
    const { collectionOfficerId, fromDate, toDate } = req.query;
    const { error } = schema.validate({
      collectionOfficerId,
      fromDate,
      toDate,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.details[0].message,
      });
    }

    const [rows] = await collectionofficerDao.getFarmerPaymentsSummary({
      collectionOfficerId,
      fromDate,
      toDate,
    });

    const reportData = rows.map((row) => ({
      date: new Date(row.date).toLocaleDateString("en-US", {
        timeZone: "Asia/Colombo",
      }),
      TCount: row.TCount,
      total: row.total ? parseFloat(row.total) : 0,
    }));

    res.status(200).json({
      status: "success",
      data: reportData,
    });
  } catch (error) {
    console.error("Error fetching daily report:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the report.",
    });
  }
};

exports.getOfficerDetailsForReport = async (req, res) => {
  const { empId } = req.params;

  if (!empId) {
    return res.status(400).json({
      status: "error",
      message: "Employee ID is required.",
    });
  }

  try {
    const [rows] = await collectionofficerDao.getOfficerDetails(empId);

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No employee found with the provided empId.",
      });
    }

    res.status(200).json({
      status: "success",
      data: rows[0],
    });
  } catch (error) {
    console.error("Error fetching employee details:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching employee details.",
    });
  }
};

exports.getofficeronline = async (req, res) => {
  const { collectionOfficerId } = req.params;

  try {
    const result =
      await collectionofficerDao.getOfficerOnlineStatus(collectionOfficerId);
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Error fetching officer status:", error);
    res
      .status(500)
      .json({
        success: false,
        error: "An error occurred while fetching officer status.",
      });
  }
};
