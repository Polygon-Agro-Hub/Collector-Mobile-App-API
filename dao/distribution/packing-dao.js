const db = require("../../startup/database");

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
        CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END AS type,
        dt.timeSlot,
        CASE 
          WHEN LOWER(COALESCE(o.delivaryMethod, '')) = 'pickup' THEN 'Pickup Order' 
          ELSE COALESCE(NULLIF(TRIM(oh.city), ''), NULLIF(TRIM(o.delivaryMethod), ''), 'Bambalapitiya') 
        END AS category,
        dti.orderStatus,
        COALESCE(
          (SELECT MIN(pt_qr.pIndex) FROM positiontracking pt_qr WHERE pt_qr.orderId = po.id), 
          0
        ) AS minPIndex,
        (SELECT COUNT(*) FROM market_place.orderpackage op WHERE op.orderId = po.orderId OR op.orderId = po.id) AS packagesCount,
        (SELECT COUNT(DISTINCT oai.productId) FROM market_place.orderadditionalitems oai WHERE oai.orderId = po.orderId) AS alacarteCount
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
      LEFT JOIN market_place.orderhouse oh ON (oh.orderId = o.id OR oh.orderId = po.orderId)
      WHERE tp.officerId = ? AND DATE(tp.createdAt) = CURDATE()
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
        CASE 
          WHEN LOWER(COALESCE(o.delivaryMethod, '')) = 'pickup' THEN 'Pickup Order' 
          ELSE COALESCE(NULLIF(TRIM(oh.city), ''), NULLIF(TRIM(o.delivaryMethod), ''), 'Bambalapitiya') 
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
      LEFT JOIN market_place.orderhouse oh ON (oh.orderId = o.id OR oh.orderId = po.orderId)
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
                code: "NO_OFFICER_ASSIGNED",
                message: "No packing position user assigned for Packing Position 1. Please assign an officer to this position first."
              });
            });
            return;
          }

          // 2c. Main Container Priority Check
          if (!isMainContainer) {
            // Query total packages and alacarte items to check if Main Container is required
            const getCountsSql = `
              SELECT 
                (SELECT COUNT(*) FROM market_place.orderpackage WHERE orderId = po.id OR orderId = po.orderId) AS packagesCount,
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

            const pCount = countsRes.length > 0 ? countsRes[0].packagesCount : 0;
            const aCount = countsRes.length > 0 ? countsRes[0].alacarteCount : 0;
            const totalPhysicalBoxes = pCount + (aCount > 0 ? 1 : 0);

            if (totalPhysicalBoxes > 1) {
              const checkMainSql = `
                SELECT pIndex FROM positiontracking 
                WHERE orderId = ? AND isMainContainer = 1 
                LIMIT 1
              `;
              const mainRows = await new Promise((res) => {
                connection.query(checkMainSql, [orderId], (err, results) => {
                  res(results || []);
                });
              });

              // If the Main Container is not printed yet (mainRows empty) OR is still at P1 (mainPIndex <= 1)
              const mainPIndex = mainRows.length > 0 ? mainRows[0].pIndex : 0;
              if (mainPIndex <= 1) {
                connection.rollback(() => {
                  connection.release();
                  resolve({
                    success: false,
                    code: "MAIN_CONTAINER_PENDING",
                    message: "The Main Container for this order must be printed and passed to Packer 1 first."
                  });
                });
                return;
              }
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
            AND DATE(dt.createdAt) = (
              SELECT DATE(dt3.createdAt)
              FROM distributedtargetitems dti3
              JOIN distributedtarget dt3 ON dti3.targetId = dt3.id
              WHERE dti3.orderId = ? LIMIT 1
            )
            AND pt.pIndex = 1 
            AND dti.orderStatus = 'Opened'
            AND NOT (pt.orderId = ? AND (${
              isMainContainer 
                ? 'pt.isMainContainer = 1' 
                : validPackageId 
                  ? 'COALESCE(pt.orderpackageId, 0) = ?' 
                  : 'pt.orderpackageId IS NULL AND pt.isMainContainer = 0'
            }))
            LIMIT 1
          `;

          const occupiedParams = (validPackageId && !isMainContainer)
            ? [orderId, orderId, orderId, validPackageId]
            : [orderId, orderId, orderId];
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

          // If Main Container, set orderStatus = Opened, insert tracking row with isMainContainer = 1, and commit
          if (isMainContainer) {
            const updateTrackingSql = `
              UPDATE positiontracking 
              SET pIndex = CASE WHEN pIndex = 0 THEN 1 ELSE pIndex END 
              WHERE orderId = ? AND isMainContainer = 1
            `;
            const updateRes = await new Promise((res, rej) => {
              connection.query(updateTrackingSql, [orderId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });

            if (updateRes.affectedRows === 0) {
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

          if (validPackageId) {
            const updateTrackingSql = `
              UPDATE positiontracking 
              SET pIndex = CASE WHEN pIndex = 0 THEN 1 ELSE pIndex END 
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
              SET pIndex = CASE WHEN pIndex = 0 THEN 1 ELSE pIndex END 
              WHERE orderId = ? AND (orderpackageId IS NULL OR orderpackageId = 0) AND isMainContainer = 0
            `;
            const updateRes = await new Promise((res, rej) => {
              connection.query(updateTrackingSql, [orderId], (err, result) => {
                if (err) return rej(err);
                res(result);
              });
            });

            if (updateRes.affectedRows === 0) {
              await new Promise((res) => {
                connection.query(
                  `DELETE FROM positiontracking WHERE orderId = ? AND (orderpackageId IS NULL OR orderpackageId = 0) AND isMainContainer = 0`,
                  [orderId],
                  () => res(true)
                );
              });
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
exports.advancePositionIndex = (orderId, orderpackageId = null, currentPIndex = null, officerId = null) => {
  return new Promise((resolve, reject) => {
    const nextStep = currentPIndex ? Number(currentPIndex) + 1 : null;
    const isMainContainer = (orderpackageId === -1 || orderpackageId === "-1");
    const isPackageIdValid =
      orderpackageId !== null &&
      orderpackageId !== undefined &&
      orderpackageId !== "alacarte" &&
      !isMainContainer &&
      !isNaN(Number(orderpackageId));

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

      // Main Container Priority Check: A package/alacarte cannot advance to nextStep unless the Main Container is ahead of nextStep
      if (!isMainContainer && nextStep) {
        try {
          // Query total packages and alacarte items to check if Main Container is required
          const getCountsSql = `
            SELECT 
              (SELECT COUNT(*) FROM market_place.orderpackage WHERE orderId = po.id OR orderId = po.orderId) AS packagesCount,
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

          const pCount = countsRes.length > 0 ? countsRes[0].packagesCount : 0;
          const aCount = countsRes.length > 0 ? countsRes[0].alacarteCount : 0;
          const totalPhysicalBoxes = pCount + (aCount > 0 ? 1 : 0);

          if (totalPhysicalBoxes > 1) {
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

            const mainPIndex = mainRows.length > 0 ? mainRows[0].pIndex : 0;
            if (mainPIndex < maxPIndex && mainPIndex <= nextStep) {
              return resolve({
                success: false,
                message: "This box cannot advance because the Main Container for this order is not yet ahead of it."
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

        db.collectionofficer.query(checkOfficerNextSql, [orderId], (offErr, offRows) => {
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

          // If the next station is QC, skip occupancy checks (multiple boxes can reside at QC simultaneously)
          console.log("=== QC STATION SKIP OCCUPANCY CHECK ===", { nextStep, qcPIndex, isQC: nextStep === qcPIndex });
          if (nextStep === qcPIndex) {
            console.log("=== BYPASSING OCCUPANCY CHECK FOR QC ===");
            return executeUpdate(qcPIndex, maxPIndex);
          }

          const checkOccupiedSql = `
            SELECT pt.id, pt.orderpackageId, pt.orderId, pt.pIndex
            FROM positiontracking pt
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
            AND NOT (pt.orderId = ? AND (${
              isMainContainer 
                ? 'pt.isMainContainer = 1' 
                : isPackageIdValid 
                  ? 'COALESCE(pt.orderpackageId, 0) = ?' 
                  : '(pt.orderpackageId IS NULL OR pt.orderpackageId = 0) AND pt.isMainContainer = 0'
            }))
            LIMIT 1
          `;

          const checkParams = isPackageIdValid
            ? [orderId, orderId, nextStep, orderId, Number(orderpackageId)]
            : [orderId, orderId, nextStep, orderId];

          db.collectionofficer.query(checkOccupiedSql, checkParams, (checkErr, checkRows) => {
            if (checkErr) {
              console.error("Error checking next station occupancy:", checkErr);
            }

            console.log("=== OCCUPATION CHECK ROWS ===", checkRows);

            if (checkRows && checkRows.length > 0) {
              return resolve({
                success: false,
                isOccupied: true,
                message: `The ${targetStationName} is currently busy with another package box. Please wait until they clear their current box.`
              });
            }

            executeUpdate(qcPIndex, maxPIndex);
          });
        });
      } else {
        console.log("=== ADVANCING PAST QC ===", { nextStep, qcPIndex });
        // nextStep > qcPIndex → advancing past QC (completing QC) — no busy check needed
        executeUpdate(qcPIndex, maxPIndex);
      }
    });

    function executeUpdate(qcPIndex, maxPIndex) {
      let sql = `
        UPDATE positiontracking 
        SET pIndex = LEAST(pIndex + 1, ?) 
        WHERE orderId = ? AND pIndex > 0
      `;
      const params = [maxPIndex, orderId];

      if (isMainContainer) {
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

      console.log("=== DAO EXECUTE UPDATE SQL ===", sql, params);

      db.collectionofficer.query(sql, params, async (err, result) => {
        if (err) {
          console.error("Error in advancePositionIndex:", err);
          return reject(err);
        }
        console.log("=== DAO EXECUTE UPDATE RESULT ===", result);

        if (!result || result.affectedRows === 0) {
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
            LIMIT 1
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
          // Look up the targetposition.id for the officer at currentPIndex for this order's row today
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
            LIMIT 1
          `;
          const tpRows = await new Promise((res) => {
            db.collectionofficer.query(tpSql, [orderId, Number(currentPIndex)], (e, r) => res(r || []));
          });
          if (tpRows && tpRows.length > 0) {
            targetPositionId = tpRows[0].targetPositionId;
          }
        }

        if (!targetPositionId) return;

        if (orderpackageId !== null && orderpackageId !== undefined) {
          // Package items
          await new Promise((res) => {
            db.collectionofficer.query(
              `UPDATE market_place.orderpackageitems 
               SET packId = ?, packingTime = NOW(), isPacked = 1 
               WHERE orderPackageId = ? AND (packId IS NULL OR packId = 0)`,
              [targetPositionId, orderpackageId],
              (e, r) => res(r)
            );
          });
        } else {
          // Alacarte items (orderadditionalitems linked via orders.id through processorders)
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
        CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END AS orderType,
        CONCAT(po.invNo, ' (', CASE WHEN o.orderApp = 'Marketplace' THEN 'R' ELSE 'W' END, ')') AS formattedOrderNumber,
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
            ) LIMIT 1),
          (SELECT MIN(pt_sub2.pIndex) FROM positiontracking pt_sub2 WHERE pt_sub2.orderId = po.id AND pt_sub2.pIndex > 0),
          (SELECT MAX(pt_sub3.pIndex) FROM positiontracking pt_sub3 WHERE pt_sub3.orderId = po.id),
          0
        ) AS pIndex,
        (SELECT pt_sub4.orderpackageId FROM positiontracking pt_sub4 WHERE pt_sub4.orderId = po.id
          AND pt_sub4.pIndex = COALESCE(
            pp.pIndex,
            (SELECT MAX(pp2.pIndex) + 1 FROM packingpositions pp2 WHERE pp2.rowId = pp.rowId AND pp2.pType = 'NOR'),
            3
          ) AND pt_sub4.isMainContainer = 0 LIMIT 1) AS activeOrderPackageId,
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
      WHERE tp.officerId = ? AND DATE(tp.createdAt) = CURDATE()
        AND dti.orderStatus = 'Opened'
      ORDER BY 
        CASE WHEN EXISTS(SELECT 1 FROM positiontracking pt_ex WHERE pt_ex.orderId = po.id
          AND pt_ex.pIndex = COALESCE(
            pp.pIndex,
            (SELECT MAX(pp2.pIndex) + 1 FROM packingpositions pp2 WHERE pp2.rowId = pp.rowId AND pp2.pType = 'NOR'),
            3
          )) THEN 0 ELSE 1 END,
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
          SELECT op.id, COALESCE(mp.displayName, 'Package') AS name
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

        activeOrder.packagesList = packagesList;
        activeOrder.alacarteCount = alacarteCount;
      } catch (stepErr) {
        console.error("Error fetching steps info:", stepErr);
        activeOrder.packagesList = [];
        activeOrder.alacarteCount = 0;
      }

      try {
        let itemsSql = "";
        let queryParams = [];

        if (activeOrder.isMainContainerActive) {
          // Main Container is active! We bridge it as -1 to the client and return 0 items.
          activeOrder.activeOrderPackageId = -1;
          itemsSql = `SELECT 1 LIMIT 0`;
          queryParams = [];
        } else if (activeOrder.activeOrderPackageId) {
          // A specific package box is currently at this packer station!
          itemsSql = `
            SELECT 
              opi.id AS id,
              mi.displayName AS name,
              CONCAT(ROUND(COALESCE(opi.qty, 1), 1), ' ', COALESCE(NULLIF(TRIM(mi.unitType), ''), 'kg')) AS weight,
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
              CONCAT(ROUND(SUM(COALESCE(oai.qty, 1)), 1), ' ', COALESCE(NULLIF(TRIM(MAX(oai.unit)), ''), 'kg')) AS weight,
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
              CONCAT(ROUND(SUM(COALESCE(opi.qty, 1)), 1), ' ', COALESCE(NULLIF(TRIM(mi.unitType), ''), 'kg')) AS weight,
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
              CONCAT(ROUND(SUM(COALESCE(oai.qty, 1)), 1), ' ', COALESCE(NULLIF(TRIM(MAX(oai.unit)), ''), 'kg')) AS weight,
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

