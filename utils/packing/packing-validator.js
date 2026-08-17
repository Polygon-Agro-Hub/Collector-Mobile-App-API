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
    JOIN market_place.processorders po ON pt.orderId = po.id
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

  // 2. Position 1 has at least 1 active box at pIndex = 1.
  // Check if the current request is re-printing the EXACT SAME physical box currently at pIndex = 1.
  
  // For Main Container:
  if (isMainContainer) {
    const isSameMain = activeP1Boxes.some(
      (box) => box.orderId === orderId && Number(box.isMainContainer) === 1
    );
    if (isSameMain) return null; // Allow re-print of Main Container
  }

  // For Package Box:
  if (validPackageId) {
    // Query all existing positiontracking rows for this orderpackageId ordered by id ASC
    const pkgTrackingRowsSql = `
      SELECT id, pIndex 
      FROM positiontracking 
      WHERE orderId = ? AND orderpackageId = ? AND isMainContainer = 0 
      ORDER BY id ASC
    `;
    const pkgTrackingRows = await new Promise((res, rej) => {
      connection.query(
        pkgTrackingRowsSql,
        [orderId, validPackageId],
        (err, results) => {
          if (err) return rej(err);
          res(results || []);
        }
      );
    });

    // Check if a tracking row already exists for packageBoxSubIndex and if IT is the row at pIndex = 1
    const targetRow = pkgTrackingRows[packageBoxSubIndex];
    if (targetRow && Number(targetRow.pIndex) === 1) {
      // Re-printing the exact package box that is currently at P1 -> Allow
      return null;
    }
  }

  // For À la carte Box:
  if (!isMainContainer && !validPackageId) {
    const isSameAlacarte = activeP1Boxes.some(
      (box) =>
        box.orderId === orderId &&
        box.orderpackageId === null &&
        Number(box.isMainContainer) === 0
    );
    if (isSameAlacarte) return null; // Allow re-print of À la carte box
  }

  // Otherwise, Position 1 is currently busy with a different or previous box -> BLOCK!
  const occupiedInv = activeP1Boxes[0].invNo;
  return {
    success: false,
    code: PACKING_ERROR_CODES.STATION_OCCUPIED,
    occupiedInvoice: occupiedInv,
    message: `Packing Position 1 is currently busy with Invoice ${occupiedInv}. Please wait until Position 1 completes its current box before generating the next QR code.`,
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
    JOIN market_place.processorders po ON pt.orderId = po.id
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
