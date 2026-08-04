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
      WHERE tp.officerId = ? AND DATE(tp.createdAt) = CURDATE()
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
          COUNT(pp.id) - COUNT(DISTINCT CASE WHEN tp.id IS NOT NULL THEN pp.id END),
          0
        ) AS UNSIGNED) AS positionsCount
      FROM packingrows pr
      LEFT JOIN packingpositions pp ON pr.id = pp.rowId
      LEFT JOIN targetposition tp ON pp.id = tp.positionId AND DATE(tp.createdAt) = CURDATE()
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
      LEFT JOIN targetposition tp ON pp.id = tp.positionId AND DATE(tp.createdAt) = CURDATE()
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
            WHERE positionId = ? AND DATE(createdAt) = CURDATE()
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
            const updateSql = `
              UPDATE targetposition 
              SET positionId = ?, targetId = ?, createdAt = NOW() 
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
              INSERT INTO targetposition (officerId, positionId, targetId, createdAt) 
              VALUES (?, ?, ?, NOW())
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
        CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END AS type,
        dt.timeSlot,
        CASE WHEN o.delivaryMethod = 'Pickup' THEN 'Pickup Order' ELSE 'Delivery' END AS category,
        dti.orderStatus,
        COALESCE(
          (SELECT MIN(pt_qr.pIndex) FROM positiontracking pt_qr WHERE pt_qr.orderId = po.id), 
          0
        ) AS minPIndex,
        (SELECT COUNT(*) FROM market_place.orderpackage op WHERE op.orderId = po.orderId) AS packagesCount,
        (SELECT COUNT(*) FROM market_place.orderadditionalitems oai WHERE oai.orderId = po.orderId) AS alacarteCount
      FROM targetposition tp
      JOIN packingpositions pp ON tp.positionId = pp.id
      JOIN distributedtarget dt ON (tp.targetId = dt.id OR pp.rowId = dt.rowId)
      JOIN distributedtargetitems dti ON dt.id = dti.targetId
      JOIN market_place.processorders po ON dti.orderId = po.id
      JOIN market_place.orders o ON po.orderId = o.id
      WHERE tp.officerId = ? AND DATE(tp.createdAt) = CURDATE() AND DATE(dt.createdAt) = CURDATE()
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
                GREATEST(
                  COALESCE((SELECT COUNT(*) FROM market_place.orderpackageitems opi WHERE opi.orderPackageId = op.id), 0),
                  COALESCE((SELECT COUNT(*) FROM market_place.packagedetails pd WHERE pd.packageId = op.packageId), 0)
                ) AS count
              FROM market_place.processorders po
              JOIN market_place.orderpackage op ON po.orderId = op.orderId
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
                  ROUND(COALESCE(opi.qty, 1), 1) AS qty
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
      }

      resolve(results);
    });
  });
};

/**
 * Get distribution center targets grouped/listed for Center Target Screen
 * @returns {Promise<Array>}
 */
exports.getCenterTargetOrders = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT DISTINCT
        po.id AS id,
        po.invNo AS orderNumber,
        CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END AS type,
        CONCAT(po.invNo, ' (', CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END, ')') AS formattedOrderNumber,
        dt.timeSlot,
        CASE WHEN o.delivaryMethod = 'Pickup' THEN 'Pickup Order' ELSE COALESCE(o.delivaryMethod, 'Bambalapitiya') END AS category,
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
      WHERE DATE(dt.createdAt) = CURDATE()
      ORDER BY dt.timeSlot ASC, po.id ASC
    `;
    db.collectionofficer.query(sql, [], (err, results) => {
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
        CASE WHEN o.delivaryMethod = 'Pickup' THEN 'Pickup Order' ELSE COALESCE(o.delivaryMethod, 'Bambalapitiya') END AS category,
        CONCAT('Row ', COALESCE(pr.rowIndex, 1)) AS rowName,
        dti.orderStatus,
        DATE_FORMAT(COALESCE(dt.createdAt, po.createdAt), '%h:%i %p') AS qrPrintedTime,
        DATE_FORMAT(COALESCE(dti.updatedAt, po.createdAt), '%h:%i %p') AS qcDoneTime
      FROM market_place.processorders po
      JOIN market_place.orders o ON po.orderId = o.id
      LEFT JOIN distributedtargetitems dti ON dti.orderId = po.id
      LEFT JOIN distributedtarget dt ON dti.targetId = dt.id
      LEFT JOIN packingrows pr ON dt.rowId = pr.id
      WHERE po.id = ? OR po.invNo = ?
      LIMIT 1
    `;

    db.collectionofficer.query(sqlOrder, [orderId, orderId], async (err, orderResults) => {
      if (err || !orderResults || orderResults.length === 0) {
        return resolve(null);
      }

      const orderInfo = orderResults[0];
      const timeSlotMap = {
        "8-12": "08:00 AM - 12:00 PM",
        "12-16": "12:00 PM - 04:00 PM",
        "16-20": "04:00 PM - 08:00 PM",
        "4-9": "04:00 PM - 09:00 PM",
        "8-4": "08:00 AM - 04:00 PM",
        "12-4": "12:00 PM - 04:00 PM",
        "4-8": "04:00 PM - 08:00 PM",
      };

      const statusLabel = `(${orderInfo.rowName}) Out`;
      const timeSlotLabel = timeSlotMap[orderInfo.timeSlot] || orderInfo.timeSlot;

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

        // Query QR Printed Officer for target slot
        const qrOfficerSql = `
          SELECT COALESCE(co.empId, ce.empId) AS empId
          FROM targetposition tp
          JOIN packingpositions pp ON tp.positionId = pp.id AND pp.pType = 'QR'
          LEFT JOIN collectionofficer co ON tp.officerId = co.id
          LEFT JOIN companyemployee ce ON tp.officerId = ce.id
          WHERE tp.targetId = ? LIMIT 1
        `;
        const qrOfficerRes = await new Promise((res) => {
          db.collectionofficer.query(qrOfficerSql, [targetId], (e, r) => res(r || []));
        });
        const qrPrintedByEmpId = qrOfficerRes.length > 0 ? qrOfficerRes[0].empId : "DCM00043";

        // Query QC Done Officer for target slot
        const qcOfficerSql = `
          SELECT COALESCE(co.empId, ce.empId) AS empId
          FROM targetposition tp
          JOIN packingpositions pp ON tp.positionId = pp.id AND pp.pType = 'QC'
          LEFT JOIN collectionofficer co ON tp.officerId = co.id
          LEFT JOIN companyemployee ce ON tp.officerId = ce.id
          WHERE tp.targetId = ? LIMIT 1
        `;
        const qcOfficerRes = await new Promise((res) => {
          db.collectionofficer.query(qcOfficerSql, [targetId], (e, r) => res(r || []));
        });
        const qcDoneByEmpId = qcOfficerRes.length > 0 ? qcOfficerRes[0].empId : "DCM00025";

        // Query assigned packing officers for target slot
        const packingOfficersSql = `
          SELECT DISTINCT
            pp.pIndex,
            COALESCE(co.empId, ce.empId) AS empId
          FROM targetposition tp
          JOIN packingpositions pp ON tp.positionId = pp.id AND pp.pType = 'NOR'
          LEFT JOIN collectionofficer co ON tp.officerId = co.id
          LEFT JOIN companyemployee ce ON tp.officerId = ce.id
          WHERE tp.targetId = ?
          ORDER BY pp.pIndex ASC
        `;
        const assignedOfficers = await new Promise((res) => {
          db.collectionofficer.query(packingOfficersSql, [targetId], (e, r) => res(r || []));
        });

        const defaultPackingOfficers = assignedOfficers.length > 0
          ? assignedOfficers.map((a) => a.empId)
          : ["DCM00001", "DIO00001"];

        // Query packages for this order
        const pkgSql = `
          SELECT 
            op.id, 
            COALESCE(mp.displayName, op.packagename, 'Package') AS packageName,
            op.isAlacarte
          FROM market_place.processorders po
          JOIN market_place.orderpackage op ON po.orderId = op.orderId
          LEFT JOIN market_place.marketplacepackages mp ON op.packageId = mp.id
          WHERE po.id = ?
        `;
        const pkgs = await new Promise((res) => {
          db.collectionofficer.query(pkgSql, [orderInfo.orderId], (e, r) => res(r || []));
        });

        const packageGroups = [];

        for (const pkg of pkgs) {
          const itemsSql = `
            SELECT 
              pt.id,
              COALESCE(ci.cropName, mi.displayName, 'Item') AS name,
              CONCAT(COALESCE(pt.netWeight, 0.5), ' kg') AS weight,
              pt.pIndex,
              DATE_FORMAT(COALESCE(pt.createdAt, NOW()), '%h:%i %p') AS packedTime,
              COALESCE(ci.image, 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=200&auto=format&fit=crop&q=80') AS image
            FROM market_place.orderpackageitems opi
            LEFT JOIN market_place.marketplaceitems mi ON opi.productId = mi.id
            LEFT JOIN positiontracking pt ON pt.orderpackageId = opi.orderPackageId OR pt.orderId = ?
            LEFT JOIN cropinfo ci ON pt.cropId = ci.id
            WHERE opi.orderPackageId = ?
          `;
          const items = await new Promise((res) => {
            db.collectionofficer.query(itemsSql, [orderInfo.orderId, pkg.id], (e, r) => res(r || []));
          });

          const formattedItems = items.map((i, idx) => {
            let packedByEmpId = defaultPackingOfficers[idx % defaultPackingOfficers.length];
            if (i.pIndex && i.pIndex > 0) {
              const matched = assignedOfficers.find((a) => a.pIndex === i.pIndex);
              if (matched) packedByEmpId = matched.empId;
            }
            return {
              id: i.id || idx + 1,
              name: i.name,
              weight: i.weight,
              packedByEmpId: packedByEmpId,
              packedTime: i.packedTime,
              image: i.image,
            };
          });

          packageGroups.push({
            id: pkg.id,
            title: `${pkg.packageName} (${String(formattedItems.length).padStart(2, "0")})`,
            count: formattedItems.length,
            type: pkg.isAlacarte ? "alacarte" : "package",
            items: formattedItems,
          });
        }

        // If no packages found in DB, query positiontracking directly for tracked items
        if (packageGroups.length === 0) {
          const sqlItems = `
            SELECT 
              pt.id,
              COALESCE(ci.cropName, 'Item') AS name,
              CONCAT(COALESCE(pt.netWeight, 0.5), ' kg') AS weight,
              pt.pIndex,
              DATE_FORMAT(COALESCE(pt.createdAt, NOW()), '%h:%i %p') AS packedTime,
              COALESCE(ci.image, 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=200&auto=format&fit=crop&q=80') AS image
            FROM positiontracking pt
            LEFT JOIN cropinfo ci ON pt.cropId = ci.id
            WHERE pt.orderId = ?
          `;
          const itemResults = await new Promise((res) => {
            db.collectionofficer.query(sqlItems, [orderInfo.orderId], (e, r) => res(r || []));
          });

          const itemsList = itemResults.map((i, idx) => {
            let packedByEmpId = defaultPackingOfficers[idx % defaultPackingOfficers.length];
            if (i.pIndex && i.pIndex > 0) {
              const matched = assignedOfficers.find((a) => a.pIndex === i.pIndex);
              if (matched) packedByEmpId = matched.empId;
            }
            return {
              id: i.id || idx + 1,
              name: i.name || "Item",
              weight: i.weight || "0.5 kg",
              packedByEmpId: packedByEmpId,
              packedTime: i.packedTime || "08:00 AM",
              image: i.image,
            };
          });

          packageGroups.push({
            id: 1,
            title: `Order Items (${String(itemsList.length).padStart(2, "0")})`,
            count: itemsList.length,
            type: "package",
            items: itemsList,
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
          qrPrintedTime: orderInfo.qrPrintedTime,
          packageGroups: packageGroups,
          qcDoneByEmpId: qcDoneByEmpId,
          qcDoneTime: orderInfo.qcDoneTime,
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
exports.markOrderAsOpened = (orderId, orderpackageId = null, isPackage = null, packageIndex = 0, isMainContainer = false) => {
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
          const updateStatusSql = `
            UPDATE distributedtargetitems 
            SET orderStatus = 'Opened' 
            WHERE orderId = ?
          `;
          await new Promise((res, rej) => {
            connection.query(updateStatusSql, [orderId], (err, result) => {
              if (err) return rej(err);
              res(result);
            });
          });

          // If Main Container, set orderStatus = Opened and commit without altering pIndex
          if (isMainContainer) {
            connection.commit((commitErr) => {
              if (commitErr) {
                connection.rollback(() => {
                  connection.release();
                  reject(commitErr);
                });
                return;
              }
              connection.release();
              resolve({ success: true, orderStatus: "Opened", isMainContainer: true });
            });
            return;
          }

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
              JOIN market_place.orderpackage op ON po.orderId = op.orderId
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

          // 2b. Station Occupied Validation Check for Position 1 (pIndex = 1)
          const checkOccupiedSql = `
            SELECT pt.id, po.invNo
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
            AND pt.pIndex = 1 
            AND DATE(dt.createdAt) = CURDATE()
            AND NOT (pt.orderId = ? AND (${validPackageId ? 'pt.orderpackageId = ?' : 'pt.orderpackageId IS NULL'}))
            LIMIT 1
          `;

          const occupiedParams = validPackageId ? [orderId, orderId, validPackageId] : [orderId, orderId];
          const occupiedRes = await new Promise((res, rej) => {
            connection.query(checkOccupiedSql, occupiedParams, (err, results) => {
              if (err) return rej(err);
              res(results || []);
            });
          });

          if (occupiedRes && occupiedRes.length > 0) {
            const occupiedInv = occupiedRes[0].invNo;
            connection.rollback(() => {
              connection.release();
              resolve({
                success: false,
                code: "STATION_OCCUPIED",
                occupiedInvoice: occupiedInv,
                message: `Packing Position 1 is currently busy with Invoice ${occupiedInv}. Please wait until Position 1 completes its current box before generating the next QR code.`
              });
            });
            return;
          }

          // 3. Update or Insert positiontracking
          if (validPackageId) {
            const updateTrackingSql = `
              UPDATE positiontracking 
              SET pIndex = 1 
              WHERE orderId = ? AND orderpackageId = ?
            `;
            const updateRes = await new Promise((res, rej) => {
              connection.query(updateTrackingSql, [orderId, validPackageId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });

            if (updateRes.affectedRows === 0) {
              const insertTrackingSql = `
                INSERT INTO positiontracking (orderId, orderpackageId, pIndex, createdAt) 
                VALUES (?, ?, 1, NOW())
              `;
              await new Promise((res, rej) => {
                connection.query(insertTrackingSql, [orderId, validPackageId], (err, result) => {
                  if (err) return rej(err);
                  res(result);
                });
              });
            }
          } else {
            const updateTrackingSql = `
              UPDATE positiontracking 
              SET pIndex = 1 
              WHERE orderId = ? AND orderpackageId IS NULL
            `;
            const updateRes = await new Promise((res, rej) => {
              connection.query(updateTrackingSql, [orderId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });

            if (updateRes.affectedRows === 0) {
              const insertTrackingSql = `
                INSERT INTO positiontracking (orderId, orderpackageId, pIndex, createdAt) 
                VALUES (?, NULL, 1, NOW())
              `;
              await new Promise((res, rej) => {
                connection.query(insertTrackingSql, [orderId], (err, result) => {
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
            resolve({ success: true, orderStatus: "Opened", orderpackageId: validPackageId, pIndex: 1 });
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
exports.advancePositionIndex = (orderId, orderpackageId = null, currentPIndex = null) => {
  return new Promise((resolve, reject) => {
    const nextStep = currentPIndex ? Number(currentPIndex) + 1 : null;

    if (nextStep && nextStep <= 3) {
      const checkOccupiedSql = `
        SELECT pt.id, pt.orderpackageId, pt.orderId, pt.pIndex
        FROM positiontracking pt
        JOIN distributedtargetitems dti ON pt.orderId = dti.orderId
        JOIN distributedtarget dt ON dti.targetId = dt.id
        WHERE dt.rowId = (
          SELECT dt_sub.rowId 
          FROM positiontracking pt_sub
          JOIN distributedtargetitems dti_sub ON pt_sub.orderId = dti_sub.orderId
          JOIN distributedtarget dt_sub ON dti_sub.targetId = dt_sub.id
          WHERE pt_sub.orderId = ? LIMIT 1
        )
        AND dti.orderStatus = 'Opened'
        AND pt.pIndex = ?
        LIMIT 1
      `;

      db.collectionofficer.query(checkOccupiedSql, [orderId, nextStep], (checkErr, checkRows) => {
        if (checkErr) {
          console.error("Error checking next station occupancy:", checkErr);
        }

        if (checkRows && checkRows.length > 0) {
          const targetStationName = nextStep === 3 ? "QC Station" : `Packing Position ${nextStep}`;
          return resolve({
            success: false,
            isOccupied: true,
            message: `The ${targetStationName} is currently busy with another package box. Please wait until they clear their current box.`
          });
        }

        executeUpdate();
      });
    } else {
      executeUpdate();
    }

    function executeUpdate() {
      let sql = `
        UPDATE positiontracking 
        SET pIndex = LEAST(pIndex + 1, 4) 
        WHERE orderId = ? AND pIndex > 0
      `;
      const params = [orderId];

      const isPackageIdValid =
        orderpackageId !== null &&
        orderpackageId !== undefined &&
        orderpackageId !== "alacarte" &&
        !isNaN(Number(orderpackageId));

      if (isPackageIdValid) {
        sql += ` AND orderpackageId = ?`;
        params.push(Number(orderpackageId));
      } else {
        sql += ` AND orderpackageId IS NULL`;
      }

      if (currentPIndex !== null && currentPIndex > 0) {
        sql += ` AND pIndex = ?`;
        params.push(Number(currentPIndex));
      }

      sql += ` LIMIT 1`;

      console.log("=== DAO EXECUTE UPDATE SQL ===", sql, params);

      db.collectionofficer.query(sql, params, (err, result) => {
        if (err) {
          console.error("Error in advancePositionIndex:", err);
          return reject(err);
        }
        console.log("=== DAO EXECUTE UPDATE RESULT ===", result);

        if (!result || result.affectedRows === 0) {
          return resolve({
            success: false,
            affectedRows: 0,
            message: "The next station is currently busy or the package has already been cleared."
          });
        }
        resolve({ success: true, affectedRows: result.affectedRows });
      });
    }
  });
};

/**
 * Mark orderStatus = 'Completed' when QC completes inspection
 * @param {number} orderId 
 * @returns {Promise<Object>}
 */
exports.markOrderAsCompleted = (orderId) => {
  return new Promise((resolve, reject) => {
    const checkSql = `
      SELECT COUNT(*) AS totalBoxes,
             SUM(CASE WHEN pIndex >= 4 THEN 1 ELSE 0 END) AS completedBoxes
      FROM positiontracking
      WHERE orderId = ?
    `;

    db.collectionofficer.query(checkSql, [orderId], (err, rows) => {
      if (err) {
        console.error("Error checking box completion status:", err);
        return reject(err);
      }

      const total = rows[0]?.totalBoxes || 0;
      const completed = rows[0]?.completedBoxes || 0;

      if (total > 0 && completed >= total) {
        const updateSql = `
          UPDATE distributedtargetitems 
          SET orderStatus = 'Completed' 
          WHERE orderId = ?
        `;
        db.collectionofficer.query(updateSql, [orderId], (uErr) => {
          if (uErr) return reject(uErr);
          resolve({ success: true, isFullyCompleted: true, orderStatus: "Completed" });
        });
      } else {
        resolve({ success: true, isFullyCompleted: false, orderStatus: "Opened" });
      }
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
        po.invNo AS orderNumber,
        dt.timeSlot,
        CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END AS orderType,
        CONCAT(po.invNo, ' (', CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END, ')') AS formattedOrderNumber,
        dti.orderStatus,
        COALESCE(
          (SELECT pt_sub.pIndex FROM positiontracking pt_sub WHERE pt_sub.orderId = po.id AND pt_sub.pIndex = COALESCE(pp.pIndex, CASE WHEN pp.pType = 'QC' THEN 3 ELSE 1 END) LIMIT 1),
          (SELECT MIN(pt_sub2.pIndex) FROM positiontracking pt_sub2 WHERE pt_sub2.orderId = po.id AND pt_sub2.pIndex > 0),
          (SELECT MAX(pt_sub3.pIndex) FROM positiontracking pt_sub3 WHERE pt_sub3.orderId = po.id),
          0
        ) AS pIndex,
        COALESCE(pp.pIndex, CASE WHEN pp.pType = 'QC' THEN 3 ELSE 1 END) AS officerPosIndex,
        pp.id AS positionId,
        (SELECT pt_sub4.orderpackageId FROM positiontracking pt_sub4 WHERE pt_sub4.orderId = po.id AND pt_sub4.pIndex = COALESCE(pp.pIndex, CASE WHEN pp.pType = 'QC' THEN 3 ELSE 1 END) LIMIT 1) AS activeOrderPackageId,
        (SELECT EXISTS(SELECT 1 FROM positiontracking pt_sub5 WHERE pt_sub5.orderId = po.id AND pt_sub5.pIndex = COALESCE(pp.pIndex, CASE WHEN pp.pType = 'QC' THEN 3 ELSE 1 END) AND pt_sub5.orderpackageId IS NULL)) AS isAlacarteActive
      FROM targetposition tp
      JOIN packingpositions pp ON tp.positionId = pp.id
      JOIN distributedtarget dt ON (tp.targetId = dt.id OR pp.rowId = dt.rowId)
      JOIN distributedtargetitems dti ON dt.id = dti.targetId
      JOIN market_place.processorders po ON dti.orderId = po.id
      JOIN market_place.orders o ON po.orderId = o.id
      WHERE tp.officerId = ? AND DATE(tp.createdAt) = CURDATE() AND DATE(dt.createdAt) = CURDATE()
        AND dti.orderStatus = 'Opened'
      ORDER BY 
        CASE WHEN EXISTS(SELECT 1 FROM positiontracking pt_ex WHERE pt_ex.orderId = po.id AND pt_ex.pIndex = COALESCE(pp.pIndex, CASE WHEN pp.pType = 'QC' THEN 3 ELSE 1 END)) THEN 0 ELSE 1 END,
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

      try {
        let itemsSql = "";
        let queryParams = [];

        if (activeOrder.activeOrderPackageId) {
          // A specific package box is currently at this packer station!
          itemsSql = `
            SELECT 
              opi.id AS id,
              mi.displayName AS name,
              CONCAT(ROUND(COALESCE(opi.qty, 1), 1), ' kg') AS weight,
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
              CONCAT(ROUND(SUM(COALESCE(oai.qty, 1)), 1), ' kg') AS weight,
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
              CONCAT(ROUND(SUM(COALESCE(opi.qty, 1)), 1), ' kg') AS weight,
              cv.image AS image,
              mi.id AS mpiId,
              opi.productType AS productTypeId,
              mp.displayName AS packName,
              'package' AS categoryType
            FROM market_place.processorders po
            JOIN market_place.orderpackage op ON po.orderId = op.orderId
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
              CONCAT(ROUND(SUM(COALESCE(oai.qty, 1)), 1), ' kg') AS weight,
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

