const packingDao = require("../dao/packing-dao");
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
