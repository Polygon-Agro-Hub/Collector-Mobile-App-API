const targetDDao = require("../../dao/distribution/distribution-manager-dao");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const distributionofficerDao = require("../../dao/distribution/distribution-manager-dao");
const collectionofficerDao = require("../../dao/common/manager-dao");
const asyncHandler = require("express-async-handler");
const pushNotificationService = require("../../services/pushNotificationService");
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

exports.getNotifications = async (req, res) => {
  try {
    const officerId = req.user.id;
    if (!officerId) {
      return res.status(400).json({
        success: false,
        message: "Officer ID is required",
      });
    }

    const notifications =
      await distributionofficerDao.getHandoverReturnNotifications(officerId);

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

exports.markNotificationAsRead = async (req, res) => {
  try {
    const officerId = req.user.id;
    const notificationId = req.params.id || req.body.id;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    await targetDDao.markNotificationAsRead(notificationId, officerId);

    res.status(200).json({
      success: true,
      message: "Notification marked as read successfully",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const officerId = req.user.id;

    await targetDDao.markAllNotificationsAsRead(officerId);

    res.status(200).json({
      success: true,
      message: "All notifications marked as read successfully",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

exports.savePushToken = async (req, res) => {
  try {
    const officerId = req.user?.id || req.user?.officerId;
    const { pushToken, tokenType, deviceType, marketplaceUserId } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: "pushToken is required",
      });
    }

    // Determine target user type (marketplace user vs collection officer)
    const effectiveMktUserId = marketplaceUserId || req.user?.marketplaceUserId;
    if (effectiveMktUserId) {
      await pushNotificationService.saveMarketplaceUserPushToken(
        effectiveMktUserId,
        pushToken,
        deviceType
      );
    } else if (officerId) {
      await pushNotificationService.saveOfficerPushToken(
        officerId,
        pushToken,
        deviceType
      );
    } else {
      return res.status(400).json({
        success: false,
        message: "officerId or marketplaceUserId is required",
      });
    }

    res.status(200).json({
      success: true,
      message: "Push token registered successfully",
    });
  } catch (error) {
    console.error("Error saving push token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save push token",
      error: error.message,
    });
  }
};

exports.sendTestPush = async (req, res) => {
  try {
    const officerId = req.user?.id || req.user?.officerId;
    const { title, body, data, marketplaceUserId } = req.body;

    let result;
    if (marketplaceUserId) {
      result = await pushNotificationService.sendPushToMarketplaceUser(marketplaceUserId, {
        title: title || "Test Notification",
        body: body || "This is a test notification for marketplace user.",
        data: data || { test: true },
      });
    } else {
      result = await pushNotificationService.sendPushToOfficer(officerId, {
        title: title || "Return Order OTP",
        body: body || "Please use OTP to receive return order at the centre.",
        data: data || { test: true },
      });
    }

    res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Error sending test push:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send test push",
      error: error.message,
    });
  }
};

/**
 * Real-time Return OTP notification webhook called by Transporter Mobile API.
 * Emits instant Socket.IO push to the target DCM's room.
 */
exports.notifyReturnOtp = async (req, res) => {
  try {
    const { id, officerId, dcmEmpId, invNo, otpCode, createdAt } = req.body;

    const payload = {
      id: Number(id),
      invNo: invNo || "",
      invoiceNo: invNo || "",
      otpCode: String(otpCode || ""),
      otp: String(otpCode || ""),
      officerId: officerId ? Number(officerId) : undefined,
      dcmEmpId: dcmEmpId || "",
      title: "Handover Return Order OTP",
      message: `Please use the following OTP code, "${otpCode}", to receive the order from the driver at the centre.`,
      createdAt: createdAt || new Date().toISOString(),
      isRead: 0,
    };

    const io = req.app.get("io");
    if (io) {
      const rooms = [];
      if (officerId) rooms.push(`user_${officerId}`);
      if (dcmEmpId) rooms.push(`user_${dcmEmpId}`);

      if (rooms.length > 0) {
        io.to(rooms).emit("new_return_otp", payload);
        io.to(rooms).emit("handover_return_otp", payload);
        io.to(rooms).emit("new_notification", payload);
        io.to(rooms).emit("newNotification", payload);
        console.log(`📢 [Socket] Emitted real-time return OTP notification to ${rooms.join(", ")}:`, payload);
      } else {
        io.emit("new_return_otp", payload);
        io.emit("new_notification", payload);
      }
    }

    if (officerId) {
      pushNotificationService.sendPushToOfficer(Number(officerId), {
        title: payload.title,
        body: payload.message,
        data: {
          type: "return_order_otp",
          otpCode: String(otpCode || ""),
          invNo: invNo || "",
          id: String(id || ""),
        },
      }).catch((err) => console.error("Error sending push in notifyReturnOtp:", err));
    }

    return res.status(200).json({
      success: true,
      message: "Return OTP socket notification dispatched successfully.",
      data: payload,
    });
  } catch (error) {
    console.error("Error in notifyReturnOtp:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to dispatch return OTP notification",
      error: error.message,
    });
  }
};

