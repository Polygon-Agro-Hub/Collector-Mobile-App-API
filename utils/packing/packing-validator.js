const { PACKING_ERROR_CODES } = require("./error-codes");

/**
 * Validates whether Position 1 (pIndex = 1) has capacity for a new box.
 *
 * Rules:
 *  - Counts how many officers are actively assigned to pIndex=1 in this row today (capacity).
 *  - Counts how many boxes are currently sitting at pIndex=1 in this row (load).
 *  - If load < capacity → P1 has a free slot, allow print (return null).
 *  - If load >= capacity → P1 is fully busy, return busy error with occupied invoices.
 *  - Exception: if the exact same box (same orderId + packageId + isMainContainer) is already
 *    at pIndex=1, it's a re-print attempt → always allow (return null).
 *
 * @param {Object} connection  MySQL connection object
 * @param {number} orderId     processorders.id
 * @param {number|null} validPackageId  orderpackageId, or null for alacarte / main container
 * @param {boolean} isMainContainer
 * @param {number} packageBoxSubIndex  0-based sub-index for multi-qty packages (unused here, kept for API compat)
 * @returns {Promise<Object|null>}  null = allowed, error object = blocked
 */
const validatePosition1Busy = async (
  connection,
  orderId,
  validPackageId = null,
  isMainContainer = false,
  packageBoxSubIndex = 0
) => {
  // ── Step 1: Get the rowId for this order ──────────────────────────────────
  const getRowSql = `
    SELECT dt.rowId, DATE(dt.createdAt) AS targetDate
    FROM distributedtargetitems dti
    JOIN distributedtarget dt ON dti.targetId = dt.id
    WHERE dti.orderId = ?
    LIMIT 1
  `;
  const rowRows = await new Promise((res, rej) => {
    connection.query(getRowSql, [orderId], (err, results) => {
      if (err) return rej(err);
      res(results || []);
    });
  });

  if (!rowRows || rowRows.length === 0) {
    // Order not yet assigned — let the rest of the flow handle this
    return null;
  }

  const { rowId, targetDate } = rowRows[0];

  // ── Step 2: Count P1 officer capacity for this row today ──────────────────
  // How many officers are currently assigned (isFinished=1) to pIndex=1 NOR positions in this row?
  const capacitySql = `
    SELECT COUNT(DISTINCT tp.officerId) AS capacity
    FROM targetposition tp
    JOIN packingpositions pp ON tp.positionId = pp.id
    WHERE pp.rowId = ?
      AND pp.pIndex = 1
      AND pp.pType = 'NOR'
      AND tp.isFinished = 1
      AND tp.officerId IS NOT NULL
      AND DATE(CONVERT_TZ(tp.createdAt, '+00:00', '+05:30')) = ?
  `;
  const capacityRows = await new Promise((res, rej) => {
    connection.query(capacitySql, [rowId, targetDate], (err, results) => {
      if (err) return rej(err);
      res(results || []);
    });
  });
  const capacity = Number(capacityRows[0]?.capacity || 1); // Default 1 if no officer data

  // ── Step 3: Count boxes currently at pIndex=1 in this row ─────────────────
  const loadSql = `
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
    WHERE dt.rowId = ?
      AND DATE(CONVERT_TZ(dt.createdAt, '+00:00', '+05:30')) = ?
      AND pt.pIndex = 1
      AND dti.orderStatus = 'Opened'
  `;
  const activeP1Boxes = await new Promise((res, rej) => {
    connection.query(loadSql, [rowId, targetDate], (err, results) => {
      if (err) return rej(err);
      res(results || []);
    });
  });

  // ── Step 4: Check for re-print vs next copy of same package ────────────
  const samePackageBoxesAtP1 = activeP1Boxes.filter((b) => {
    const sameOrder = Number(b.orderId) === Number(orderId);
    const samePkg =
      validPackageId !== null
        ? Number(b.orderpackageId) === Number(validPackageId)
        : b.orderpackageId === null;
    const sameMain = Boolean(b.isMainContainer) === Boolean(isMainContainer);
    return sameOrder && samePkg && sameMain;
  });

  if (samePackageBoxesAtP1.length > 0) {
    // If a box for this package is sitting right at pIndex = 1:
    // Check if user is requesting to print the NEXT copy (e.g., box 2 with packageBoxSubIndex > 0)
    // or if the number of already opened/printed copies indicates this is a next box
    const subIdx = Number(packageBoxSubIndex) || 0;
    if (subIdx > 0) {
      // User is explicitly printing Box 2, 3, etc., but Box 1 is still at Position 1!
      const currentBox = samePackageBoxesAtP1[0];
      const occupiedInv = currentBox.invNo || "this order";
      return {
        success: false,
        isOccupied: true,
        code: PACKING_ERROR_CODES.STATION_OCCUPIED,
        targetPosition: 1,
        targetStationName: "Packing Position 1",
        occupiedInvoice: currentBox.invNo || null,
        message: `Packing Position 1 is currently busy with Box ${subIdx} of this package (Invoice ${occupiedInv}). Please wait until Position 1 clears before passing the next box.`
      };
    }

    // Otherwise, check how many boxes for this package have already reached pIndex >= 1
    const checkPkgTrackingSql = `
      SELECT COUNT(*) AS activeCount
      FROM positiontracking
      WHERE orderId = ? 
        AND ${validPackageId !== null ? "orderpackageId = ?" : "orderpackageId IS NULL"}
        AND isMainContainer = ?
        AND pIndex >= 1
    `;
    const checkParams = validPackageId !== null
      ? [orderId, validPackageId, isMainContainer ? 1 : 0]
      : [orderId, isMainContainer ? 1 : 0];

    const [pkgTrackingRes] = await new Promise((res, rej) => {
      connection.query(checkPkgTrackingSql, checkParams, (err, results) => {
        if (err) return rej(err);
        res(results || []);
      });
    });

    const activeCountForThisPkg = Number(pkgTrackingRes?.activeCount || 0);

    // If activeCountForThisPkg > samePackageBoxesAtP1.length, or if user is trying to pass another copy
    // and P1 is still holding one of the copies, don't allow duplicate entry into P1
    if (activeCountForThisPkg > 1 && subIdx > 0) {
      const currentBox = samePackageBoxesAtP1[0];
      const occupiedInv = currentBox.invNo || "this order";
      return {
        success: false,
        isOccupied: true,
        code: PACKING_ERROR_CODES.STATION_OCCUPIED,
        targetPosition: 1,
        targetStationName: "Packing Position 1",
        occupiedInvoice: currentBox.invNo || null,
        message: `Packing Position 1 is currently busy with a box of this package (Invoice ${occupiedInv}). Please wait until Position 1 clears before passing the next box.`
      };
    }

    // Exact same box re-print (subIdx === 0 and only 1 box active) — allowed
    return null;
  }

  // ── Step 5: Check capacity vs current load ────────────────────────────────
  const currentLoad = activeP1Boxes.length;

  if (currentLoad < capacity) {
    // P1 has a free slot — allow
    return null;
  }

  // ── Step 6: P1 is fully busy — return error with details ─────────────────
  const occupiedInvoices = [...new Set(activeP1Boxes.map((b) => b.invNo).filter(Boolean))];
  const occupiedInvText = occupiedInvoices.length > 0
    ? occupiedInvoices.join(", ")
    : "an active order";

  const slotInfo = capacity > 1
    ? ` (${currentLoad}/${capacity} slots occupied)`
    : "";

  return {
    success: false,
    isOccupied: true,
    code: PACKING_ERROR_CODES.STATION_OCCUPIED,
    targetPosition: 1,
    targetStationName: "Packing Position 1",
    occupiedInvoice: occupiedInvoices[0] || null,
    occupiedInvoices,
    message: `Packing Position 1${slotInfo} is currently busy with Invoice ${occupiedInvText}. Please wait until Position 1 clears before passing the next box.`,
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
    const isQc = targetStationName && targetStationName.toLowerCase().includes("qc");
    const stationLabel = isQc ? "QC Station" : (targetStationName || `Position ${nextStep}`);
    return {
      success: false,
      isOccupied: true,
      code: PACKING_ERROR_CODES.STATION_OCCUPIED,
      occupiedInvoice: occupiedInv,
      targetPosition: nextStep,
      targetStationName: stationLabel,
      message: `${stationLabel} is currently busy with Invoice ${occupiedInv}. Please wait until ${stationLabel} clears before passing the next box.`
    };
  }

  return null;
};

module.exports = {
  validatePosition1Busy,
  validateNextPositionBusy,
};
