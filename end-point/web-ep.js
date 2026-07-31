const webDao = require("../dao/web-dao");
const asyncHandler = require("express-async-handler");

/**
 * DCM Web Login Controller
 */
exports.dcmLogin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Username and password are required.",
    });
  }

  const result = await webDao.dcmLogin(username, password);
  if (!result.success) {
    return res.status(401).json(result);
  }

  res.status(200).json(result);
});

/**
 * Get Available Rows Overview
 */
exports.getAvailableRows = asyncHandler(async (req, res) => {
  const { companyCenterId } = req.query;
  const rows = await webDao.getAvailableRows(companyCenterId ? Number(companyCenterId) : null);
  res.status(200).json({
    success: true,
    data: rows,
  });
});

/**
 * Get Live Row Monitor Data for specified rowId
 */
exports.getRowLiveMonitor = asyncHandler(async (req, res) => {
  const { rowId } = req.params;
  if (!rowId) {
    return res.status(400).json({
      success: false,
      message: "rowId is required.",
    });
  }

  const monitorData = await webDao.getRowLiveMonitor(Number(rowId));
  res.status(200).json({
    success: true,
    data: monitorData,
  });
});

/**
 * Get full package and item details for a process order (Web view)
 */
exports.getWebOrderDetails = asyncHandler(async (req, res) => {
  const { processOrderId } = req.params;
  if (!processOrderId) {
    return res.status(400).json({
      success: false,
      message: "processOrderId is required.",
    });
  }

  const details = await webDao.getWebOrderDetails(Number(processOrderId));
  if (!details) {
    return res.status(404).json({
      success: false,
      message: "Order details not found.",
    });
  }

  res.status(200).json({
    success: true,
    data: details,
  });
});
