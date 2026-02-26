const jwt = require("jsonwebtoken");
const userAuthDao = require("../dao/userAuth-dao");
const bcrypt = require("bcrypt");
const { loginSchema } = require("../Validations/Auth-validations");
const { Socket } = require("socket.io");
const uploadFileToS3 = require("../Middlewares/s3upload");
const delectfilesOnS3 = require("../Middlewares/s3delete");

exports.loginUser = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.details[0].message,
      });
    }

    let { empId, password } = req.body;
    empId = empId.trim().toUpperCase();

    let collectionOfficerResult;
    try {
      collectionOfficerResult = await userAuthDao.getOfficerByEmpId(empId);
    } catch (error) {
      console.error("Error fetching Employee ID:", error.message);
      return res.status(404).json({
        status: "error",
        message: error.message,
      });
    }

    const collectionOfficerId = collectionOfficerResult?.[0]?.id;
    const jobRole = collectionOfficerResult?.[0]?.jobRole;
    const accountStatus = collectionOfficerResult?.[0]?.status;

    if (!collectionOfficerId) {
      return res.status(404).json({
        status: "error",
        message: "Invalid Employee ID",
      });
    }

    if (accountStatus !== "Approved") {
      return res.status(403).json({
        status: "error",
        message: "This EMP ID is not approved.",
        accountStatus: accountStatus,
      });
    }

    const users = await userAuthDao.getOfficerPasswordById(
      collectionOfficerId,
      jobRole,
    );

    if (!users || users.length === 0) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    const officer = users[0];

    const centerId = officer.centerId;
    const distributionCenterId = officer.distributedCenterId;

    const isPasswordValid = await bcrypt.compare(password, officer.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Invalid password",
      });
    }

    let center;
    const normalizedJobRole = jobRole.toLowerCase();
    if (
      normalizedJobRole === "collection officer" ||
      normalizedJobRole === "collection centre manager"
    ) {
      center = centerId;
    } else if (
      normalizedJobRole === "distribution centre manager" ||
      normalizedJobRole === "distribution officer"
    ) {
      center = distributionCenterId;
    }

    const payload = {
      id: officer.id,
      email: officer.email,
      firstNameEnglish: officer.firstNameEnglish,
      lastNameEnglish: officer.lastNameEnglish,
      phoneNumber01: officer.phoneNumber01,
      centerId: center,
      companyId: officer.companyId,
      empId: officer.empId,
      role: officer.jobRole,
      companycenterId: officer.companycenterId,
      accountStatus: accountStatus,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || "T1", {
      expiresIn: "10h",
    });

    const passwordUpdateRequired = !officer.passwordUpdated;

    const response = {
      status: "success",
      message: passwordUpdateRequired
        ? "Login successful, but password update is required"
        : "Login successful",
      officer: payload,
      passwordUpdateRequired,
      token,
      userId: officer.id,
      jobRole: jobRole,
      empId: officer.empId,
      companyNameEnglish: officer.companyNameEnglish,
      companyNameSinhala: officer.companyNameSinhala,
      companyNameTamil: officer.companyNameTamil,
      accountStatus: accountStatus,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Login Error:", err);

    if (err.isJoi) {
      return res.status(400).json({
        status: "error",
        message: err.details[0].message,
      });
    }

    res.status(500).json({
      status: "error",
      message: "An error occurred during login.",
    });
  }
};

