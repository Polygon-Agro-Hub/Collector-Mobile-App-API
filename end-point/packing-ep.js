const packingDao = require("../dao/packing-dao");
const invoicePdfEp = require("./invoice-pdf-ep");
const asyncHandler = require("express-async-handler");

/**
 * Get active packing rows with available position counts
 */
exports.getPackingRows = asyncHandler(async (req, res) => {
  const officerId = req.user.id;
  let companyCenterId = req.user.companycenterId;

  if (!companyCenterId) {
    companyCenterId = await packingDao.getCompanyCenterIdForOfficer(officerId);
  }

  if (!companyCenterId) {
    return res.status(400).json({
      success: false,
      message: "Could not find a company center associated with this officer."
    });
  }

  const rows = await packingDao.getPackingRowsForCenter(companyCenterId);

  res.status(200).json({
    success: true,
    message: "Packing rows retrieved successfully",
    data: rows
  });
});

/**
 * Get positions within a specific packing row
 */
exports.getRowPositions = asyncHandler(async (req, res) => {
  const { rowId } = req.params;

  if (!rowId || isNaN(rowId)) {
    return res.status(400).json({
      success: false,
      message: "Valid rowId is required"
    });
  }

  const positions = await packingDao.getPositionsForRow(Number(rowId));

  res.status(200).json({
    success: true,
    message: "Row positions retrieved successfully",
    data: positions
  });
});

/**
 * Assign logged-in officer to a position
 */
exports.assignPosition = asyncHandler(async (req, res) => {
  const officerId = req.user.id;
  const { positionId } = req.body;

  if (!positionId || isNaN(positionId)) {
    return res.status(400).json({
      success: false,
      message: "Valid positionId is required"
    });
  }

  try {
    const result = await packingDao.assignOfficerToPosition(officerId, Number(positionId));

    const io = req.app.get("io");
    if (io) {
      io.emit("rows_updated");
      io.emit("position_updated", { positionId: Number(positionId), status: "Occupied", officerId });
    }

    res.status(200).json({
      success: true,
      message: "Officer assigned to position successfully",
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to assign position"
    });
  }
});

/**
 * Get crops assigned to a specific packing position
 */
exports.getPositionCrops = asyncHandler(async (req, res) => {
  const { positionId } = req.params;

  if (!positionId || isNaN(positionId)) {
    return res.status(400).json({
      success: false,
      message: "Valid positionId is required"
    });
  }

  const crops = await packingDao.getCropsForPosition(Number(positionId));

  res.status(200).json({
    success: true,
    message: "Crops for position retrieved successfully",
    data: crops
  });
});

/**
 * Get target orders for QR Handling
 */
exports.getQROrders = asyncHandler(async (req, res) => {
  const officerId = req.user.id;
  const orders = await packingDao.getQROrdersForOfficer(officerId);

  res.status(200).json({
    success: true,
    message: "QR orders retrieved successfully",
    data: orders
  });
});

/**
 * Get active position assignment for logged-in officer
 */
exports.getOfficerActiveAssignment = asyncHandler(async (req, res) => {
  const officerId = req.user.id;
  const assignment = await packingDao.getOfficerActiveAssignment(officerId);

  res.status(200).json({
    success: true,
    message: "Officer active assignment retrieved successfully",
    data: assignment
  });
});

/**
 * Update distributedtargetitems.orderStatus = 'Opened' & set positiontracking.pIndex = 1
 */
exports.markOrderAsOpened = asyncHandler(async (req, res) => {
  const { orderId, orderpackageId, isPackage, packageIndex, isMainContainer, rowId } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "orderId is required"
    });
  }

  const result = await packingDao.markOrderAsOpened(
    Number(orderId),
    orderpackageId ? Number(orderpackageId) : null,
    isPackage !== undefined ? Number(isPackage) : null,
    packageIndex !== undefined ? Number(packageIndex) : 0,
    Boolean(isMainContainer)
  );

  if (result && result.success === false) {
    return res.status(200).json(result);
  }

  const io = req.app.get("io");
  if (io) {
    io.emit("order_opened", { orderId: Number(orderId), orderpackageId, isPackage, isMainContainer, orderStatus: "Opened", pIndex: 1 });
    if (rowId) io.to(`row_${rowId}`).emit("order_opened", { orderId: Number(orderId), orderpackageId, isPackage, isMainContainer, orderStatus: "Opened", pIndex: 1 });
  }

  res.status(200).json({
    success: true,
    message: "Order status updated to Opened and QR printed successfully.",
    data: result
  });
});

