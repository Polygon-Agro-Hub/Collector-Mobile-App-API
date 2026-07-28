const db = require("../startup/database");

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
          COUNT(pp.id) - COUNT(DISTINCT CASE WHEN tp.id IS NOT NULL THEN pp.id END),
          0
        ) AS UNSIGNED) AS positionsCount
      FROM packingrows pr
      LEFT JOIN packingpositions pp ON pr.id = pp.rowId
      LEFT JOIN positionscrops pc ON pp.id = pc.posId
      LEFT JOIN targetposition tp ON pc.id = tp.positionId AND DATE(tp.createdAt) = CURDATE()
      WHERE pr.companyCenterId = ? AND pr.isEnabled = 1
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
      LEFT JOIN positionscrops pc ON pp.id = pc.posId
      LEFT JOIN targetposition tp ON pc.id = tp.positionId AND DATE(tp.createdAt) = CURDATE()
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
 * Assign or update officer position in targetposition
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
          // 1. Find or create the positionscrops record for this packingPositionId
          const getPosCropSql = `
            SELECT id FROM positionscrops 
            WHERE posId = ? 
            LIMIT 1
          `;
          let positionCropId = await new Promise((res, rej) => {
            connection.query(getPosCropSql, [packingPositionId], (err, results) => {
              if (err) return rej(err);
              res(results.length > 0 ? results[0].id : null);
            });
          });

          if (!positionCropId) {
            // Create record in positionscrops (with null mpiId)
            const insertPosCropSql = `
              INSERT INTO positionscrops (posId, mpiId, createdAt) 
              VALUES (?, NULL, NOW())
            `;
            const insertRes = await new Promise((res, rej) => {
              connection.query(insertPosCropSql, [packingPositionId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });
            positionCropId = insertRes.insertId;
          }

          // 2. Check if this position is occupied by another officer today
          const checkPosSql = `
            SELECT id, officerId FROM targetposition 
            WHERE positionId = ? AND DATE(createdAt) = CURDATE()
            LIMIT 1
          `;
          const posOccupant = await new Promise((res, rej) => {
            connection.query(checkPosSql, [positionCropId], (err, results) => {
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

          // 3. Check if this officer already has an assignment today
          const checkOfficerSql = `
            SELECT id FROM targetposition 
            WHERE officerId = ? AND DATE(createdAt) = CURDATE()
            LIMIT 1
          `;
          const existingAssignment = await new Promise((res, rej) => {
            connection.query(checkOfficerSql, [officerId], (err, results) => {
              if (err) return rej(err);
              res(results.length > 0 ? results[0] : null);
            });
          });

          if (existingAssignment) {
            // Update positionId
            const updateSql = `
              UPDATE targetposition 
              SET positionId = ?, createdAt = NOW() 
              WHERE id = ?
            `;
            await new Promise((res, rej) => {
              connection.query(updateSql, [positionCropId, existingAssignment.id], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });
          } else {
            // Insert new assignment
            const insertSql = `
              INSERT INTO targetposition (officerId, positionId, createdAt) 
              VALUES (?, ?, NOW())
            `;
            await new Promise((res, rej) => {
              connection.query(insertSql, [officerId, positionCropId], (err, result) => {
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
            resolve({ success: true });
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
 * Get today's target orders assigned to the officer's packing row
 * sorted by timeslot first and pickup orders first
 * @param {number} officerId 
 * @returns {Promise<Array>}
 */
exports.getQROrdersForOfficer = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        po.id AS id,
        po.invNo AS orderNumber,
        CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END AS type,
        dt.timeSlot,
        dti.orderStatus,
        CASE 
          WHEN o.delivaryMethod = 'Pickup' THEN 'Pickup Order' 
          ELSE COALESCE(oh.city, oa.city, 'Unknown')
        END AS category
      FROM distributedtarget dt
      JOIN distributedtargetitems dti ON dt.id = dti.targetId
      JOIN market_place.processorders po ON dti.orderId = po.id
      JOIN market_place.orders o ON po.orderId = o.id
      LEFT JOIN market_place.orderhouse oh ON o.id = oh.orderId
      LEFT JOIN market_place.orderapartment oa ON o.id = oa.orderId
      WHERE dt.rowId = (
        SELECT pp.rowId
        FROM targetposition tp
        JOIN packingpositions pp ON tp.positionId = pp.id
        WHERE tp.officerId = ? AND DATE(tp.createdAt) = CURDATE()
        LIMIT 1
      ) AND DATE(dt.createdAt) = CURDATE()
      ORDER BY 
        CASE dt.timeSlot 
          WHEN '8-12' THEN 1 
          WHEN '12-4' THEN 2 
          WHEN '4-9' THEN 3 
          ELSE 4 
        END ASC,
        CASE WHEN o.delivaryMethod = 'Pickup' THEN 1 ELSE 2 END ASC,
        po.invNo ASC
    `;
    db.collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Error in getQROrdersForOfficer:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};
