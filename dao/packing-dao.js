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
        (SELECT COUNT(*) FROM market_place.orderpackage op WHERE op.orderId = po.id OR op.orderId = po.orderId) AS packagesCount,
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
              JOIN market_place.orderpackage op ON (po.orderId = op.orderId OR po.id = op.orderId)
              JOIN market_place.marketplacepackages mp ON op.packageId = mp.id
              WHERE po.id = ?
            `;
            const pkgs = await new Promise((res, rej) => {
              db.collectionofficer.query(pkgSql, [item.id], (e, r) => e ? rej(e) : res(r));
            });
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
              JOIN market_place.orderpackage op ON (po.orderId = op.orderId OR po.id = op.orderId)
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
    let sql = `
      UPDATE positiontracking 
      SET pIndex = pIndex + 1 
      WHERE orderId = ?
    `;
    const params = [orderId];

    if (orderpackageId) {
      sql += ` AND orderpackageId = ?`;
      params.push(orderpackageId);
    } else if (currentPIndex !== null) {
      sql += ` AND pIndex = ? LIMIT 1`;
      params.push(currentPIndex);
    } else {
      sql += ` AND orderpackageId IS NULL LIMIT 1`;
    }

    db.collectionofficer.query(sql, params, (err, result) => {
      if (err) {
        console.error("Error in advancePositionIndex:", err);
        return reject(err);
      }
      resolve({ success: true, affectedRows: result.affectedRows });
    });
  });
};

/**
 * Mark orderStatus = 'Completed' when QC completes inspection
 * @param {number} orderId 
 * @returns {Promise<Object>}
 */
exports.markOrderAsCompleted = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE distributedtargetitems 
      SET orderStatus = 'Completed' 
      WHERE orderId = ?
    `;
    db.collectionofficer.query(sql, [orderId], (err, result) => {
      if (err) {
        console.error("Error in markOrderAsCompleted:", err);
        return reject(err);
      }
      resolve({ success: true, orderStatus: "Completed" });
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
        COALESCE(pt.pIndex, 0) AS pIndex,
        pp.pIndex AS officerPosIndex
      FROM targetposition tp
      JOIN packingpositions pp ON tp.positionId = pp.id
      JOIN distributedtarget dt ON (tp.targetId = dt.id OR pp.rowId = dt.rowId)
      JOIN distributedtargetitems dti ON dt.id = dti.targetId
      JOIN market_place.processorders po ON dti.orderId = po.id
      JOIN market_place.orders o ON po.orderId = o.id
      LEFT JOIN positiontracking pt ON po.id = pt.orderId
      WHERE tp.officerId = ? AND DATE(tp.createdAt) = CURDATE() AND DATE(dt.createdAt) = CURDATE()
      ORDER BY dti.orderStatus = 'Opened' DESC, po.id ASC
      LIMIT 1
    `;
    db.collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Error in getOfficerActiveOrder:", err);
        return resolve(null);
      }
      resolve(results.length > 0 ? results[0] : null);
    });
  });
};