exports.updatePassword = async (req, res) => {
  const officerId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const users = await userAuthDao.getOfficerByEmpIdChangePass(officerId);

    const officer = users[0];

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      officer.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Current password is incorrect",
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await userAuthDao.updatePasswordInDatabase(officerId, hashedPassword);

    res.status(200).json({
      status: "success",
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error updating password:", error);

    if (error.message === "Database query failed. Please try again.") {
      return res.status(500).json({
        status: "error",
        message: "Database error occurred while updating the password",
      });
    } else if (error.message === "Officer not found") {
      return res.status(404).json({
        status: "error",
        message: "Officer details not found",
      });
    } else if (error === "Database error while updating password") {
      return res.status(500).json({
        status: "error",
        message: "Database error occurred while updating the password",
      });
    } else {
      return res.status(500).json({
        status: "error",
        message: "An error occurred while updating the password",
      });
    }
  }
};

exports.getProfile = async (req, res) => {
  try {
    const officerId = req.user.id;
    const jobRole = req.user.role;

    if (!officerId) {
      return res
        .status(400)
        .json({ status: "error", message: "Officer ID is required" });
    }

    const officerDetails = await userAuthDao.getOfficerDetailsById(
      officerId,
      jobRole,
    );

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

exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await userAuthDao.getUserDetailsById(userId);

    res.status(200).json({
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      regcode: user.regcode,
      jobRole: user.jobRole,
      nicNumber: user.nicNumber,
      address: user.address,
      phoneNumber: user.phoneNumber,
      empid: user.empid,
    });
  } catch (error) {
    console.error("Error in getUserDetails controller:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updatePhoneNumber = async (req, res) => {
  const userId = req.user.id;
  const { phoneNumber, phoneNumber2 } = req.body;

  const validatePhoneNumber = (number) =>
    number && typeof number === "string" && number.length === 9;

  if (!validatePhoneNumber(phoneNumber) && !validatePhoneNumber(phoneNumber2)) {
    return res.status(400).json({
      message:
        "Invalid phone numbers. At least one valid 11-character phone number is required.",
    });
  }

  try {
    const results = await userAuthDao.updatePhoneNumberById(
      userId,
      phoneNumber,
      phoneNumber2,
    );

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Phone number updated successfully" });
  } catch (error) {
    console.error("Error updating phone number:", error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the phone number" });
  }
};

exports.getOfficerQRCode = async (req, res) => {
  const officerId = req.user.id;

  try {
    const results = await userAuthDao.getQRCodeByOfficerId(officerId);

    if (results.length === 0) {
      return res.status(404).json({ error: "Officer not found" });
    }

    const { QRcode } = results[0];
    if (!QRcode) {
      return res
        .status(404)
        .json({ error: "QR code not available for this officer" });
    }

    const qrCodeBase64 = QRcode.toString("base64");

    res.status(200).json({
      message: "Officer QR code retrieved successfully",
      QRcode: `data:image/png;base64,${qrCodeBase64}`,
    });
  } catch (error) {
    console.error("Error fetching officer QR code:", error.message);
    res.status(500).json({ error: "Failed to fetch officer QR code" });
  }
};

exports.GetClaimStatus = async (req, res) => {
  const { id: userId } = req.user;

  try {
    if (!userId) {
      return res.status(400).json({ error: "User ID is missing." });
    }

    const claimStatus = await userAuthDao.getClaimStatusByUserId(userId);

    if (claimStatus === null) {
      return res
        .status(404)
        .json({ error: "User not found or claim status unavailable." });
    }

    res.status(200).json({ userId, claimStatus });
  } catch (error) {
    console.error("Error fetching claim status:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching claim status." });
  }
};

exports.updateOnlineStatus = async (req, res) => {
  try {
    const { empId, status } = req.body;
    const result = await userAuthDao.updateOnlineStatusWithSocket(
      empId,
      status,
    );

    if (result === null) {
      return res.status(404).json({ error: "User not found." });
    }

    return res
      .status(200)
      .json({ message: "Officer status updated successfully." });
  } catch (error) {
    console.error("Error updating online status:", error);
    res
      .status(500)
      .json({ error: "An error occurred while updating online status." });
  }
};

exports.uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;

    const existingProfileImage = await userAuthDao.getUserProfileImage(userId);
    if (existingProfileImage) {
      delectfilesOnS3(existingProfileImage);
    }

    let profileImageUrl = null;

    if (req.file) {
      const fileName = req.file.originalname;
      const imageBuffer = req.file.buffer;

      const uploadedImage = await uploadFileToS3(
        imageBuffer,
        fileName,
        "collectionofficer/image",
      );
      profileImageUrl = uploadedImage;
    } else {
    }
    await userAuthDao.updateUserProfileImage(userId, profileImageUrl);

    res.status(200).json({
      status: "success",
      message: "Profile image uploaded successfully",
      profileImageUrl,
    });
  } catch (err) {
    console.error("Error uploading profile image:", err);

    if (err.isJoi) {
      return res.status(400).json({
        status: "error",
        message: err.details[0].message,
      });
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getPassword = async (req, res) => {
  const id = req.user.id;
  try {
    const user = await userAuthDao.getPassword(id);
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
