const db = require("../../startup/database");
const { TIME_SLOT_MAP, formatTimeSlot } = require("../../utils/packing/time-slots");
const { validatePosition1Busy, validateNextPositionBusy } = require("../../utils/packing/packing-validator");
const { PACKING_ERROR_CODES } = require("../../utils/packing/error-codes");

/**
 * Get company center ID for a collection officer
 * @param {number} officerId 
 * @returns {Promise<number|null>}
 */
exports.getCompanyCenterIdForOfficer = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT dcen.id AS companycenterId
      FROM collectionofficer co
      JOIN distributedcompanycenter dcen ON co.distributedCenterId = dcen.centerId
      WHERE co.id = ?
    `;
    db.collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Error in getCompanyCenterIdForOfficer:", err);
        return reject(err);
      }
      if (results.length === 0) {
        return resolve(null);
      }
      resolve(results[0].companycenterId);
    });
  });
};

/**
 * Get active position assignment for logged-in officer today
 * @param {number} officerId 
 * @returns {Promise<Object|null>}
 */
exports.getOfficerActiveAssignment = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        tp.id AS targetPositionId,
        tp.targetId,
        pp.id AS positionId,
        pp.pType AS type,
        pp.pIndex,
        pr.id AS rowId,
        CONCAT('Row ', pr.rowIndex) AS rowName,
        CASE 
          WHEN pp.pType = 'QR' THEN 'QR Handling Position'
          WHEN pp.pType = 'QC' THEN 'QC Position'
          ELSE CONCAT('Packing Position ', pp.pIndex)
        END AS name,
        pp.pType AS positionType,
        dt.timeSlot
      FROM targetposition tp
      JOIN packingpositions pp ON tp.positionId = pp.id
      JOIN packingrows pr ON pp.rowId = pr.id
      LEFT JOIN distributedtarget dt ON tp.targetId = dt.id
      WHERE tp.officerId = ? AND DATE(tp.createdAt) = CURDATE() AND tp.isFinished = 1
      ORDER BY tp.id DESC
      LIMIT 1
    `;
    db.collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Error in getOfficerActiveAssignment:", err);
        return reject(err);
      }
      if (results.length === 0) {
        return resolve(null);
      }
      resolve(results[0]);
    });
  });
};

/**
 * Get packing rows with available positions count for a company center
 * @param {number} companyCenterId 
 * @returns {Promise<Array>}
 */