/**
 * Increment positiontracking.pIndex when packer completes or skips item
 */
exports.advancePositionIndex = asyncHandler(async (req, res) => {
  const { orderId, orderpackageId, currentPIndex, rowId } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "orderId is required"
    });
  }

  const result = await packingDao.advancePositionIndex(
    Number(orderId),
    orderpackageId ? Number(orderpackageId) : null,
    currentPIndex !== undefined ? Number(currentPIndex) : null
  );

  if (!result || !result.success || result.affectedRows === 0) {
    return res.status(200).json({
      success: false,
      message: result?.message || "The next station is currently busy or the package has already been cleared.",
      data: result
    });
  }

  const io = req.app.get("io");
  if (io) {
    io.emit("position_index_updated", { orderId: Number(orderId), orderpackageId, currentPIndex });
    if (rowId) io.to(`row_${rowId}`).emit("position_index_updated", { orderId: Number(orderId), orderpackageId, currentPIndex });
  }

  res.status(200).json({
    success: true,
    message: "Position advanced to next packer successfully.",
    data: result
  });
});

/**
 * Mark distributedtargetitems.orderStatus = 'Completed' when QC completes inspection
 */
exports.markOrderAsCompleted = asyncHandler(async (req, res) => {
  const { orderId, rowId } = req.body;
  const officerId = req.user?.id || null;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "orderId is required"
    });
  }

  const result = await packingDao.markOrderAsCompleted(Number(orderId), officerId);

  const io = req.app.get("io");
  if (io) {
    io.emit("order_completed", { orderId: Number(orderId), orderStatus: "Completed" });
    if (rowId) io.to(`row_${rowId}`).emit("order_completed", { orderId: Number(orderId), orderStatus: "Completed" });
  }

  // If the last box just completed QC → automatically send Post Invoice to customer's email
  if (result?.isFullyCompleted) {
    // Fire-and-forget: do NOT await so API response is not delayed
    invoicePdfEp.sendSinglePostInvoiceEmail(Number(orderId)).catch((err) => {
      console.error(`❌ Background invoice email failed for orderId=${orderId}:`, err);
    });
  }

  res.status(200).json({
    success: true,
    message: "QC inspection completed successfully. Order status updated to Completed.",
    data: result
  });
});

/**
 * Get tracking status for a process order
 */
exports.getOrderTrackingStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  if (!orderId || isNaN(orderId)) {
    return res.status(400).json({
      success: false,
      message: "Valid orderId parameter is required"
    });
  }

  const statusInfo = await packingDao.getOrderTrackingStatus(Number(orderId));

  res.status(200).json({
    success: true,
    message: "Order tracking status retrieved successfully",
    data: statusInfo
  });
});

/**
 * Get active process order for logged-in officer
 */
exports.getOfficerActiveOrder = asyncHandler(async (req, res) => {
  const officerId = req.user.id;
  const activeOrder = await packingDao.getOfficerActiveOrder(officerId);

  res.status(200).json({
    success: true,
    message: "Officer active order retrieved successfully",
    data: activeOrder
  });
});

/**
 * Get distribution center target orders
 */
exports.getCenterTarget = asyncHandler(async (req, res) => {
  const orders = await packingDao.getCenterTargetOrders();

  res.status(200).json({
    success: true,
    message: "Center target orders retrieved successfully",
    data: orders
  });
});

/**
 * Get detailed order tracking breakdown for OrderDetails screen
 */
exports.getOrderDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const details = await packingDao.getOrderDetails(Number(orderId));

  res.status(200).json({
    success: true,
    message: "Order details retrieved successfully",
    data: details
  });
});


