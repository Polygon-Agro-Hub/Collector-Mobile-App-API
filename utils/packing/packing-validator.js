const { PACKING_ERROR_CODES } = require("./error-codes");

/**
 * Validates whether Position 1 (pIndex = 1) is currently busy with an active box.
 * Allows re-printing the exact box currently sitting at pIndex = 1,
 * but blocks passing any new or next package box while Position 1 is busy.
 *
 * @param {Object} connection MySQL connection object
 * @param {number} orderId Target orderId (processorders.id)
 * @param {number|null} validPackageId Valid orderpackageId if applicable
 * @param {boolean} isMainContainer True if Main Container box
 * @param {number} packageBoxSubIndex Sub-index of box for packages with qty > 1 (0-based)
 * @returns {Promise<Object|null>} Returns occupied error object or null if free
 */
const validatePosition1Busy = async (
  connection,
  orderId,
  validPackageId = null,
  isMainContainer = false,
  packageBoxSubIndex = 0
) => {
  // 1. Query any box currently sitting at pIndex = 1 for the packing row of this order
  const checkOccupiedSql = `
    SELECT 
      pt.id AS trackingId, 
      pt.orderId, 
      pt.orderpackageId, 
      pt.isMainContainer, 
      pt.pIndex, 
      po.invNo
    FROM positiontracking pt
    JOIN processorders po ON pt.orderId = po.id
    JOIN distributedtargetitems dti ON dti.orderId = po.id
    JOIN distributedtarget dt ON dti.targetId = dt.id
    WHERE dt.rowId = (
      SELECT dt2.rowId 
      FROM distributedtargetitems dti2 
      JOIN distributedtarget dt2 ON dti2.targetId = dt2.id 
      WHERE dti2.orderId = ? LIMIT 1
    ) 
    AND DATE(dt.createdAt) = (
      SELECT DATE(dt3.createdAt)
      FROM distributedtargetitems dti3
      JOIN distributedtarget dt3 ON dti3.targetId = dt3.id
      WHERE dti3.orderId = ? LIMIT 1
    )
    AND pt.pIndex = 1 
    AND dti.orderStatus = 'Opened'
  `;

  const activeP1Boxes = await new Promise((res, rej) => {
    connection.query(checkOccupiedSql, [orderId, orderId], (err, results) => {
      if (err) return rej(err);
      res(results || []);
    });
  });

  if (!activeP1Boxes || activeP1Boxes.length === 0) {
    // Position 1 is completely free!
    return null;
  }

  // 2. Position 1 has an active box. Is it the SAME box the user is trying to pass?
  const currentP1 = activeP1Boxes[0];
  const occupiedInv = currentP1.invNo || "Unknown";

  const isSameOrder = Number(currentP1.orderId) === Number(orderId);
  const isSamePackage =
    validPackageId !== null
      ? Number(currentP1.orderpackageId) === Number(validPackageId)
      : currentP1.orderpackageId === null;
  const isSameMainContainer = Boolean(currentP1.isMainContainer) === Boolean(isMainContainer);

  if (isSameOrder && isSamePackage && isSameMainContainer) {
    // Exact same box re-attempt / reprint allowed
    return null;
  }

  // Position 1 is occupied by a different box/order
  return {
    success: false,
    isOccupied: true,
    code: PACKING_ERROR_CODES.POSITION_1_BUSY,
    occupiedInvoice: occupiedInv,
    message: `Position 1 is currently busy with Invoice ${occupiedInv}. Please wait until Position 1 clears before passing the next box.`
  };
};

/**
 * Validates whether the next position (nextStep, e.g. Position 2, QC, etc.) is currently occupied by an active box.
 * Blocks advancing a box from current station to nextStep if nextStep has an active box sitting at pIndex = nextStep.
 *
 * @param {Object} dbInstance Database instance or connection
 * @param {number} orderId Target orderId
 * @param {number} nextStep Next pIndex station target
 * @param {string} targetStationName Human-readable target station name (e.g. "QC Station")
 * @returns {Promise<Object|null>} Returns occupied error object or null if free
 */
const validateNextPositionBusy = async (dbInstance, orderId, nextStep, targetStationName) => {
  const checkOccupiedSql = `
    SELECT pt.id, pt.orderpackageId, pt.orderId, pt.pIndex, po.invNo
    FROM positiontracking pt
    JOIN processorders po ON pt.orderId = po.id
    JOIN distributedtargetitems dti ON pt.orderId = dti.orderId
    JOIN distributedtarget dt ON dti.targetId = dt.id
    WHERE dt.rowId = (
      SELECT dt_sub.rowId 
      FROM distributedtargetitems dti_sub
      JOIN distributedtarget dt_sub ON dti_sub.targetId = dt_sub.id
      WHERE dti_sub.orderId = ? LIMIT 1
    )
    AND DATE(dt.createdAt) = (
      SELECT DATE(dt_sub2.createdAt)
      FROM distributedtargetitems dti_sub2
      JOIN distributedtarget dt_sub2 ON dti_sub2.targetId = dt_sub2.id
      WHERE dti_sub2.orderId = ? LIMIT 1
    )
    AND dti.orderStatus = 'Opened'
    AND pt.pIndex = ?
    LIMIT 1
  `;

  const activeRows = await new Promise((res) => {
    dbInstance.query(checkOccupiedSql, [orderId, orderId, nextStep], (err, results) => {
      res(results || []);
    });
  });

  if (activeRows && activeRows.length > 0) {
    const occupiedInv = activeRows[0].invNo;
    return {
      success: false,
      isOccupied: true,
      code: PACKING_ERROR_CODES.STATION_OCCUPIED,
      occupiedInvoice: occupiedInv,
      message: `The ${targetStationName} is currently busy with Invoice ${occupiedInv}. Please wait until they clear their current box.`
    };
  }

  return null;
};

module.exports = {
  validatePosition1Busy,
  validateNextPositionBusy,
};
