const db = require("../../startup/database");

/**
 * Get timeslot group counts for today scoped to a specific distribution company centre
 * @param {number} companyCenterId
 * @returns {Promise<Array>}
 */
exports.getGroupTimeslotCounts = (companyCenterId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        o.sheduleTime,
        COALESCE(mu.buyerType, 'Retail') AS buyerType,
        COUNT(po.id) AS totalCount,
        SUM(CASE WHEN dti.id IS NULL AND (po.isTargetAssigned IS NULL OR po.isTargetAssigned = 0) THEN 1 ELSE 0 END) AS leftCount
      FROM market_place.processorders po
      JOIN market_place.orders o ON po.orderId = o.id
      JOIN distributedcompanycenter dcen ON (o.centerId = dcen.centerId OR o.assignCoMCenId = dcen.id)
      LEFT JOIN market_place.marketplaceusers mu ON o.userId = mu.id
      LEFT JOIN distributedtargetitems dti ON po.id = dti.orderId
      WHERE DATE(o.sheduleDate) = CURDATE()
        AND dcen.id = ?
      GROUP BY o.sheduleTime, COALESCE(mu.buyerType, 'Retail')
    `;
    db.collectionofficer.query(sql, [companyCenterId], (err, results) => {
      if (err) {
        console.error("Error in getGroupTimeslotCounts:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

/**
 * Get unassigned process orders for a specific slot, orderApp, and company centre today
 * @param {string} sheduleTime 
 * @param {string} orderApp
 * @param {number} companyCenterId
 * @returns {Promise<Array>}
 */
exports.getUnassignedOrdersForGroup = (sheduleTime, buyerType, companyCenterId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        po.id AS id,
        po.invNo AS orderId,
        CASE WHEN o.delivaryMethod = 'Pickup' THEN 'pickup' ELSE 'delivery' END AS type,
        CASE 
          WHEN o.delivaryMethod = 'Pickup' THEN 'Pickup Order' 
          ELSE COALESCE(oh.city, oa.city, 'Unknown')
        END AS subtitle
      FROM market_place.processorders po
      JOIN market_place.orders o ON po.orderId = o.id
      JOIN distributedcompanycenter dcen ON (o.centerId = dcen.centerId OR o.assignCoMCenId = dcen.id)
      LEFT JOIN market_place.marketplaceusers mu ON o.userId = mu.id
      LEFT JOIN market_place.orderhouse oh ON o.id = oh.orderId
      LEFT JOIN market_place.orderapartment oa ON o.id = oa.orderId
      LEFT JOIN distributedtargetitems dti ON po.id = dti.orderId
      WHERE DATE(o.sheduleDate) = CURDATE()
        AND dti.id IS NULL
        AND (po.isTargetAssigned IS NULL OR po.isTargetAssigned = 0)
        AND COALESCE(mu.buyerType, 'Retail') = ?
        AND o.sheduleTime = ?
        AND dcen.id = ?
    `;
    db.collectionofficer.query(sql, [buyerType, sheduleTime, companyCenterId], (err, results) => {
      if (err) {
        console.error("Error in getUnassignedOrdersForGroup:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

/**
 * Get allocated counts for packing rows today
 * @returns {Promise<Array>}
 */
exports.getRowAllocationCounts = (companyCenterId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        pr.id,
        CONCAT('Row ', pr.rowIndex) AS name,
        CAST(COALESCE(COUNT(dti.id), 0) AS UNSIGNED) AS allocatedCount
      FROM packingrows pr
      LEFT JOIN distributedtarget dt ON pr.id = dt.rowId AND DATE(dt.createdAt) = CURDATE()
      LEFT JOIN distributedtargetitems dti ON dt.id = dti.targetId
      WHERE pr.isEnabled = 1 AND pr.companyCenterId = ?
      GROUP BY pr.id, pr.rowIndex
      ORDER BY pr.rowIndex ASC
    `;
    db.collectionofficer.query(sql, [companyCenterId], (err, results) => {
      if (err) {
        console.error("Error in getRowAllocationCounts:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

/**
 * Transactionally assign a set of process orders to a packing row for a timeslot
 * @param {number} rowId 
 * @param {string} timeSlotCode 
 * @param {Array<number>} orderIds 
 * @returns {Promise<Object>}
 */
exports.assignOrdersToRow = (rowId, timeSlotCode, orderIds) => {
  return new Promise((resolve, reject) => {
    if (!orderIds || orderIds.length === 0) {
      return resolve({ success: true, count: 0 });
    }

    db.collectionofficer.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting database connection:", err);
        return reject(err);
      }

      connection.beginTransaction(async (transactionErr) => {
        if (transactionErr) {
          connection.release();
          return reject(transactionErr);
        }

        try {
          // 0. Resolve packingrows.id if rowIndex was passed
          const resolveRowSql = `
            SELECT id FROM packingrows 
            WHERE id = ? OR rowIndex = ? 
            ORDER BY id DESC LIMIT 1
          `;
          const actualRowId = await new Promise((res, rej) => {
            connection.query(resolveRowSql, [rowId, rowId], (err, results) => {
              if (err) return rej(err);
              res(results.length > 0 ? results[0].id : rowId);
            });
          });

          // Normalize timeSlot ENUM
          let slotEnum = timeSlotCode;
          if (timeSlotCode && (timeSlotCode.includes("08:00") || timeSlotCode.includes("8"))) slotEnum = "8-12";
          else if (timeSlotCode && (timeSlotCode.includes("12:00") || timeSlotCode.includes("12"))) slotEnum = "12-4";
          else if (timeSlotCode && (timeSlotCode.includes("04:00") || timeSlotCode.includes("4"))) slotEnum = "4-9";

          // 1. Get or create distributedtarget record
          const checkTargetSql = `
            SELECT id FROM distributedtarget 
            WHERE rowId = ? AND timeSlot = ? AND DATE(createdAt) = CURDATE()
            LIMIT 1
          `;
          let targetId = await new Promise((res, rej) => {
            connection.query(checkTargetSql, [actualRowId, slotEnum], (err, results) => {
              if (err) return rej(err);
              res(results.length > 0 ? results[0].id : null);
            });
          });

          if (!targetId) {
            const insertTargetSql = `
              INSERT INTO distributedtarget (rowId, timeSlot, createdAt) 
              VALUES (?, ?, NOW())
            `;
            const insertRes = await new Promise((res, rej) => {
              connection.query(insertTargetSql, [actualRowId, slotEnum], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });
            targetId = insertRes.insertId;
          }

          // Sync targetposition.targetId for any officer assigned to this row today
          const updateOfficerTargetSql = `
            UPDATE targetposition tp
            JOIN packingpositions pp ON tp.positionId = pp.id
            SET tp.targetId = ?
            WHERE pp.rowId = ? AND DATE(tp.createdAt) = CURDATE()
          `;
          await new Promise((res, rej) => {
            connection.query(updateOfficerTargetSql, [targetId, actualRowId], (err, result) => {
              if (err) return rej(err);
              res(result);
            });
          });

          // 2. Insert target items and update processorders status
          const insertItemSql = `
            INSERT INTO distributedtargetitems (targetId, orderId, orderStatus, createdAt) 
            VALUES (?, ?, 'Pending', NOW())
          `;
          const updateProcessOrderSql = `
            UPDATE market_place.processorders 
            SET isTargetAssigned = 1 
            WHERE id = ?
          `;

          for (const orderId of orderIds) {
            await new Promise((res, rej) => {
              connection.query(updateProcessOrderSql, [orderId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });

            // Query master order ID
            const getMasterOrderSql = `
              SELECT orderId FROM market_place.processorders 
              WHERE id = ? LIMIT 1
            `;
            const masterOrderId = await new Promise((res, rej) => {
              connection.query(getMasterOrderSql, [orderId], (err, results) => {
                if (err) return rej(err);
                res(results.length > 0 ? results[0].orderId : null);
              });
            });

            let orderPackages = [];
            let additionalItems = [];

            // Query packages linked to processorders.id OR master orders.id
            const getPackagesSql = `
              SELECT id FROM market_place.orderpackage 
              WHERE orderId = ? OR orderId = ?
            `;
            orderPackages = await new Promise((res, rej) => {
              connection.query(getPackagesSql, [orderId, masterOrderId], (err, results) => {
                if (err) return rej(err);
                res(results);
              });
            });

            // Query additional items linked only to master orders.id (processOrderId collisions avoided)
            const getAdditionalSql = `
              SELECT id FROM market_place.orderadditionalitems 
              WHERE orderId = ?
            `;
            additionalItems = await new Promise((res, rej) => {
              connection.query(getAdditionalSql, [masterOrderId], (err, results) => {
                if (err) return rej(err);
                res(results);
              });
            });

            // Calculate number of distributedtargetitems rows to insert (1 per package + 1 for alacarte)
            let totalItemRows = 1;
            if (orderPackages && orderPackages.length > 0) {
              totalItemRows = orderPackages.length + (additionalItems && additionalItems.length > 0 ? 1 : 0);
            }

            for (let i = 0; i < totalItemRows; i++) {
              await new Promise((res, rej) => {
                connection.query(insertItemSql, [targetId, orderId], (err, result) => {
                  if (err) return rej(err);
                  res(result);
                });
              });
            }

            const insertPosTrackingSql = `
              INSERT INTO positiontracking (orderId, orderpackageId, pIndex, createdAt) 
              VALUES (?, ?, 0, NOW())
            `;

            if (orderPackages && orderPackages.length > 0) {
              // 1. Insert row for each package (orderpackageId filled)
              for (const pkg of orderPackages) {
                await new Promise((res, rej) => {
                  connection.query(insertPosTrackingSql, [orderId, pkg.id], (err, result) => {
                    if (err) return rej(err);
                    res(result);
                  });
                });
              }
              // 2. Insert row for à la carte items if order has additional items (orderpackageId = NULL)
              if (additionalItems && additionalItems.length > 0) {
                await new Promise((res, rej) => {
                  connection.query(insertPosTrackingSql, [orderId, null], (err, result) => {
                    if (err) return rej(err);
                    res(result);
                  });
                });
              }
            } else {
              // No packages: insert 1 row for order (à la carte)
              await new Promise((res, rej) => {
                connection.query(insertPosTrackingSql, [orderId, null], (err, result) => {
                  if (err) return rej(err);
                  res(result);
                });
              });
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
            resolve({ success: true, count: orderIds.length });
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