exports.getPackingRowsForCenter = (companyCenterId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        pr.id,
        CONCAT('Row ', pr.rowIndex) AS name,
        CAST(COALESCE(
          COUNT(pp.id) - COUNT(tp.id),
          0
        ) AS UNSIGNED) AS positionsCount,
        (
          SELECT GROUP_CONCAT(DISTINCT mi.displayName ORDER BY mi.displayName ASC SEPARATOR ', ')
          FROM packingpositions pp2
          JOIN positionscrops pc ON pp2.id = pc.posId
          JOIN market_place.marketplaceitems mi ON pc.mpiId = mi.id
          WHERE pp2.rowId = pr.id AND pp2.pType = 'NOR'
        ) AS crops
      FROM packingrows pr
      LEFT JOIN packingpositions pp ON pr.id = pp.rowId
      LEFT JOIN targetposition tp ON pp.id = tp.positionId AND DATE(tp.createdAt) = CURDATE() AND tp.isFinished = 1
      WHERE pr.companyCenterId = ? AND pr.isEnabled = 1
        AND (
          SELECT COUNT(*) 
          FROM packingpositions pp3
          WHERE pp3.rowId = pr.id AND pp3.pType = 'NOR'
        ) > 0
        AND NOT EXISTS (
          SELECT 1 
          FROM packingpositions pp4
          LEFT JOIN positionscrops pc2 ON pp4.id = pc2.posId AND pc2.mpiId IS NOT NULL
          WHERE pp4.rowId = pr.id AND pp4.pType = 'NOR' AND pc2.id IS NULL
        )
      GROUP BY pr.id, pr.rowIndex
      ORDER BY pr.rowIndex ASC
    `;
    db.collectionofficer.query(sql, [companyCenterId], (err, results) => {
      if (err) {
        console.error("Error in getPackingRowsForCenter:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

/**
 * Get positions and their availability/role for a specific row
 * @param {number} rowId 
 * @returns {Promise<Array>}
 */
exports.getPositionsForRow = (rowId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        pp.id,
        CASE 
          WHEN pp.pType = 'QR' THEN 'QR Handling Position'
          WHEN pp.pType = 'QC' THEN 'QC Position'
          ELSE CONCAT('Packing Position ', pp.pIndex)
        END AS name,
        pp.pType AS type,
        CASE 
          WHEN tp.id IS NOT NULL THEN 'Occupied'
          ELSE 'Available'
        END AS status,
        CASE 
          WHEN pp.pType = 'QR' THEN 'QR'
          WHEN pp.pType = 'QC' THEN 'QC'
          ELSE LPAD(pp.pIndex, 2, '0')
        END AS leftLabel
      FROM packingpositions pp
      LEFT JOIN targetposition tp ON pp.id = tp.positionId AND DATE(tp.createdAt) = CURDATE() AND tp.isFinished = 1
      WHERE pp.rowId = ?
      ORDER BY 
        CASE WHEN pp.pType = 'QR' THEN 1 WHEN pp.pType = 'NOR' THEN 2 ELSE 3 END,
        pp.pIndex ASC
    `;
    db.collectionofficer.query(sql, [rowId], (err, results) => {
      if (err) {
        console.error("Error in getPositionsForRow:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

/**
 * Assign or update officer position in targetposition along with targetId
 * @param {number} officerId 
 * @param {number} packingPositionId 
 * @returns {Promise<Object>}
 */
exports.assignOfficerToPosition = (officerId, packingPositionId) => {
  return new Promise((resolve, reject) => {
    db.collectionofficer.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting connection for assignOfficerToPosition:", err);
        return reject(err);
      }

      connection.beginTransaction(async (transactionErr) => {
        if (transactionErr) {
          connection.release();
          return reject(transactionErr);
        }

        try {
          // 1. Get position and row info from packingpositions
          const getPosInfoSql = `SELECT id, rowId, pType FROM packingpositions WHERE id = ? LIMIT 1`;
          const posInfo = await new Promise((res, rej) => {
            connection.query(getPosInfoSql, [packingPositionId], (err, results) => {
              if (err) return rej(err);
              res(results.length > 0 ? results[0] : null);
            });
          });

          if (!posInfo) {
            connection.rollback(() => {
              connection.release();
              reject(new Error("Selected packing position not found."));
            });
            return;
          }

          // Determine current timeSlot enum based on hour: '8-12', '12-4', or '4-9'
          const currentHour = new Date().getHours();
          let timeSlot = "8-12";
          if (currentHour >= 12 && currentHour < 16) {
            timeSlot = "12-4";
          } else if (currentHour >= 16 && currentHour < 21) {
            timeSlot = "4-9";
          }

          // 2. Find or create distributedtarget record for today
          const getTargetSql = `
            SELECT id FROM distributedtarget 
            WHERE rowId = ? AND timeSlot = ? AND DATE(createdAt) = CURDATE()
            ORDER BY id DESC LIMIT 1
          `;
          let targetId = await new Promise((res, rej) => {
            connection.query(getTargetSql, [posInfo.rowId, timeSlot], (err, results) => {
              if (err) return rej(err);
              res(results.length > 0 ? results[0].id : null);
            });
          });

          if (!targetId) {
            const insertTargetSql = `
              INSERT INTO distributedtarget (rowId, timeSlot, createdAt)
              VALUES (?, ?, NOW())
            `;
            const insertTargetRes = await new Promise((res, rej) => {
              connection.query(insertTargetSql, [posInfo.rowId, timeSlot], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });
            targetId = insertTargetRes.insertId;
          }

          // 3. Ensure a record exists in positionscrops for this packingPositionId (if needed)
          const getPosCropSql = `SELECT id FROM positionscrops WHERE posId = ? LIMIT 1`;
          let positionCropId = await new Promise((res, rej) => {
            connection.query(getPosCropSql, [packingPositionId], (err, results) => {
              if (err) return rej(err);
              res(results.length > 0 ? results[0].id : null);
            });
          });

          if (!positionCropId) {
            const insertPosCropSql = `INSERT INTO positionscrops (posId, mpiId, createdAt) VALUES (?, NULL, NOW())`;
            await new Promise((res, rej) => {
              connection.query(insertPosCropSql, [packingPositionId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });
          }

          // 4. Check if position is occupied by another officer today
          const checkPosSql = `
            SELECT id, officerId FROM targetposition 
            WHERE positionId = ? AND DATE(createdAt) = CURDATE() AND isFinished = 1
            LIMIT 1
          `;
          const posOccupant = await new Promise((res, rej) => {
            connection.query(checkPosSql, [packingPositionId], (err, results) => {
              if (err) return rej(err);
              res(results.length > 0 ? results[0] : null);
            });
          });

          if (posOccupant && posOccupant.officerId !== officerId) {
            connection.rollback(() => {
              connection.release();
              reject(new Error("This position is already occupied by another officer today."));
            });
            return;
          }

          // 5. Upsert targetposition with officerId, positionId (= packingPositionId), and targetId
          const checkOfficerSql = `
            SELECT id FROM targetposition 
            WHERE officerId = ? AND DATE(createdAt) = CURDATE() AND isFinished = 1
            LIMIT 1
          `;
          const existingAssignment = await new Promise((res, rej) => {
            connection.query(checkOfficerSql, [officerId], (err, results) => {
              if (err) return rej(err);
              res(results.length > 0 ? results[0] : null);
            });
          });

          if (existingAssignment) {
            const updateSql = `
              UPDATE targetposition 
              SET positionId = ?, targetId = ?, isFinished = 1, createdAt = NOW() 
              WHERE id = ?
            `;
            await new Promise((res, rej) => {
              connection.query(updateSql, [packingPositionId, targetId, existingAssignment.id], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });
          } else {
            const insertSql = `
              INSERT INTO targetposition (officerId, positionId, targetId, isFinished, createdAt) 
              VALUES (?, ?, ?, 1, NOW())
            `;
            await new Promise((res, rej) => {
              connection.query(insertSql, [officerId, packingPositionId, targetId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });
          }

          connection.commit((commitErr) => {
            if (commitErr) {
              return connection.rollback(() => {
                connection.release();
                reject(commitErr);
              });
            }
            connection.release();
            resolve({ success: true, targetId, positionId: packingPositionId });
          });

        } catch (error) {
          connection.rollback(() => {
            connection.release();
            reject(error);
          });
        }
      });
    });
  });
};

/**
 * Get crops assigned to a specific packing position
 * @param {number} positionId 
 * @returns {Promise<Array>}
 */
exports.getCropsForPosition = (positionId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mi.id,
        mi.displayName AS name,
        cv.image AS image
      FROM positionscrops pc
      JOIN market_place.marketplaceitems mi ON pc.mpiId = mi.id
      LEFT JOIN plant_care.cropvariety cv ON mi.varietyId = cv.id
      WHERE pc.posId = ?
      ORDER BY mi.displayName ASC
    `;
    db.collectionofficer.query(sql, [positionId], (err, results) => {
      if (err) {
        console.error("Error in getCropsForPosition:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

/**
 * Get target orders for QR Handling
 * @param {number} officerId 
 * @returns {Promise<Array>}
 */
exports.getQROrdersForOfficer = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT DISTINCT
        po.id AS id,
        po.id AS processOrderId,
        po.invNo AS orderNumber,
        CASE 
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'dash' OR LOWER(COALESCE(o.orderApp, '')) = 'wholesale' THEN 'W'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'wholesale' THEN 'W'
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'marketplace' OR LOWER(COALESCE(o.orderApp, '')) = 'retail' THEN 'R'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'retail' THEN 'R'
          ELSE 'W' 
        END AS type,
        dt.timeSlot,
        CASE 
          WHEN LOWER(COALESCE(o.delivaryMethod, '')) = 'pickup' THEN 'Pickup Order' 
          ELSE COALESCE(
            NULLIF(TRIM(oh.city), ''), 
            NULLIF(TRIM(oa.city), ''), 
            NULLIF(TRIM(u.nearesCity), ''), 
            NULLIF(TRIM(o.delivaryMethod), ''), 
            'Bambalapitiya'
          ) 
        END AS category,
        dti.orderStatus,
        COALESCE(
          (SELECT MIN(pt_qr.pIndex) FROM positiontracking pt_qr WHERE pt_qr.orderId = po.id), 
          0
        ) AS minPIndex,
        COALESCE((SELECT SUM(COALESCE(op.qty, 1)) FROM market_place.orderpackage op WHERE op.orderId = po.orderId OR op.orderId = po.id), 0) AS packagesCount,
        (SELECT COUNT(DISTINCT oai.productId) FROM market_place.orderadditionalitems oai WHERE oai.orderId = po.orderId) AS alacarteCount
      FROM targetposition tp
      JOIN packingpositions pp ON tp.positionId = pp.id
      JOIN distributedtarget dt ON pp.rowId = dt.rowId AND (DATE(dt.createdAt) = CURDATE() OR DATE(dt.createdAt) = DATE(tp.createdAt))
      JOIN distributedtargetitems dti ON dt.id = dti.targetId
      JOIN market_place.processorders po ON dti.orderId = po.id
      JOIN market_place.orders o ON po.orderId = o.id
      LEFT JOIN market_place.orderhouse oh ON (oh.orderId = o.id OR oh.orderId = po.orderId)
      LEFT JOIN market_place.orderapartment oa ON (oa.orderId = o.id OR oa.orderId = po.orderId)
      LEFT JOIN market_place.marketplaceusers u ON o.userId = u.id
      WHERE tp.officerId = ? AND (DATE(tp.createdAt) = CURDATE() OR DATE(dt.createdAt) = CURDATE())
      ORDER BY po.id ASC
    `;
    db.collectionofficer.query(sql, [officerId], async (err, results) => {
      if (err) {
        console.error("Error in getQROrdersForOfficer:", err);
        return resolve([]);
      }

      for (const item of results) {
        if (item.packagesCount > 0) {
          try {
            const pkgSql = `
              SELECT 
                op.id, 
                COALESCE(mp.displayName, 'Package') AS name, 
                COALESCE(op.qty, 1) AS qty,
                GREATEST(
                  COALESCE((SELECT COUNT(*) FROM market_place.orderpackageitems opi WHERE opi.orderPackageId = op.id), 0),
                  COALESCE((SELECT COUNT(*) FROM market_place.packagedetails pd WHERE pd.packageId = op.packageId), 0)
                ) AS count
              FROM market_place.processorders po
              JOIN market_place.orderpackage op ON (op.orderId = po.orderId OR op.orderId = po.id)
              JOIN market_place.marketplacepackages mp ON op.packageId = mp.id
              WHERE po.id = ?
            `;
            const pkgs = await new Promise((res, rej) => {
              db.collectionofficer.query(pkgSql, [item.id], (e, r) => e ? rej(e) : res(r));
            });
            for (const pkg of pkgs) {
              const pkgItemsSql = `
                SELECT 
                  opi.id,
                  pt.typeName AS categoryName,
                  mi.displayName AS itemName,
                  COALESCE(opi.qty, 1) AS qty
                FROM market_place.orderpackageitems opi
                LEFT JOIN market_place.producttypes pt ON opi.productType = pt.id
                LEFT JOIN market_place.marketplaceitems mi ON opi.productId = mi.id
                WHERE opi.orderPackageId = ?
              `;
              const items = await new Promise((res) => {
                db.collectionofficer.query(pkgItemsSql, [pkg.id], (e, r) => res(r || []));
              });
              pkg.items = items;
              pkg.itemBreakdown = items
                .map((i) => (i.itemName ? `${i.itemName} (${i.categoryName})` : i.categoryName))
                .join(", ");
            }
            item.packagesList = pkgs;
          } catch (e) {
            console.error("Error fetching packagesList for order:", e);
            item.packagesList = [];
          }
        } else {
          item.packagesList = [];
        }

        try {
          const trackingSql = `
            SELECT id, orderpackageId, pIndex, isMainContainer 
            FROM positiontracking 
            WHERE orderId = ?
          `;
          item.trackingRows = await new Promise((res) => {
            db.collectionofficer.query(trackingSql, [item.id], (e, r) => res(r || []));
          });
        } catch (e) {
          console.error("Error fetching trackingRows for order:", e);
          item.trackingRows = [];
        }
      }

      resolve(results);
    });
  });
};

/**
 * Get distribution center targets grouped/listed for Center Target Screen
 * @returns {Promise<Array>}
 */
exports.getCenterTargetOrders = (companyCenterId = null) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT DISTINCT
        po.id AS id,
        po.invNo AS orderNumber,
        CASE 
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'dash' OR LOWER(COALESCE(o.orderApp, '')) = 'wholesale' THEN 'W'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'wholesale' THEN 'W'
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'marketplace' OR LOWER(COALESCE(o.orderApp, '')) = 'retail' THEN 'R'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'retail' THEN 'R'
          ELSE 'W' 
        END AS type,
        CONCAT(po.invNo, ' (', CASE 
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'dash' OR LOWER(COALESCE(o.orderApp, '')) = 'wholesale' THEN 'W'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'wholesale' THEN 'W'
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'marketplace' OR LOWER(COALESCE(o.orderApp, '')) = 'retail' THEN 'R'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'retail' THEN 'R'
          ELSE 'W' 
        END, ')') AS formattedOrderNumber,
        dt.timeSlot,
        CASE 
          WHEN LOWER(COALESCE(o.delivaryMethod, '')) = 'pickup' THEN 'Pickup Order' 
          ELSE COALESCE(
            NULLIF(TRIM(oh.city), ''), 
            NULLIF(TRIM(oa.city), ''), 
            NULLIF(TRIM(u.nearesCity), ''), 
            NULLIF(TRIM(o.delivaryMethod), ''), 
            'Bambalapitiya'
          ) 
        END AS category,
        CONCAT('Row ', COALESCE(pr.rowIndex, 1)) AS rowName,
        dti.orderStatus,
        COALESCE(
          (SELECT MIN(pt_qr.pIndex) FROM positiontracking pt_qr WHERE pt_qr.orderId = po.id), 
          0
        ) AS minPIndex,
        COALESCE(
          (SELECT MAX(pt_max.pIndex) FROM positiontracking pt_max WHERE pt_max.orderId = po.id), 
          0
        ) AS maxPIndex
      FROM distributedtarget dt
      JOIN distributedtargetitems dti ON dt.id = dti.targetId
      JOIN market_place.processorders po ON dti.orderId = po.id
      JOIN market_place.orders o ON po.orderId = o.id
      LEFT JOIN packingrows pr ON dt.rowId = pr.id
      LEFT JOIN distributedcompanycenter dcen ON (o.centerId = dcen.centerId OR o.assignCoMCenId = dcen.id)
      LEFT JOIN market_place.orderhouse oh ON (oh.orderId = o.id OR oh.orderId = po.orderId)
      LEFT JOIN market_place.orderapartment oa ON (oa.orderId = o.id OR oa.orderId = po.orderId)
      LEFT JOIN market_place.marketplaceusers u ON o.userId = u.id
      WHERE DATE(dt.createdAt) = CURDATE()
        AND (? IS NULL OR dcen.id = ?)
      ORDER BY dt.timeSlot ASC, po.id ASC
    `;
    db.collectionofficer.query(sql, [companyCenterId, companyCenterId], (err, results) => {
      if (err) {
        console.error("Error in getCenterTargetOrders:", err);
        return resolve([]);
      }
      resolve(results || []);
    });
  });
};

/**
 * Get tracking order details breakdown for OrderDetails screen
 * @param {number} orderId
 * @returns {Promise<Object|null>}
 */
exports.getOrderDetails = (orderId) => {
  return new Promise((resolve, reject) => {
    // 1. Query order info from DB
    const sqlOrder = `
      SELECT DISTINCT
        po.id AS orderId,
        po.invNo AS orderNumber,
        CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END AS type,
        CONCAT(po.invNo, ' (', CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END, ')') AS formattedOrderNumber,
        dt.id AS targetId,
        dt.timeSlot,
        CASE 
          WHEN LOWER(COALESCE(o.delivaryMethod, '')) = 'pickup' THEN 'Pickup Order' 
          ELSE COALESCE(NULLIF(TRIM(oh.city), ''), NULLIF(TRIM(o.delivaryMethod), ''), 'Bambalapitiya') 
        END AS category,
        CONCAT('Row ', COALESCE(pr.rowIndex, 1)) AS rowName,
        dti.orderStatus,
        dti.qrPrintedBy,
        DATE_FORMAT(dti.qrPrintTime, '%h:%i %p') AS qrPrintedTime,
        po.packBy,
        DATE_FORMAT(po.packTime, '%h:%i %p') AS qcDoneTime
      FROM market_place.processorders po
      JOIN market_place.orders o ON po.orderId = o.id
      LEFT JOIN distributedtargetitems dti ON dti.orderId = po.id
      LEFT JOIN distributedtarget dt ON dti.targetId = dt.id
      LEFT JOIN packingrows pr ON dt.rowId = pr.id
      LEFT JOIN market_place.orderhouse oh ON (oh.orderId = o.id OR oh.orderId = po.orderId)
      LEFT JOIN market_place.orderapartment oa ON (oa.orderId = o.id OR oa.orderId = po.orderId)
      LEFT JOIN market_place.marketplaceusers u ON o.userId = u.id
      WHERE po.id = ? OR po.invNo = ?
      LIMIT 1
    `;

    db.collectionofficer.query(sqlOrder, [orderId, orderId], async (err, orderResults) => {
      if (err || !orderResults || orderResults.length === 0) {
        return resolve(null);
      }

      const orderInfo = orderResults[0];
      const statusLabel = `(${orderInfo.rowName}) Out`;
      const timeSlotLabel = formatTimeSlot(orderInfo.timeSlot);

      try {
        let targetId = orderInfo.targetId;
        if (!targetId) {
          const findTargetSql = `SELECT targetId FROM distributedtargetitems WHERE orderId = ? LIMIT 1`;
          const resTarget = await new Promise((res) => {
            db.collectionofficer.query(findTargetSql, [orderInfo.orderId], (e, r) => res(r || []));
          });
          if (resTarget && resTarget.length > 0) {
            targetId = resTarget[0].targetId;
          }
        }

        // Query QR Printed Officer
        let qrPrintedByEmpId = "-";
        if (orderInfo.qrPrintedBy) {
          const qrOfficerRes = await new Promise((res) => {
            db.collectionofficer.query(
              "SELECT empId FROM collectionofficer WHERE id = ? LIMIT 1",
              [orderInfo.qrPrintedBy],
              (e, r) => res(r || [])
            );
          });
          if (qrOfficerRes && qrOfficerRes.length > 0 && qrOfficerRes[0].empId) {
            qrPrintedByEmpId = qrOfficerRes[0].empId;
          }
        }

        // Query QC Done Officer (packBy in processorders)
        let qcDoneByEmpId = "-";
        if (orderInfo.packBy) {
          const qcOfficerRes = await new Promise((res) => {
            db.collectionofficer.query(
              "SELECT empId FROM collectionofficer WHERE id = ? LIMIT 1",
              [orderInfo.packBy],
              (e, r) => res(r || [])
            );
          });
        if (qcOfficerRes && qcOfficerRes.length > 0 && qcOfficerRes[0].empId) {
            qcDoneByEmpId = qcOfficerRes[0].empId;
          }
        }

        // Query packages for this order (uses processorders.id as orderpackage.orderId)
        const pkgSql = `
          SELECT 
            op.id,
            COALESCE(mp.displayName, 'Package') AS packageName
          FROM market_place.processorders po
          JOIN market_place.orderpackage op ON po.id = op.orderId
          LEFT JOIN market_place.marketplacepackages mp ON op.packageId = mp.id
          WHERE po.id = ?
        `;
        const pkgs = await new Promise((res) => {
          db.collectionofficer.query(pkgSql, [orderInfo.orderId], (e, r) => res(r || []));
        });

        const packageGroups = [];

        // --- Package items ---
        for (const pkg of pkgs) {
          const itemsSql = `
            SELECT 
              opi.id,
              COALESCE(mi.displayName, 'Item') AS name,
              CONCAT(COALESCE(opi.qty, 0.5), ' kg') AS weight,
              DATE_FORMAT(opi.packingTime, '%h:%i %p') AS packedTime,
              co.empId AS packedByEmpId,
              COALESCE(cv.image, '') AS image
            FROM market_place.orderpackageitems opi
            LEFT JOIN market_place.marketplaceitems mi ON opi.productId = mi.id
            LEFT JOIN plant_care.cropvariety cv ON mi.varietyId = cv.id
            LEFT JOIN targetposition tp ON opi.packId = tp.id
            LEFT JOIN collectionofficer co ON tp.officerId = co.id
            WHERE opi.orderPackageId = ?
            ORDER BY opi.id ASC
          `;
          const items = await new Promise((res) => {
            db.collectionofficer.query(itemsSql, [pkg.id], (e, r) => res(r || []));
          });

          packageGroups.push({
            id: pkg.id,
            title: `${pkg.packageName} (${String(items.length).padStart(2, "0")})`,
            count: items.length,
            type: "package",
            items: items.map((i, idx) => ({
              id: i.id || idx + 1,
              name: i.name,
              weight: i.weight,
              packedByEmpId: i.packedByEmpId || "-",
              packedTime: i.packedTime || "-",
              image: i.image || "",
            })),
          });
        }

        // --- Alacarte items (from orderadditionalitems via master orderId) ---
        const alacarteSql = `
          SELECT 
            oai.id,
            COALESCE(mi.displayName, 'Item') AS name,
            CONCAT(COALESCE(oai.qty, 0.5), ' ', COALESCE(oai.unit, 'kg')) AS weight,
            DATE_FORMAT(oai.packingTime, '%h:%i %p') AS packedTime,
            co.empId AS packedByEmpId,
            COALESCE(cv.image, '') AS image
          FROM market_place.orderadditionalitems oai
          JOIN market_place.processorders po ON oai.orderId = po.orderId
          LEFT JOIN market_place.marketplaceitems mi ON oai.productId = mi.id
          LEFT JOIN plant_care.cropvariety cv ON mi.varietyId = cv.id
          LEFT JOIN targetposition tp ON oai.packId = tp.id
          LEFT JOIN collectionofficer co ON tp.officerId = co.id
          WHERE po.id = ?
          ORDER BY oai.id ASC
        `;
        const alacarteItems = await new Promise((res) => {
          db.collectionofficer.query(alacarteSql, [orderInfo.orderId], (e, r) => res(r || []));
        });

        if (alacarteItems.length > 0) {
          packageGroups.push({
            id: -1,
            title: `À la carte (${String(alacarteItems.length).padStart(2, "0")})`,
            count: alacarteItems.length,
            type: "alacarte",
            items: alacarteItems.map((i, idx) => ({
              id: i.id || idx + 1,
              name: i.name,
              weight: i.weight,
              packedByEmpId: i.packedByEmpId || "-",
              packedTime: i.packedTime || "-",
              image: i.image || "",
            })),
          });
        }

        // If no packages/alacarte found, show empty list
        if (packageGroups.length === 0) {
          packageGroups.push({
            id: 1,
            title: "Order Items (00)",
            count: 0,
            type: "package",
            items: [],
          });
        }

        resolve({
          orderId: orderInfo.orderId,
          orderNumber: orderInfo.orderNumber,
          formattedOrderNumber: orderInfo.formattedOrderNumber,
          timeSlotLabel: timeSlotLabel,
          category: orderInfo.category,
          statusLabel: statusLabel,
          qrPrintedByEmpId: qrPrintedByEmpId,
          qrPrintedTime: orderInfo.qrPrintedTime || "-",
          packageGroups: packageGroups,
          qcDoneByEmpId: qcDoneByEmpId,
          qcDoneTime: orderInfo.qcDoneTime || "-",
        });
      } catch (e) {
        console.error("Error building packageGroups for order details:", e);
        resolve(null);
      }
    });
  });
};

/**
 * Update distributedtargetitems.orderStatus = 'Opened' and set positiontracking.pIndex = 1
 * @param {number} orderId 
 * @param {number|null} orderpackageId 
 * @returns {Promise<Object>}
 */
exports.markOrderAsOpened = (orderId, orderpackageId = null, isPackage = null, packageIndex = 0, isMainContainer = false, officerId = null) => {
  return new Promise((resolve, reject) => {
    db.collectionofficer.getConnection((err, connection) => {
      if (err) return reject(err);

      connection.beginTransaction(async (transactionErr) => {
        if (transactionErr) {
          connection.release();
          return reject(transactionErr);
        }

        try {
          // 1. Update distributedtargetitems.orderStatus = 'Opened'
          //    Only set qrPrintTime + qrPrintedBy on the FIRST print (when qrPrintedBy is still NULL)
          const updateStatusSql = `
            UPDATE distributedtargetitems 
            SET orderStatus = 'Opened',
                qrPrintTime = CASE WHEN qrPrintedBy IS NULL THEN NOW() ELSE qrPrintTime END,
                qrPrintedBy = CASE WHEN qrPrintedBy IS NULL THEN ? ELSE qrPrintedBy END
            WHERE orderId = ?
          `;
          await new Promise((res, rej) => {
            connection.query(updateStatusSql, [officerId, orderId], (err, result) => {
              if (err) return rej(err);
              res(result);
            });
          });

          // Main Container check moved after validation checks

          // 2. Resolve target orderpackageId for package or alacarte item
          let validPackageId = null;

          if (orderpackageId) {
            const checkPkgSql = `
              SELECT id FROM market_place.orderpackage 
              WHERE id = ? LIMIT 1
            `;
            const pkgExists = await new Promise((res, rej) => {
              connection.query(checkPkgSql, [orderpackageId], (err, results) => {
                if (err) return rej(err);
                res(results.length > 0 ? results[0].id : null);
              });
            });
            validPackageId = pkgExists;
          }

          if (!validPackageId && isPackage === 1) {
            const getOrderPkgsSql = `
              SELECT op.id 
              FROM market_place.processorders po
              JOIN market_place.orderpackage op ON po.id = op.orderId
              WHERE po.id = ?
              ORDER BY op.id ASC
            `;
            const pkgs = await new Promise((res, rej) => {
              connection.query(getOrderPkgsSql, [orderId], (err, results) => {
                if (err) return rej(err);
                res(results);
              });
            });

            if (pkgs && pkgs.length > 0) {
              const idx = Math.min(Math.max(packageIndex, 0), pkgs.length - 1);
              validPackageId = pkgs[idx].id;
            }
          }

          // 2a. Officer Assignment Check for Position 1 (pIndex = 1)
          const checkOfficerP1Sql = `
            SELECT tp.id, tp.officerId
            FROM targetposition tp
            JOIN packingpositions pp ON tp.positionId = pp.id
            JOIN distributedtarget dt ON (tp.targetId = dt.id OR pp.rowId = dt.rowId)
            JOIN distributedtargetitems dti ON dt.id = dti.targetId
            WHERE dti.orderId = ? AND pp.pIndex = 1 AND DATE(tp.createdAt) = CURDATE()
            LIMIT 1
          `;

          const officerP1Res = await new Promise((res) => {
            connection.query(checkOfficerP1Sql, [orderId], (err, results) => {
              res(err ? [] : results || []);
            });
          });

          if (!officerP1Res || officerP1Res.length === 0) {
            connection.rollback(() => {
              connection.release();
              resolve({
                success: false,
                code: PACKING_ERROR_CODES.NO_OFFICER_ASSIGNED,
                message: "No packing position user assigned for Packing Position 1. Please assign an officer to this position first."
              });
            });
            return;
          }

          // 2c. Main Container Priority Check (QR print time)
          // Rule: For orders with multiple physical boxes, the Main Container QR must be printed FIRST.
          // We only check that the Main Container ROW EXISTS in positiontracking — we do NOT block
          // based on its current pIndex (it may still be at pIndex=1 while packages are printing).
          if (!isMainContainer) {
            const getCountsSql = `
              SELECT 
                (SELECT COALESCE(SUM(COALESCE(qty, 1)), 0) FROM market_place.orderpackage WHERE orderId = po.id OR orderId = po.orderId) AS packagesCount,
                (SELECT COUNT(*) FROM market_place.orderadditionalitems WHERE orderId = po.orderId) AS alacarteCount
              FROM market_place.processorders po
              WHERE po.id = ?
              LIMIT 1
            `;
            const countsRes = await new Promise((res) => {
              connection.query(getCountsSql, [orderId], (err, results) => {
                res(results || []);
              });
            });

            const pCount = countsRes.length > 0 ? Number(countsRes[0].packagesCount || 0) : 0;
            const aCount = countsRes.length > 0 ? Number(countsRes[0].alacarteCount || 0) : 0;
            const totalPhysicalBoxes = pCount + (aCount > 0 ? 1 : 0);

            if (totalPhysicalBoxes > 1) {
              const checkMainSql = `
                SELECT id FROM positiontracking 
                WHERE orderId = ? AND isMainContainer = 1 
                LIMIT 1
              `;
              const mainRows = await new Promise((res) => {
                connection.query(checkMainSql, [orderId], (err, results) => {
                  res(results || []);
                });
              });

              // Block only if Main Container QR hasn't been printed yet (no row in positiontracking)
              if (mainRows.length === 0) {
                connection.rollback(() => {
                  connection.release();
                  resolve({
                    success: false,
                    code: PACKING_ERROR_CODES.MAIN_CONTAINER_PENDING,
                    message: "Please print the Main Container QR first before printing individual package boxes."
                  });
                });
                return;
              }
            }
          }

          // 2b. Station Occupied Validation Check for Position 1 (pIndex = 1)
          // Uses validatePosition1Busy utility to check if P1 is busy with a previous package box
          const occupiedErr = await validatePosition1Busy(
            connection,
            orderId,
            validPackageId,
            isMainContainer,
            packageIndex
          );

          if (occupiedErr) {
            connection.rollback(() => {
              connection.release();
              resolve(occupiedErr);
            });
            return;
          }


          if (isMainContainer) {
            // Check if Main Container is already registered
            const checkMainSql = `SELECT id FROM positiontracking WHERE orderId = ? AND isMainContainer = 1 LIMIT 1`;
            const mainExists = await new Promise((res, rej) => {
              connection.query(checkMainSql, [orderId], (err, results) => {
                if (err) return rej(err);
                res(results || []);
              });
            });

            if (mainExists.length === 0) {
              const insertTrackingSql = `
                INSERT INTO positiontracking (orderId, orderpackageId, pIndex, isMainContainer, createdAt) 
                VALUES (?, NULL, 1, 1, NOW())
              `;
              await new Promise((res, rej) => {
                connection.query(insertTrackingSql, [orderId], (err, result) => {
                  if (err) return rej(err);
                  res(result);
                });
              });
            }
          } else if (validPackageId) {
            // 1. Try to update an existing pIndex = 0 row to pIndex = 1
            const updatePkgSql = `
              UPDATE positiontracking 
              SET pIndex = 1, createdAt = NOW()
              WHERE orderId = ? AND orderpackageId = ? AND pIndex = 0
              LIMIT 1
            `;
            const updateResult = await new Promise((res, rej) => {
              connection.query(updatePkgSql, [orderId, validPackageId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });

            // 2. If no row was updated, check if we need to insert a new package copy
            if (updateResult.affectedRows === 0) {
              const checkPkgCountSql = `SELECT COUNT(*) AS count FROM positiontracking WHERE orderId = ? AND orderpackageId = ?`;
              const existingCountRes = await new Promise((res, rej) => {
                connection.query(checkPkgCountSql, [orderId, validPackageId], (err, results) => {
                  if (err) return rej(err);
                  res(results || []);
                });
              });
              const existingCount = existingCountRes.length > 0 ? existingCountRes[0].count : 0;

              const getPkgQtySql = `SELECT GREATEST(COALESCE(qty, 1), 1) AS qty FROM market_place.orderpackage WHERE id = ?`;
              const qtyRes = await new Promise((res, rej) => {
                connection.query(getPkgQtySql, [validPackageId], (err, results) => {
                  if (err) return rej(err);
                  res(results || []);
                });
              });
              const qty = qtyRes.length > 0 ? qtyRes[0].qty : 1;

              if (existingCount < qty) {
                const insertTrackingSql = `
                  INSERT INTO positiontracking (orderId, orderpackageId, pIndex, isMainContainer, createdAt) 
                  VALUES (?, ?, 1, 0, NOW())
                `;
                await new Promise((res, rej) => {
                  connection.query(insertTrackingSql, [orderId, validPackageId], (err, result) => {
                    if (err) return rej(err);
                    res(result);
                  });
                });
              }
            }
          } else {
            // 1. Try to update an existing pIndex = 0 row to pIndex = 1
            const updateAlacarteSql = `
              UPDATE positiontracking 
              SET pIndex = 1, createdAt = NOW()
              WHERE orderId = ? AND orderpackageId IS NULL AND isMainContainer = 0 AND pIndex = 0
              LIMIT 1
            `;
            const updateResult = await new Promise((res, rej) => {
              connection.query(updateAlacarteSql, [orderId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });

            // 2. If no row was updated, check if we need to insert a new À la carte row
            if (updateResult.affectedRows === 0) {
              const checkAlacarteSql = `SELECT id FROM positiontracking WHERE orderId = ? AND orderpackageId IS NULL AND isMainContainer = 0 LIMIT 1`;
              const alacarteExists = await new Promise((res, rej) => {
                connection.query(checkAlacarteSql, [orderId], (err, results) => {
                  if (err) return rej(err);
                  res(results || []);
                });
              });

              if (alacarteExists.length === 0) {
                const insertTrackingSql = `
                  INSERT INTO positiontracking (orderId, orderpackageId, pIndex, isMainContainer, createdAt) 
                  VALUES (?, NULL, 1, 0, NOW())
                `;
                await new Promise((res, rej) => {
                  connection.query(insertTrackingSql, [orderId], (err, result) => {
                    if (err) return rej(err);
                    res(result);
                  });
                });
              }
            }
          }

          connection.commit((commitErr) => {
            if (commitErr) {
              connection.rollback(() => {
                connection.release();
                reject(commitErr);
              });
              return;
            }
            connection.release();
            resolve({ success: true, orderStatus: "Opened", orderpackageId: validPackageId, isMainContainer: !!isMainContainer, pIndex: 1 });
          });

        } catch (error) {
          connection.rollback(() => {
            connection.release();
            reject(error);
          });
        }
      });
    });
  });
};

/**
 * Increment positiontracking.pIndex = pIndex + 1 when packer clicks skip or completed
 * @param {number} orderId 
 * @param {number|null} orderpackageId 
 * @returns {Promise<Object>}
 */
exports.advancePositionIndex = (orderId, orderpackageId = null, currentPIndex = null, officerId = null, trackingId = null) => {
  return new Promise((resolve, reject) => {
    const nextStep = currentPIndex ? Number(currentPIndex) + 1 : null;
    const isMainContainer = (orderpackageId === -1 || orderpackageId === "-1");
    const isPackageIdValid =
      orderpackageId !== null &&
      orderpackageId !== undefined &&
      orderpackageId !== "alacarte" &&
      !isMainContainer &&
      !isNaN(Number(orderpackageId));
    const resolvedTrackingId = trackingId ? Number(trackingId) : null;

    // First: dynamically get the QC pIndex for this row so we know if nextStep is a real station
    const getQcPIndexSql = `
      SELECT 
        COALESCE(
          (
            SELECT MAX(pp.pIndex)
            FROM packingpositions pp
            WHERE pp.rowId = dt.rowId AND pp.pType = 'NOR'
          ) + 1,
          2
        ) AS qcPIndex
      FROM distributedtargetitems dti
      JOIN distributedtarget dt ON dti.targetId = dt.id
      WHERE dti.orderId = ?
      LIMIT 1
    `;

    db.collectionofficer.query(getQcPIndexSql, [orderId], async (qcErr, qcRows) => {
      const qcPIndex = (qcRows && qcRows.length > 0 ? qcRows[0].qcPIndex : null) || 3;
      const maxPIndex = qcPIndex + 1; // one step beyond QC = completed

      // Determine if current box being advanced is Main Container
      let isCurrentBoxMainContainer = (orderpackageId === -1 || orderpackageId === "-1");
      if (!isCurrentBoxMainContainer && resolvedTrackingId) {
        // Use trackingId PK for precise detection if available
        const checkCurrentBoxSql = `SELECT isMainContainer FROM positiontracking WHERE id = ? LIMIT 1`;
        const currentBoxRows = await new Promise((res) => {
          db.collectionofficer.query(checkCurrentBoxSql, [resolvedTrackingId], (err, results) => res(results || []));
        });
        if (currentBoxRows.length > 0 && (Number(currentBoxRows[0].isMainContainer) === 1 || currentBoxRows[0].isMainContainer === true)) {
          isCurrentBoxMainContainer = true;
        }
      }

      // Main Container Priority Check: A package/alacarte cannot advance unless the Main Container
      // is already AT or PAST the same pIndex (i.e., main container was already handled at this station).
      // In other words: mainPIndex must be >= nextStep (main container is ahead of or equal to nextStep).
      if (!isCurrentBoxMainContainer && nextStep) {
        try {
          const getCountsSql = `
            SELECT 
              (SELECT COALESCE(SUM(COALESCE(qty, 1)), 0) FROM market_place.orderpackage WHERE orderId = po.id OR orderId = po.orderId) AS packagesCount,
              (SELECT COUNT(*) FROM market_place.orderadditionalitems WHERE orderId = po.orderId) AS alacarteCount
            FROM market_place.processorders po
            WHERE po.id = ?
            LIMIT 1
          `;
          const countsRes = await new Promise((res) => {
            db.collectionofficer.query(getCountsSql, [orderId], (err, results) => {
              res(results || []);
            });
          });

          const pCount = countsRes.length > 0 ? Number(countsRes[0].packagesCount || 0) : 0;
          const aCount = countsRes.length > 0 ? Number(countsRes[0].alacarteCount || 0) : 0;
          const totalPhysicalBoxes = pCount + (aCount > 0 ? 1 : 0);

          if (totalPhysicalBoxes > 1) {
            // Check the MAXIMUM pIndex the main container has reached so far
            const checkMainSql = `
              SELECT pIndex FROM positiontracking 
              WHERE orderId = ? AND isMainContainer = 1 
              LIMIT 1
            `;
            const mainRows = await new Promise((res) => {
              db.collectionofficer.query(checkMainSql, [orderId], (err, results) => {
                res(results || []);
              });
            });

            const mainPIndex = mainRows.length > 0 ? Number(mainRows[0].pIndex) : 0;
            // Block only if main container hasn't moved past the CURRENT station yet
            // (main container must be at nextStep or beyond before packages can advance to nextStep)
            if (mainPIndex < nextStep) {
              return resolve({
                success: false,
                message: "This box cannot advance because the Main Container for this order has not been packed at this station yet."
              });
            }
          }
        } catch (mainErr) {
          console.error("Error in Main Container Priority Check:", mainErr);
        }
      }

      // Only check for station busy if nextStep is <= qcPIndex (still a real station)
      // If nextStep > qcPIndex, the box is leaving QC — no next station to block it
      console.log("=== ADVANCE POSITION DIAGNOSTIC ===", { orderId, orderpackageId, currentPIndex, nextStep, qcPIndex, isMainContainer, isPackageIdValid });
      if (nextStep && nextStep <= qcPIndex) {
        const targetStationName = nextStep === qcPIndex ? "QC Station" : `Packing Position ${nextStep}`;

        // 1. Officer Assignment Check for target position
        const checkOfficerNextSql = `
          SELECT tp.id, tp.officerId
          FROM targetposition tp
          JOIN packingpositions pp ON tp.positionId = pp.id
          JOIN distributedtarget dt ON (tp.targetId = dt.id OR pp.rowId = dt.rowId)
          JOIN distributedtargetitems dti ON dt.id = dti.targetId
          WHERE dti.orderId = ? 
            AND DATE(tp.createdAt) = CURDATE()
            AND (
              (${nextStep} = ${qcPIndex} AND pp.pType = 'QC') OR
              (pp.pType = 'NOR' AND pp.pIndex = ${nextStep})
            )
          LIMIT 1
        `;

        db.collectionofficer.query(checkOfficerNextSql, [orderId], async (offErr, offRows) => {
          if (offErr) {
            console.error("Error checking officer assignment for next station:", offErr);
          }

          console.log("=== OFFICER NEXT ROWS ===", offRows);

          if (!offRows || offRows.length === 0) {
            return resolve({
              success: false,
              code: "NO_OFFICER_ASSIGNED",
              message: `No packing position user assigned for ${targetStationName}. Please assign an officer to this position first.`
            });
          }

          // 2. Station Occupation Check for nextStep (Blocks advancing if target station is occupied)
          const occupiedErr = await validateNextPositionBusy(
            db.collectionofficer,
            orderId,
            nextStep,
            targetStationName
          );

          if (occupiedErr) {
            return resolve(occupiedErr);
          }

          executeUpdate(qcPIndex, maxPIndex);
        });
      } else {
        console.log("=== ADVANCING PAST QC ===", { nextStep, qcPIndex });
        // nextStep > qcPIndex → advancing past QC (completing QC) — no busy check needed
        executeUpdate(qcPIndex, maxPIndex);
      }
    });

    function executeUpdate(qcPIndex, maxPIndex) {
      let sql;
      let params;

      // If we have a precise trackingId PK, target exactly that row
      if (resolvedTrackingId) {
        sql = `
          UPDATE positiontracking 
          SET pIndex = LEAST(pIndex + 1, ?) 
          WHERE id = ? AND pIndex > 0
        `;
        params = [maxPIndex, resolvedTrackingId];
      } else {
        sql = `
          UPDATE positiontracking 
          SET pIndex = LEAST(pIndex + 1, ?) 
          WHERE orderId = ? AND pIndex > 0
        `;
        params = [maxPIndex, orderId];

        if (isCurrentBoxMainContainer) {
          sql += ` AND isMainContainer = 1`;
        } else if (isPackageIdValid) {
          sql += ` AND orderpackageId = ? AND isMainContainer = 0`;
          params.push(Number(orderpackageId));
        } else {
          sql += ` AND (orderpackageId IS NULL OR orderpackageId = 0) AND isMainContainer = 0`;
        }

        if (currentPIndex !== null && currentPIndex > 0) {
          sql += ` AND pIndex = ?`;
          params.push(Number(currentPIndex));
        }

        sql += ` LIMIT 1`;
      }

      console.log("=== DAO EXECUTE UPDATE SQL ===", sql, params);

      db.collectionofficer.query(sql, params, async (err, result) => {
        if (err) {
          console.error("Error in advancePositionIndex:", err);
          return reject(err);
        }
        console.log("=== DAO EXECUTE UPDATE RESULT ===", result);

        if (!result || result.affectedRows === 0) {
          // When targeting a specific box by its positiontracking.id PK, do NOT do a broad
          // delete-all-insert — that would wipe every row for the same package.
          // Instead, report the box as already advanced or unavailable.
          if (resolvedTrackingId) {
            return resolve({
              success: false,
              affectedRows: 0,
              message: "This box has already been advanced or is unavailable."
            });
          }

          const deleteStaleSql = isMainContainer
            ? `DELETE FROM positiontracking WHERE orderId = ? AND isMainContainer = 1`
            : isPackageIdValid
              ? `DELETE FROM positiontracking WHERE orderId = ? AND orderpackageId = ?`
              : `DELETE FROM positiontracking WHERE orderId = ? AND (orderpackageId IS NULL OR orderpackageId = 0) AND isMainContainer = 0`;
          const deleteParams = isPackageIdValid ? [orderId, Number(orderpackageId)] : [orderId];

          db.collectionofficer.query(deleteStaleSql, deleteParams, () => {
            const insertSql = isMainContainer
              ? `INSERT INTO positiontracking (orderId, orderpackageId, pIndex, isMainContainer, createdAt) VALUES (?, NULL, ?, 1, NOW())`
              : `INSERT INTO positiontracking (orderId, orderpackageId, pIndex, isMainContainer, createdAt) VALUES (?, ?, ?, 0, NOW())`;
            const insertParams = isMainContainer
              ? [orderId, nextStep || 1]
              : [orderId, isPackageIdValid ? Number(orderpackageId) : null, nextStep || 1];

            db.collectionofficer.query(insertSql, insertParams, async (insErr, insRes) => {
              if (insErr) {
                console.error("Error inserting fallback positiontracking:", insErr);
                return resolve({
                  success: false,
                  affectedRows: 0,
                  message: "The next station is currently busy or the package has already been cleared."
                });
              }
              // Save packId + packingTime for this packer on items (skip for Main Container)
              if (!isMainContainer) {
                await savePackerOnItems(orderId, isPackageIdValid ? Number(orderpackageId) : null);
              }
              resolve({ success: true, affectedRows: insRes.affectedRows || 1 });
            });
          });
          return;
        }

        // Save packId + packingTime for this packer on items (skip for Main Container)
        if (!isMainContainer) {
          await savePackerOnItems(orderId, isPackageIdValid ? Number(orderpackageId) : null);
        }
        resolve({ success: true, affectedRows: result.affectedRows });
      });
    }

    // Save the packer's targetposition.id and packingTime on the order items
    async function savePackerOnItems(orderId, orderpackageId) {
      try {
        let targetPositionId = null;

        // 1. If we have the logged-in officerId, try to resolve targetposition by officerId first
        if (officerId) {
          const officerTpSql = `
            SELECT id AS targetPositionId
            FROM targetposition
            WHERE officerId = ? AND DATE(createdAt) = CURDATE()
            ORDER BY id DESC LIMIT 1
          `;
          const officerTpRows = await new Promise((res) => {
            db.collectionofficer.query(officerTpSql, [officerId], (e, r) => res(r || []));
          });
          if (officerTpRows && officerTpRows.length > 0) {
            targetPositionId = officerTpRows[0].targetPositionId;
          }
        }

        // 2. Fallback: If not found or officerId not supplied, try to resolve by currentPIndex
        if (!targetPositionId && currentPIndex && Number(currentPIndex) > 0) {
          const tpSql = `
            SELECT tp.id AS targetPositionId
            FROM targetposition tp
            JOIN packingpositions pp ON tp.positionId = pp.id
            JOIN distributedtargetitems dti ON dti.orderId = ?
            JOIN distributedtarget dt ON dti.targetId = dt.id
            WHERE pp.rowId = dt.rowId
              AND pp.pType = 'NOR'
              AND pp.pIndex = ?
              AND DATE(tp.createdAt) = CURDATE()
            ORDER BY tp.id DESC LIMIT 1
          `;
          const tpRows = await new Promise((res) => {
            db.collectionofficer.query(tpSql, [orderId, Number(currentPIndex)], (e, r) => res(r || []));
          });
          if (tpRows && tpRows.length > 0) {
            targetPositionId = tpRows[0].targetPositionId;
          }
        }

        if (!targetPositionId) return;

        // Check if this position has specific crops assigned in positionscrops
        const posCropSql = `
          SELECT pc.mpiId 
          FROM targetposition tp
          JOIN positionscrops pc ON tp.positionId = pc.posId
          WHERE tp.id = ? AND pc.mpiId IS NOT NULL
        `;
        const posCrops = await new Promise((res) => {
          db.collectionofficer.query(posCropSql, [targetPositionId], (e, r) => res(r || []));
        });

        const assignedMpiIds = posCrops.map((c) => Number(c.mpiId));

        if (orderpackageId !== null && orderpackageId !== undefined) {
          // Package items
          if (assignedMpiIds.length > 0) {
            // Update items assigned specifically to this position's crops
            await new Promise((res) => {
              db.collectionofficer.query(
                `UPDATE market_place.orderpackageitems 
                 SET packId = ?, packingTime = NOW(), isPacked = 1 
                 WHERE orderPackageId = ? 
                   AND (productId IN (?) OR productType IN (?))`,
                [targetPositionId, orderpackageId, assignedMpiIds, assignedMpiIds],
                (e, r) => res(r)
              );
            });
          } else {
            // No specific crops assigned — update unassigned/unpacked items
            await new Promise((res) => {
              db.collectionofficer.query(
                `UPDATE market_place.orderpackageitems 
                 SET packId = ?, packingTime = NOW(), isPacked = 1 
                 WHERE orderPackageId = ? AND (packId IS NULL OR packId = 0)`,
                [targetPositionId, orderpackageId],
                (e, r) => res(r)
              );
            });
          }
        } else {
          // Alacarte items
          if (assignedMpiIds.length > 0) {
            await new Promise((res) => {
              db.collectionofficer.query(
                `UPDATE market_place.orderadditionalitems oai
                 JOIN market_place.processorders po ON oai.orderId = po.orderId
                 SET oai.packId = ?, oai.packingTime = NOW(), oai.isPacked = 1
                 WHERE po.id = ? AND oai.productId IN (?)`,
                [targetPositionId, orderId, assignedMpiIds],
                (e, r) => res(r)
              );
            });
          } else {
            await new Promise((res) => {
              db.collectionofficer.query(
                `UPDATE market_place.orderadditionalitems oai
                 JOIN market_place.processorders po ON oai.orderId = po.orderId
                 SET oai.packId = ?, oai.packingTime = NOW(), oai.isPacked = 1
                 WHERE po.id = ? AND (oai.packId IS NULL OR oai.packId = 0)`,
                [targetPositionId, orderId],
                (e, r) => res(r)
              );
            });
          }
        }
      } catch (e) {
        console.error("savePackerOnItems error (non-fatal):", e.message);
      }
    }
  });
};

/**
 * Mark orderStatus = 'Completed' when QC completes inspection
 * @param {number} orderId 
 * @returns {Promise<Object>}
 */
exports.markOrderAsCompleted = (orderId, officerId = null) => {
  return new Promise((resolve, reject) => {
    // Step 1: Dynamically get the QC position's pIndex for this order's row
    // Completion = pIndex > qcPIndex (i.e. box has moved past QC station)
    const getQcPIndexSql = `
      SELECT 
        COALESCE(
          (
            SELECT MAX(pp.pIndex)
            FROM packingpositions pp
            WHERE pp.rowId = dt.rowId AND pp.pType = 'NOR'
          ) + 1,
          2
        ) AS qcPIndex
      FROM distributedtargetitems dti
      JOIN distributedtarget dt ON dti.targetId = dt.id
      WHERE dti.orderId = ?
      LIMIT 1
    `;
    db.collectionofficer.query(getQcPIndexSql, [orderId], (qcErr, qcRows) => {
      if (qcErr) {
        console.error("Error getting QC pIndex:", qcErr);
        return reject(qcErr);
      }
      const qcPIndex = (qcRows && qcRows.length > 0 ? qcRows[0].qcPIndex : null) || 3;

      // Step 2: Count total boxes vs boxes that have passed QC (pIndex > qcPIndex)
      const checkSql = `
        SELECT COUNT(*) AS totalBoxes,
               SUM(CASE WHEN pIndex > ? THEN 1 ELSE 0 END) AS completedBoxes
        FROM positiontracking
        WHERE orderId = ?
      `;
      db.collectionofficer.query(checkSql, [qcPIndex, orderId], (err, rows) => {
        if (err) {
          console.error("Error checking box completion status:", err);
          return reject(err);
        }

        const total = rows[0]?.totalBoxes || 0;
        const completed = rows[0]?.completedBoxes || 0;

        console.log(`=== QC COMPLETION CHECK: orderId=${orderId} qcPIndex=${qcPIndex} total=${total} completed=${completed}`);

        if (total > 0 && completed >= total) {
          // All boxes have passed QC — mark order as Completed
          const updateDtiSql = `
            UPDATE distributedtargetitems 
            SET orderStatus = 'Completed', isComplete = 1, completeTime = NOW()
            WHERE orderId = ?
          `;
          db.collectionofficer.query(updateDtiSql, [orderId], (uErr) => {
            if (uErr) return reject(uErr);

            // Update processorders: packBy, packTime, and status based on Delivery Method
            const updatePoSql = `
              UPDATE market_place.processorders po
              JOIN market_place.orders o ON po.orderId = o.id
              SET 
                po.packBy = COALESCE(?, po.packBy),
                po.packTime = NOW(),
                po.status = CASE 
                  WHEN LOWER(COALESCE(o.delivaryMethod, '')) = 'pickup' THEN 'Ready to Pickup'
                  ELSE 'Out For Delivery'
                END
              WHERE po.id = ?
            `;
            db.collectionofficer.query(updatePoSql, [officerId, orderId], (poErr) => {
              if (poErr) {
                console.error("Error updating processorders on QC completion:", poErr);
              }
              resolve({ success: true, isFullyCompleted: true, orderStatus: "Completed" });
            });
          });
        } else {
          // More boxes still pending QC
          resolve({ success: true, isFullyCompleted: false, orderStatus: "Opened" });
        }
      });
    });
  });
};

/**
 * Get tracking status for a process order
 * @param {number} orderId 
 * @returns {Promise<Object>}
 */
exports.getOrderTrackingStatus = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        dti.orderId,
        dti.orderStatus,
        pt.orderpackageId,
        pt.pIndex
      FROM distributedtargetitems dti
      LEFT JOIN positiontracking pt ON dti.orderId = pt.orderId
      WHERE dti.orderId = ?
    `;
    db.collectionofficer.query(sql, [orderId], (err, results) => {
      if (err) {
        console.error("Error in getOrderTrackingStatus:", err);
        return reject(err);
      }
      if (results.length === 0) {
        return resolve({ orderStatus: "Pending", pIndex: 0 });
      }
      resolve({
        orderStatus: results[0].orderStatus,
        pIndex: results[0].pIndex || 0,
        packages: results
      });
    });
  });
};

/**
 * Get active order details for logged-in officer today
 * @param {number} officerId 
 * @returns {Promise<Object|null>}
 */
exports.getOfficerActiveOrder = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        po.id AS processOrderId,
        po.orderId AS orderId,
        po.invNo AS orderNumber,
        dt.timeSlot,
        CASE 
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'dash' OR LOWER(COALESCE(o.orderApp, '')) = 'wholesale' THEN 'W'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'wholesale' THEN 'W'
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'marketplace' OR LOWER(COALESCE(o.orderApp, '')) = 'retail' THEN 'R'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'retail' THEN 'R'
          ELSE 'W' 
        END AS orderType,
        CONCAT(po.invNo, ' (', CASE 
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'dash' OR LOWER(COALESCE(o.orderApp, '')) = 'wholesale' THEN 'W'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'wholesale' THEN 'W'
          WHEN LOWER(COALESCE(o.orderApp, '')) = 'marketplace' OR LOWER(COALESCE(o.orderApp, '')) = 'retail' THEN 'R'
          WHEN TRIM(LOWER(COALESCE(u.buyerType, ''))) = 'retail' THEN 'R'
          ELSE 'W' 
        END, ')') AS formattedOrderNumber,
        dti.orderStatus,
        COALESCE(
          pp.pIndex,
          (SELECT MAX(pp2.pIndex) + 1 FROM packingpositions pp2 WHERE pp2.rowId = pp.rowId AND pp2.pType = 'NOR'),
          3
        ) AS officerPosIndex,
        pp.id AS positionId,
        COALESCE(
          (SELECT pt_sub.pIndex FROM positiontracking pt_sub WHERE pt_sub.orderId = po.id
            AND pt_sub.pIndex = COALESCE(
              pp.pIndex,
              (SELECT MAX(pp2.pIndex) + 1 FROM packingpositions pp2 WHERE pp2.rowId = pp.rowId AND pp2.pType = 'NOR'),
              3
            ) ORDER BY pt_sub.id ASC LIMIT 1),
          (SELECT MIN(pt_sub2.pIndex) FROM positiontracking pt_sub2 WHERE pt_sub2.orderId = po.id AND pt_sub2.pIndex > 0),
          (SELECT MAX(pt_sub3.pIndex) FROM positiontracking pt_sub3 WHERE pt_sub3.orderId = po.id),
          0
        ) AS pIndex,
        (SELECT pt_sub4.id FROM positiontracking pt_sub4 WHERE pt_sub4.orderId = po.id
          AND pt_sub4.pIndex = COALESCE(
            pp.pIndex,
            (SELECT MAX(pp2.pIndex) + 1 FROM packingpositions pp2 WHERE pp2.rowId = pp.rowId AND pp2.pType = 'NOR'),
            3
          ) ORDER BY pt_sub4.id ASC LIMIT 1) AS trackingId,
        (SELECT pt_sub4b.orderpackageId FROM positiontracking pt_sub4b WHERE pt_sub4b.orderId = po.id
          AND pt_sub4b.pIndex = COALESCE(
            pp.pIndex,
            (SELECT MAX(pp2.pIndex) + 1 FROM packingpositions pp2 WHERE pp2.rowId = pp.rowId AND pp2.pType = 'NOR'),
            3
          ) AND pt_sub4b.isMainContainer = 0 ORDER BY pt_sub4b.id ASC LIMIT 1) AS activeOrderPackageId,
        (SELECT EXISTS(SELECT 1 FROM positiontracking pt_sub5 WHERE pt_sub5.orderId = po.id
          AND pt_sub5.pIndex = COALESCE(
            pp.pIndex,
            (SELECT MAX(pp2.pIndex) + 1 FROM packingpositions pp2 WHERE pp2.rowId = pp.rowId AND pp2.pType = 'NOR'),
            3
          ) AND pt_sub5.orderpackageId IS NULL AND pt_sub5.isMainContainer = 0)) AS isAlacarteActive,
        (SELECT EXISTS(SELECT 1 FROM positiontracking pt_sub6 WHERE pt_sub6.orderId = po.id
          AND pt_sub6.pIndex = COALESCE(
            pp.pIndex,
            (SELECT MAX(pp2.pIndex) + 1 FROM packingpositions pp2 WHERE pp2.rowId = pp.rowId AND pp2.pType = 'NOR'),
            3
          ) AND pt_sub6.isMainContainer = 1)) AS isMainContainerActive
      FROM targetposition tp
      JOIN packingpositions pp ON tp.positionId = pp.id
      LEFT JOIN distributedtarget dt_tp ON tp.targetId = dt_tp.id
      JOIN distributedtarget dt ON (
        dt.id = tp.targetId 
        OR (pp.rowId = dt.rowId AND DATE(dt.createdAt) = COALESCE(DATE(dt_tp.createdAt), CURDATE()))
      )
      JOIN distributedtargetitems dti ON dt.id = dti.targetId
      JOIN market_place.processorders po ON dti.orderId = po.id
      JOIN market_place.orders o ON po.orderId = o.id
      LEFT JOIN market_place.marketplaceusers u ON o.userId = u.id
      WHERE tp.id = (
        SELECT MAX(tp_sub.id) 
        FROM targetposition tp_sub 
        WHERE tp_sub.officerId = ? AND DATE(tp_sub.createdAt) = CURDATE()
      )
      AND dti.orderStatus = 'Opened'
      AND EXISTS (
        SELECT 1 FROM positiontracking pt_ex 
        WHERE pt_ex.orderId = po.id
      )
      ORDER BY 
        (SELECT COUNT(*) FROM positiontracking pt_act 
         WHERE pt_act.orderId = po.id 
           AND pt_act.pIndex = COALESCE(
             pp.pIndex,
             (SELECT MAX(pp2.pIndex) + 1 FROM packingpositions pp2 WHERE pp2.rowId = pp.rowId AND pp2.pType = 'NOR'),
             3
           )
        ) DESC,
        po.id ASC
      LIMIT 1
    `;
    db.collectionofficer.query(sql, [officerId], async (err, results) => {
      if (err) {
        console.error("Error in getOfficerActiveOrder:", err);
        return resolve(null);
      }
      if (results.length === 0) return resolve(null);

      const activeOrder = results[0];

      // Query packagesList and alacarteCount for steps construction
      try {
        const pkgSql = `
          SELECT op.id, GREATEST(COALESCE(op.qty, 1), 1) AS qty, COALESCE(mp.displayName, 'Package') AS name
          FROM market_place.orderpackage op
          LEFT JOIN market_place.marketplacepackages mp ON op.packageId = mp.id
          WHERE op.orderId = ?
        `;
        const packagesList = await new Promise((res) => {
          db.collectionofficer.query(pkgSql, [activeOrder.processOrderId], (e, r) => res(r || []));
        });

        const alacarteSql = `
          SELECT COUNT(*) AS count
          FROM market_place.orderadditionalitems
          WHERE orderId = ?
        `;
        const alacarteRes = await new Promise((res) => {
          db.collectionofficer.query(alacarteSql, [activeOrder.orderId], (e, r) => res(r || []));
        });
        const alacarteCount = alacarteRes.length > 0 ? alacarteRes[0].count : 0;

        const trackingSql = `
          SELECT id, orderpackageId, pIndex, isMainContainer 
          FROM positiontracking 
          WHERE orderId = ?
          ORDER BY id ASC
        `;
        const trackingRows = await new Promise((res) => {
          db.collectionofficer.query(trackingSql, [activeOrder.processOrderId], (e, r) => res(r || []));
        });

        activeOrder.packagesList = packagesList;
        activeOrder.alacarteCount = alacarteCount;
        activeOrder.trackingRows = trackingRows;
      } catch (stepErr) {
        console.error("Error fetching steps info:", stepErr);
        activeOrder.packagesList = [];
        activeOrder.alacarteCount = 0;
        activeOrder.trackingRows = [];
      }

      try {
        let itemsSql = "";
        let queryParams = [];

        if (Number(activeOrder.isMainContainerActive) === 1) {
          // Main Container is active! We bridge it as -1 to the client and return 0 items.
          activeOrder.activeOrderPackageId = -1;
          activeOrder.isMainContainerBox = true;
          itemsSql = `SELECT 1 LIMIT 0`;
          queryParams = [];
        } else if (activeOrder.activeOrderPackageId) {
          // A specific package box is currently at this packer station!
          itemsSql = `
            SELECT 
              opi.id AS id,
              mi.displayName AS name,
              CONCAT(COALESCE(opi.qty, 1), ' kg') AS weight,
              cv.image AS image,
              mi.id AS mpiId,
              opi.productType AS productTypeId,
              mp.displayName AS packName,
              'package' AS categoryType
            FROM market_place.orderpackage op
            JOIN market_place.marketplacepackages mp ON op.packageId = mp.id
            JOIN market_place.orderpackageitems opi ON op.id = opi.orderPackageId
            JOIN market_place.marketplaceitems mi ON opi.productId = mi.id
            LEFT JOIN plant_care.cropvariety cv ON mi.varietyId = cv.id
            WHERE op.id = ? AND mi.id IS NOT NULL
          `;
          queryParams = [activeOrder.activeOrderPackageId];
        } else if (activeOrder.isAlacarteActive) {
          // The À la carte box is currently at this station!
          itemsSql = `
            SELECT 
              mi.id,
              mi.displayName AS name,
              CONCAT(SUM(COALESCE(oai.qty, 1)), ' ', COALESCE(NULLIF(TRIM(MAX(oai.unit)), ''), 'kg')) AS weight,
              cv.image AS image,
              mi.id AS mpiId,
              NULL AS productTypeId,
              'À la carte' AS packName,
              'alacarte' AS categoryType
            FROM market_place.processorders po
            JOIN market_place.orderadditionalitems oai ON po.orderId = oai.orderId
            JOIN market_place.marketplaceitems mi ON oai.productId = mi.id
            LEFT JOIN plant_care.cropvariety cv ON mi.varietyId = cv.id
            WHERE po.id = ? AND mi.id IS NOT NULL
            GROUP BY mi.id
          `;
          queryParams = [activeOrder.processOrderId];
        } else {
          itemsSql = `
            SELECT 
              mi.id,
              mi.displayName AS name,
              CONCAT(SUM(COALESCE(opi.qty, 1)), ' kg') AS weight,
              cv.image AS image,
              mi.id AS mpiId,
              opi.productType AS productTypeId,
              mp.displayName AS packName,
              'package' AS categoryType
            FROM market_place.processorders po
            JOIN market_place.orderpackage op ON (op.orderId = po.id OR op.orderId = po.orderId)
            JOIN market_place.marketplacepackages mp ON op.packageId = mp.id
            JOIN market_place.orderpackageitems opi ON op.id = opi.orderPackageId
            JOIN market_place.marketplaceitems mi ON opi.productId = mi.id
            LEFT JOIN plant_care.cropvariety cv ON mi.varietyId = cv.id
            WHERE po.id = ?
            GROUP BY op.id, mi.id, opi.productType, mp.displayName

            UNION ALL

            SELECT 
              mi.id,
              mi.displayName AS name,
              CONCAT(SUM(COALESCE(oai.qty, 1)), ' ', COALESCE(NULLIF(TRIM(MAX(oai.unit)), ''), 'kg')) AS weight,
              cv.image AS image,
              mi.id AS mpiId,
              NULL AS productTypeId,
              'À la carte' AS packName,
              'alacarte' AS categoryType
            FROM market_place.processorders po
            JOIN market_place.orderadditionalitems oai ON po.orderId = oai.orderId
            JOIN market_place.marketplaceitems mi ON oai.productId = mi.id
            LEFT JOIN plant_care.cropvariety cv ON mi.varietyId = cv.id
            WHERE po.id = ?
            GROUP BY mi.id
          `;
          queryParams = [activeOrder.processOrderId, activeOrder.processOrderId];
        }

        const orderItems = await new Promise((res) => {
          db.collectionofficer.query(itemsSql, queryParams, (e, r) => {
            if (e) return res([]);
            res(r || []);
          });
        });

        // Fetch position assigned crops from positionscrops
        const posCropsSql = `SELECT mpiId FROM positionscrops WHERE posId = ? AND mpiId IS NOT NULL`;
        const posCrops = await new Promise((res) => {
          db.collectionofficer.query(posCropsSql, [activeOrder.positionId], (e, r) => {
            if (e) return res([]);
            res(r || []);
          });
        });

        if (posCrops.length > 0) {
          const posMpiIds = posCrops.map((c) => Number(c.mpiId));
          // Filter order items that match position crops by marketplaceitem ID OR productType ID
          activeOrder.orderItems = orderItems.filter(
            (item) => posMpiIds.includes(Number(item.mpiId)) || posMpiIds.includes(Number(item.productTypeId))
          );
        } else {
          activeOrder.orderItems = orderItems;
        }

        // Sort items A to Z (ascending alphabetical order by item name)
        activeOrder.orderItems.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        activeOrder.allOrderItems = orderItems;
      } catch (e) {
        console.error("Error populating order items in getOfficerActiveOrder:", e);
        activeOrder.orderItems = [];
        activeOrder.allOrderItems = [];
      }

      resolve(activeOrder);
    });
  });
};

/**
 * Helper to check if officer's row has remaining orders to process today
 */
exports.getRowStatusForOfficer = (officerId) => {
  return new Promise((resolve) => {
    const sql = `
      SELECT tp.id, pp.rowId, pp.pIndex AS officerPIndex, pp.pType
      FROM targetposition tp
      JOIN packingpositions pp ON tp.positionId = pp.id
      WHERE tp.id = (
        SELECT MAX(tp_sub.id)
        FROM targetposition tp_sub
        WHERE tp_sub.officerId = ? AND DATE(tp_sub.createdAt) = CURDATE()
      )
    `;
    db.collectionofficer.query(sql, [officerId], (err, rows) => {
      if (err || !rows || rows.length === 0) {
        return resolve({ rowStatus: "NO_DAILY_TARGET", activeCount: 0 });
      }
      const rowId = rows[0].rowId;
      const countSql = `
        SELECT COUNT(*) AS activeCount
        FROM distributedtarget dt
        JOIN distributedtargetitems dti ON dt.id = dti.targetId
        WHERE dt.rowId = ? AND DATE(dt.createdAt) = CURDATE() AND dti.orderStatus IN ('Pending', 'Opened')
      `;
      db.collectionofficer.query(countSql, [rowId], (err2, countRows) => {
        const activeCount = countRows && countRows.length > 0 ? countRows[0].activeCount : 0;
        if (activeCount > 0) {
          resolve({ rowStatus: "WAITING_PREVIOUS", activeCount });
        } else {
          resolve({ rowStatus: "NO_DAILY_TARGET", activeCount: 0 });
        }
      });
    });
  });
};

/**
 * Dedicated active order fetch for Packer Officers (P1, P2... Pn)
 */
exports.getPackerActiveOrder = async (officerId) => {
  const activeOrder = await exports.getOfficerActiveOrder(officerId);
  if (activeOrder && activeOrder.pIndex > 0 && Number(activeOrder.pIndex) === Number(activeOrder.officerPosIndex)) {
    return { ...activeOrder, hasActiveBox: true };
  }
  const statusInfo = await exports.getRowStatusForOfficer(officerId);
  if (activeOrder) {
    return { ...activeOrder, ...statusInfo, hasActiveBox: false };
  }
  return { ...statusInfo, hasActiveBox: false };
};

/**
 * Dedicated active order fetch for QC Officers
 */
exports.getQCActiveOrder = async (officerId) => {
  const activeOrder = await exports.getOfficerActiveOrder(officerId);
  if (activeOrder && activeOrder.pIndex > 0 && Number(activeOrder.pIndex) === Number(activeOrder.officerPosIndex)) {
    return { ...activeOrder, hasActiveBox: true };
  }
  const statusInfo = await exports.getRowStatusForOfficer(officerId);
  if (activeOrder) {
    return { ...activeOrder, ...statusInfo, hasActiveBox: false };
  }
  return { ...statusInfo, hasActiveBox: false };
};

/**
 * Release logged-in officer's active position today (setting isFinished = 0)
 * @param {number} officerId
 * @returns {Promise<Object>}
 */
exports.releaseOfficerPosition = (officerId) => {
  return new Promise((resolve, reject) => {
    const findSql = `
      SELECT id, positionId FROM targetposition 
      WHERE officerId = ? AND DATE(createdAt) = CURDATE() AND isFinished = 1
      ORDER BY id DESC LIMIT 1
    `;
    db.collectionofficer.query(findSql, [officerId], (err, results) => {
      if (err) {
        console.error("Error finding targetposition for release:", err);
        return reject(err);
      }
      if (results.length === 0) {
        return resolve({ success: true, message: "No active assignment found." });
      }

      const tpId = results[0].id;
      const positionId = results[0].positionId;

      const updateSql = `
        UPDATE targetposition 
        SET isFinished = 0 
        WHERE id = ?
      `;
      db.collectionofficer.query(updateSql, [tpId], (upErr, upResults) => {
        if (upErr) {
          console.error("Error releasing position:", upErr);
          return reject(upErr);
        }
        resolve({ success: true, positionId });
      });
    });
  });
};

