const jwt = require("jsonwebtoken");
const userAuthDao = require("../../dao/common/user-auth-dao");
const bcrypt = require("bcrypt");
const {
  loginSchema,
  refreshTokenSchema,
} = require("../../validation/auth-validation");
const { ROLES } = require("../../constants/user-roles");
const authMiddleware = require("../../middleware/auth.middleware");

// ─── Token Expiration Constants ──────────────────────────────────────────────
// Modify token expiration times directly via these constants (e.g. "16h", "14d", or "30s" for testing):
const ACCESS_TOKEN_EXPIRY = "16h";
const REFRESH_TOKEN_EXPIRY = "14d";

exports.ACCESS_TOKEN_EXPIRY = ACCESS_TOKEN_EXPIRY;
exports.REFRESH_TOKEN_EXPIRY = REFRESH_TOKEN_EXPIRY;

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

    const ALLOWED_ROLES = Object.values(ROLES).map((r) => r.toLowerCase());

    if (!jobRole || !ALLOWED_ROLES.includes(jobRole.toLowerCase())) {
      return res.status(403).json({
        status: "error",
        reason: "role_not_allowed",
        message:
          "Access denied. Your role is not authorized to use this application.",
        jobRole: jobRole,
      });
    }

    if ((accountStatus || "").toLowerCase() !== "approved") {
      return res.status(403).json({
        status: "error",
        reason: "not_approved",
        message: "This EMP ID is not approved.",
        accountStatus: accountStatus || "Unknown",
        jobRole: jobRole,
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
      status: accountStatus,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const refreshPayload = {
      id: officer.id,
      empId: officer.empId,
      role: officer.jobRole,
      tokenType: "refresh",
      type: "refresh",
    };
    const refreshToken = jwt.sign(refreshPayload, refreshSecret, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 16 * 60 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    const passwordUpdateRequired = !officer.passwordUpdated;

    const response = {
      success: true,
      status: "success",
      message: passwordUpdateRequired
        ? "Login successful, but password update is required"
        : "Login successful",
      data: {
        token,
        refreshToken,
        id: officer.id,
        empId: officer.empId,
        jobRole: jobRole,
        passwordUpdate: passwordUpdateRequired,
      },
      officer: payload,
      passwordUpdateRequired,
      token,
      refreshToken,
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

exports.notifyStatusChanged = async (req, res) => {
  try {
    const { userId, empId, status, message } = req.body;

    if (!userId && !empId) {
      return res.status(400).json({
        success: false,
        message: "userId or empId is required in request body.",
      });
    }

    const resolvedUserId = userId || null;
    const resolvedEmpId = empId || null;
    const targetStatus = status || "Rejected";

    // Invalidate in-memory status cache so next request queries fresh DB status immediately
    if (resolvedUserId && authMiddleware.clearCache) {
      authMiddleware.clearCache(resolvedUserId);
    }

    const payload = {
      userId: resolvedUserId,
      empId: resolvedEmpId,
      status: targetStatus,
      accountStatus: targetStatus,
      message:
        message ||
        (targetStatus === "Rejected"
          ? "Your account has been rejected by administration."
          : `Your account status has changed to ${targetStatus}.`),
      timestamp: new Date().toISOString(),
    };

    const io = req.app.get("io");
    if (io) {
      const rooms = new Set();
      if (resolvedUserId) rooms.add(`user_${resolvedUserId}`);
      if (resolvedEmpId) rooms.add(`user_${resolvedEmpId}`);

      rooms.forEach((room) => {
        io.to(room).emit("officer_status_changed", payload);
        io.to(room).emit("account_status_changed", payload);
        io.to(room).emit("user_status_changed", payload);
        console.log(`[Socket] Emitted status change to ${room}:`, payload);
      });

      // If rejected, forcibly disconnect socket connection from server side
      if (targetStatus === "Rejected") {
        setTimeout(() => {
          rooms.forEach((room) => {
            io.in(room).disconnectSockets(true);
            console.log(`[Socket] Forcibly disconnected sockets in ${room}`);
          });
        }, 1200); // 1.2-second delay allows the client to receive the rejection event first
      }
    } else {
      console.warn("[Socket] 'io' instance not found on req.app");
    }

    return res.status(200).json({
      success: true,
      message: "Status change notification dispatched successfully.",
      data: payload,
    });
  } catch (error) {
    console.error("Error in notifyStatusChanged:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while notifying status change.",
      error: error.message,
    });
  }
};

/**
 * Refreshes an expired 12-hour access token using a valid 4-day refresh token.
 * Validates cryptographic signature, token type, live officer account status,
 * and issues a fresh 16-hour access token and rotated 14-day refresh token.
 */
exports.refreshAccessToken = async (req, res) => {
  try {
    const { error } = refreshTokenSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        status: "error",
        code: "VALIDATION_ERROR",
        message: error.details[0].message,
      });
    }

    const { refreshToken } = req.body;
    const refreshSecret =
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        status: "error",
        code: "INVALID_REFRESH_TOKEN",
        message: "Invalid or expired refresh token",
      });
    }

    if (
      !decoded ||
      !decoded.id ||
      (decoded.tokenType !== "refresh" && decoded.type !== "refresh")
    ) {
      return res.status(401).json({
        success: false,
        status: "error",
        code: "INVALID_REFRESH_TOKEN",
        message: "Invalid refresh token",
      });
    }

    // Live account status check
    const officerStatus = await userAuthDao.getOfficerStatusById(decoded.id);
    if (!officerStatus) {
      return res.status(401).json({
        status: "error",
        code: "ACCOUNT_NOT_FOUND",
        message: "Account not found.",
      });
    }

    const rawStatus = (officerStatus.status || "").toLowerCase();
    if (rawStatus !== "approved") {
      return res.status(403).json({
        status: "error",
        code:
          rawStatus === "rejected" || rawStatus === "banned"
            ? "ACCOUNT_BANNED"
            : "NOT_APPROVED",
        message: `Account is ${officerStatus.status || "not approved"}. Access denied.`,
      });
    }

    const ALLOWED_ROLES = Object.values(ROLES).map((r) => r.toLowerCase());
    if (
      !officerStatus.jobRole ||
      !ALLOWED_ROLES.includes(officerStatus.jobRole.toLowerCase())
    ) {
      return res.status(403).json({
        status: "error",
        code: "ROLE_NOT_ALLOWED",
        message: "Your role is not authorized to use this application.",
      });
    }

    // Fetch full officer details with company & center mappings
    const officers = await userAuthDao.getOfficerPasswordById(
      officerStatus.id,
      officerStatus.jobRole
    );

    if (!officers || officers.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Officer details not found.",
      });
    }

    const officer = officers[0];
    let center;
    const normalizedJobRole = (officer.jobRole || "").toLowerCase();
    if (
      normalizedJobRole === "collection officer" ||
      normalizedJobRole === "collection centre manager"
    ) {
      center = officer.centerId;
    } else if (
      normalizedJobRole === "distribution centre manager" ||
      normalizedJobRole === "distribution officer"
    ) {
      center = officer.distributedCenterId;
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
      accountStatus: officer.status,
      status: officer.status,
    };

    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const newRefreshPayload = {
      id: officer.id,
      empId: officer.empId,
      role: officer.jobRole,
      tokenType: "refresh",
      type: "refresh",
    };

    const newRefreshToken = jwt.sign(newRefreshPayload, refreshSecret, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    res.cookie("authToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 16 * 60 * 60 * 1000,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      status: "success",
      message: "Token refreshed successfully",
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
      },
      token: newAccessToken,
      refreshToken: newRefreshToken,
      officer: payload,
    });
  } catch (error) {
    console.error("Error in refreshAccessToken:", error);
    return res.status(500).json({
      status: "error",
      message: "An error occurred while refreshing the token.",
    });
  }
};

