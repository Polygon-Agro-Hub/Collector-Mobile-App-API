const db = require("../startup/database");

/**
 * Get timeslot group counts for today
 * @returns {Promise<Array>}
 */
exports.getGroupTimeslotCounts = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        o.sheduleTime,
        o.orderApp,
        COUNT(po.id) AS totalCount,
        SUM(CASE WHEN dti.id IS NULL AND (po.isTargetAssigned IS NULL OR po.isTargetAssigned = 0) THEN 1 ELSE 0 END) AS leftCount
      FROM market_place.processorders po
      JOIN market_place.orders o ON po.orderId = o.id
      LEFT JOIN distributedtargetitems dti ON po.id = dti.orderId
      WHERE DATE(po.createdAt) = CURDATE()
      GROUP BY o.sheduleTime, o.orderApp
    `;
    db.collectionofficer.query(sql, [], (err, results) => {
      if (err) {
        console.error("Error in getGroupTimeslotCounts:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

/**
 * Get unassigned process orders for a specific slot and orderApp today
 * @param {string} sheduleTime 
 * @param {string} orderApp 
 * @returns {Promise<Array>}
 */
exports.getUnassignedOrdersForGroup = (sheduleTime, orderApp) => {
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
      LEFT JOIN market_place.orderhouse oh ON o.id = oh.orderId
      LEFT JOIN market_place.orderapartment oa ON o.id = oa.orderId
      LEFT JOIN distributedtargetitems dti ON po.id = dti.orderId
      WHERE DATE(po.createdAt) = CURDATE()
        AND dti.id IS NULL
        AND (po.isTargetAssigned IS NULL OR po.isTargetAssigned = 0)
        AND o.orderApp = ?
        AND o.sheduleTime = ?
    `;
    db.collectionofficer.query(sql, [orderApp, sheduleTime], (err, results) => {
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
          // 1. Get or create distributedtarget record
          const checkTargetSql = `
            SELECT id FROM distributedtarget 
            WHERE rowId = ? AND timeSlot = ? AND DATE(createdAt) = CURDATE()
            LIMIT 1
          `;
          let targetId = await new Promise((res, rej) => {
            connection.query(checkTargetSql, [rowId, timeSlotCode], (err, results) => {
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
              connection.query(insertTargetSql, [rowId, timeSlotCode], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });
            targetId = insertRes.insertId;
          }

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
              connection.query(insertItemSql, [targetId, orderId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });

            await new Promise((res, rej) => {
              connection.query(updateProcessOrderSql, [orderId], (err, result) => {
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
