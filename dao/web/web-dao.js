const db = require("../../startup/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/**
 * Authenticate DCM user
 */
exports.dcmLogin = (username, password) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        u.id, 
        u.empId, 
        CONCAT(COALESCE(u.firstNameEnglish, ''), ' ', COALESCE(u.lastNameEnglish, '')) AS name, 
        u.email, 
        u.password, 
        u.jobRole,
        u.distributedCenterId,
        u.centerId
      FROM collectionofficer u
      WHERE u.empId = ? OR u.email = ?
      LIMIT 1
    `;
    db.collectionofficer.query(sql, [username, username], async (err, results) => {
      if (err) {
        console.error("Error in dcmLogin:", err);
        return reject(err);
      }
      if (results.length === 0) {
        return resolve({ success: false, message: "User not found." });
      }

      const user = results[0];

      let validPassword = false;
      if (user.password && (user.password.startsWith("$2b$") || user.password.startsWith("$2a$"))) {
        validPassword = await bcrypt.compare(password, user.password);
      } else {
        validPassword = (password === user.password);
      }

      if (!validPassword) {
        return resolve({ success: false, message: "Invalid credentials." });
      }

      const companyCenterId = user.distributedCenterId || user.centerId || 66;

      const token = jwt.sign(
        { id: user.id, empId: user.empId, role: user.jobRole || "DCM", companyCenterId: companyCenterId },
        process.env.JWT_SECRET || "antigravity_secret_key",
        { expiresIn: "24h" }
      );

      resolve({
        success: true,
        token: token,
        user: {
          id: user.id,
          empId: user.empId,
          name: user.name.trim() || user.empId,
          role: user.jobRole || "Distribution Center Manager",
          companyCenterId: companyCenterId,
        },
      });
    });
  });
};

/**
 * Get all packing rows for ALL centers
 * @param {boolean} includeInactive - If true, includes disabled rows (isEnabled = 0)
 * @param {number|null} companyCenterId - Optional: filter by specific center
 */
exports.getAvailableRows = (companyCenterId = null, includeInactive = false) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        pr.id AS rowId,
        pr.companyCenterId,
        pr.rowIndex,
        CONCAT('Row ', COALESCE(pr.rowIndex, pr.id)) AS rowName,
        pr.isEnabled,
        (
          SELECT COUNT(DISTINCT tp.officerId) 
          FROM targetposition tp 
          JOIN packingpositions pp ON tp.positionId = pp.id 
          WHERE pp.rowId = pr.id AND DATE(tp.createdAt) = CURDATE() AND tp.isFinished = 1
        ) AS staffCount,
        (
          SELECT COUNT(DISTINCT dti.orderId) 
          FROM distributedtarget dt 
          JOIN distributedtargetitems dti ON dt.id = dti.targetId 
          WHERE dt.rowId = pr.id AND DATE(dt.createdAt) = CURDATE()
        ) AS totalOrders
      FROM packingrows pr
      WHERE 1=1
    `;
    const params = [];

    // Only filter by isEnabled if we don't want to include inactive rows
    if (!includeInactive) {
      sql += ` AND pr.isEnabled = 1`;
    }

    // If companyCenterId is provided, filter by it
    if (companyCenterId) {
      sql += ` AND pr.companyCenterId = ?`;
      params.push(companyCenterId);
    }

    // Order by company center first, then by row index
    sql += ` ORDER BY pr.companyCenterId ASC, pr.rowIndex ASC, pr.id ASC`;

    db.collectionofficer.query(sql, params, (err, results) => {
      if (err) {
        console.error("Error in getAvailableRows:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

/**
 * Get all centers with their row counts
 */
exports.getAllCentersWithRows = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        pr.companyCenterId,
        COUNT(*) AS totalRows,
        SUM(CASE WHEN pr.isEnabled = 1 THEN 1 ELSE 0 END) AS activeRows,
        SUM(CASE WHEN pr.isEnabled = 0 THEN 1 ELSE 0 END) AS inactiveRows
      FROM packingrows pr
      GROUP BY pr.companyCenterId
      ORDER BY pr.companyCenterId ASC
    `;
    
    db.collectionofficer.query(sql, (err, results) => {
      if (err) {
        console.error("Error fetching centers with rows:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

/**
 * Get Live Row Monitor Data (Assigned Officers by Role + Boxes with QR and pIndex status)
 * FIXED: Now properly handles rows by their actual ID
 */
exports.getRowLiveMonitor = (rowId) => {
  return new Promise((resolve, reject) => {
    // First, verify the row exists and get its details
    const rowCheckSql = `SELECT id, companyCenterId, isEnabled, rowIndex FROM packingrows WHERE id = ?`;
    db.collectionofficer.query(rowCheckSql, [rowId], async (err, rowResults) => {
      if (err) {
        console.error("Error checking row:", err);
        return reject(err);
      }
      if (rowResults.length === 0) {
        return resolve({
          rowId: Number(rowId),
          assignedStaff: [],
          stations: [],
          boxes: [],
          error: "Row not found"
        });
      }

      const rowData = rowResults[0];
      
      // 1. Fetch assigned staff for this row today
      const staffSql = `
        SELECT DISTINCT
          tp.officerId,
          tp.id AS targetPositionId,
          tp.isFinished,
          CONCAT(COALESCE(u.firstNameEnglish, ''), ' ', COALESCE(u.lastNameEnglish, '')) AS officerName,
          u.empId,
          u.image,
          pp.pType,
          pp.pIndex AS officerPosIndex
        FROM targetposition tp
        JOIN packingpositions pp ON tp.positionId = pp.id
        JOIN collectionofficer u ON tp.officerId = u.id
        WHERE pp.rowId = ? AND DATE(tp.createdAt) = CURDATE() AND tp.isFinished = 1
        ORDER BY pp.pIndex ASC
      `;

      db.collectionofficer.query(staffSql, [rowId], async (err, staffResults) => {
        if (err) {
          console.error("Error fetching staff for row live monitor:", err);
          return reject(err);
        }

        const staffList = staffResults.map((s) => {
          let role = "PACKER";
          let roleLabel = `Packing Position ${s.officerPosIndex}`;
          let color = "#2563EB";

          if (s.pType === "QR" || s.officerPosIndex === 0) {
            role = "QR_OFFICER";
            roleLabel = "QR Officer";
            color = "#980775";
          } else if (s.pType === "QC") {
            role = "QC_OFFICER";
            roleLabel = "QC Officer";
            color = "#059669";
          } else {
            role = "PACKER";
            roleLabel = `Packing Position ${s.officerPosIndex}`;
            color = "#2563EB";
          }

          return {
            officerId: s.officerId,
            targetPositionId: s.targetPositionId,
            isFinished: s.isFinished,
            name: s.officerName.trim() || s.empId,
            empId: s.empId,
            image: s.image,
            role: role,
            roleLabel: roleLabel,
            positionIndex: s.officerPosIndex,
            color: color,
          };
        });

        // 2. Fetch process orders assigned to THIS SPECIFIC ROW ID
        const ordersSql = `
          SELECT DISTINCT
            po.id AS processOrderId,
            po.orderId AS masterOrderId,
            po.invNo AS invoiceNumber,
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
            END, ')') AS formattedInvoice,
            dti.orderStatus,
            dt.timeSlot
          FROM distributedtarget dt
          JOIN distributedtargetitems dti ON dt.id = dti.targetId
          JOIN market_place.processorders po ON dti.orderId = po.id
          JOIN market_place.orders o ON po.orderId = o.id
          LEFT JOIN market_place.marketplaceusers u ON o.userId = u.id
          WHERE dt.rowId = ? AND DATE(dt.createdAt) = CURDATE()
          ORDER BY po.id ASC
        `;

        db.collectionofficer.query(ordersSql, [rowId], async (err, orderResults) => {
          if (err) {
            console.error("Error fetching orders for row live monitor:", err);
            return reject(err);
          }

          console.log(`📊 Row ${rowId} (Center ${rowData.companyCenterId}, Index ${rowData.rowIndex}) has ${orderResults.length} orders`);

          const rowConfigSql = `
            SELECT 
              MAX(CASE WHEN pp.pType = 'QC' THEN pp.pIndex ELSE NULL END) AS qcPIndex,
              MAX(CASE WHEN pp.pType = 'NOR' THEN pp.pIndex ELSE NULL END) AS maxPackerPIndex
            FROM packingpositions pp
            WHERE pp.rowId = ?
          `;
          const rowConfig = await new Promise((res) => {
            db.collectionofficer.query(rowConfigSql, [rowId], (e, r) => res(e || !r || !r[0] ? {} : r[0]));
          });
          const maxPackerPIndex = Number(rowConfig.maxPackerPIndex) || 1;
          const qcPIndex = rowConfig.qcPIndex != null ? Number(rowConfig.qcPIndex) : maxPackerPIndex + 1;

          const getBoxStatus = (pIdx, orderStatus) => {
            if (orderStatus === "Pending" || pIdx === 0) {
              return { status: "QR_PENDING", statusLabel: "QR Pending", statusColor: "#6B7280" };
            }
            if (pIdx === qcPIndex) {
              return { status: "AT_QC", statusLabel: "At QC", statusColor: "#059669" };
            }
            if (pIdx > qcPIndex) {
              return { status: "COMPLETED", statusLabel: "Completed", statusColor: "#10B981" };
            }
            return { status: `AT_PACKER_${pIdx}`, statusLabel: `At Packer ${pIdx}`, statusColor: pIdx === 1 ? "#2563EB" : "#8B5CF6" };
          };

          const boxes = [];

          for (const order of orderResults) {
            const pOrderId = order.processOrderId;
            const mOrderId = order.masterOrderId;

            const pkgSql = `
              SELECT op.id AS orderpackageId, GREATEST(COALESCE(op.qty, 1), 1) AS qty, mp.displayName AS packageName
              FROM market_place.orderpackage op
              JOIN market_place.marketplacepackages mp ON op.packageId = mp.id
              WHERE op.orderId = ? OR op.orderId = ?
            `;

            const packages = await new Promise((res) => {
              db.collectionofficer.query(pkgSql, [pOrderId, mOrderId], (e, r) => res(e ? [] : r));
            });

            const trackingSql = `
              SELECT id, orderpackageId, pIndex, isMainContainer 
              FROM positiontracking 
              WHERE orderId = ?
            `;
            const trackingRows = await new Promise((res) => {
              db.collectionofficer.query(trackingSql, [pOrderId], (e, r) => res(e ? [] : r));
            });

            const mainTrackingRows = trackingRows.filter((t) => t.isMainContainer === 1);
            const pkgTrackingMap = new Map();
            const alacarteTrackingRows = trackingRows.filter((t) => !t.isMainContainer && !t.orderpackageId);

            trackingRows.forEach((t) => {
              if (!t.isMainContainer && t.orderpackageId) {
                const key = String(t.orderpackageId);
                if (!pkgTrackingMap.has(key)) pkgTrackingMap.set(key, []);
                pkgTrackingMap.get(key).push(t.pIndex);
              }
            });

            const addSql = `
              SELECT COUNT(*) AS cnt FROM market_place.orderadditionalitems 
              WHERE orderId = ?
            `;
            const addRes = await new Promise((res) => {
              db.collectionofficer.query(addSql, [mOrderId], (e, r) => res(e ? [{ cnt: 0 }] : r));
            });
            const hasAlacarte = addRes.length > 0 && addRes[0].cnt > 0;

            const totalPhysicalPackages = packages.reduce((acc, p) => acc + Number(p.qty || 1), 0);
            const totalPhysicalBoxes = totalPhysicalPackages + (hasAlacarte ? 1 : 0);
            if (totalPhysicalBoxes > 1) {
              const mainPIdx = mainTrackingRows.length > 0 ? mainTrackingRows[0].pIndex : 0;
              const { status, statusLabel, statusColor } = getBoxStatus(mainPIdx, order.orderStatus);

              boxes.push({
                boxId: `main_${pOrderId}`,
                orderpackageId: -1,
                processOrderId: pOrderId,
                invoiceNumber: order.invoiceNumber,
                formattedInvoice: order.formattedInvoice,
                timeSlot: order.timeSlot,
                boxTitle: "Main Container",
                boxType: "Package",
                qrCode: order.invoiceNumber,
                pIndex: mainPIdx,
                status: status,
                statusLabel: statusLabel,
                statusColor: statusColor,
              });
            }

            for (const pkg of packages) {
              const key = String(pkg.orderpackageId);
              const pIndexList = pkgTrackingMap.get(key) || [];
              const qty = Number(pkg.qty) || 1;

              for (let i = 0; i < qty; i++) {
                const pIdx = pIndexList[i] !== undefined ? pIndexList[i] : 0;
                const { status, statusLabel, statusColor } = getBoxStatus(pIdx, order.orderStatus);
                const instanceLabel = qty > 1 ? ` (${i + 1}/${qty})` : "";

                boxes.push({
                  boxId: `pkg_${pkg.orderpackageId}_${i}`,
                  orderpackageId: pkg.orderpackageId,
                  processOrderId: pOrderId,
                  invoiceNumber: order.invoiceNumber,
                  formattedInvoice: order.formattedInvoice,
                  timeSlot: order.timeSlot,
                  boxTitle: `${pkg.packageName}${instanceLabel}`,
                  boxType: "Package",
                  qrCode: order.invoiceNumber,
                  pIndex: pIdx,
                  status: status,
                  statusLabel: statusLabel,
                  statusColor: statusColor,
                });
              }
            }

            if (hasAlacarte) {
              const pIdx = alacarteTrackingRows.length > 0 ? alacarteTrackingRows[0].pIndex : 0;
              const { status, statusLabel, statusColor } = getBoxStatus(pIdx, order.orderStatus);

              boxes.push({
                boxId: `alacarte_${pOrderId}`,
                orderpackageId: null,
                processOrderId: pOrderId,
                invoiceNumber: order.invoiceNumber,
                formattedInvoice: order.formattedInvoice,
                timeSlot: order.timeSlot,
                boxTitle: "À la carte Items",
                boxType: "Alacarte",
                qrCode: order.invoiceNumber,
                pIndex: pIdx,
                status: status,
                statusLabel: statusLabel,
                statusColor: statusColor,
              });
            }
          }

          const positionsSql = `
            SELECT 
              pp.id AS positionId,
              pp.pIndex,
              pp.pType,
              CASE 
                WHEN pp.pType = 'QR' THEN 'QR Officer Station'
                WHEN pp.pType = 'QC' THEN 'QC Officer Station'
                ELSE CONCAT('Packer ', pp.pIndex, ' (P', pp.pIndex, ')')
              END AS stationName
            FROM packingpositions pp
            WHERE pp.rowId = ?
            ORDER BY 
              CASE WHEN pp.pType = 'QR' THEN 0 WHEN pp.pType = 'NOR' THEN 1 ELSE 2 END,
              pp.pIndex ASC
          `;

          const positionRows = await new Promise((res) => {
            db.collectionofficer.query(positionsSql, [rowId], (e, r) => res(e ? [] : r));
          });

          const stations = positionRows.map((pos) => {
            const matchingStaff = staffList.find((s) => {
              if (s.isFinished !== 1) return false;
              if (pos.pType === "QR") return s.role === "QR_OFFICER";
              if (pos.pType === "QC") return s.role === "QC_OFFICER";
              return s.positionIndex === pos.pIndex;
            }) || null;

            let activeBox = null;
            if (pos.pType === "QR") {
              activeBox = boxes.find((b) => b.pIndex === 0) || null;
            } else if (pos.pType === "QC") {
              activeBox = boxes.find((b) => b.pIndex === qcPIndex) || null;
            } else {
              activeBox = boxes.find((b) => b.pIndex === pos.pIndex) || null;
            }

            return {
              positionId: pos.positionId,
              pIndex: pos.pIndex,
              pType: pos.pType,
              stationName: pos.stationName,
              assignedOfficer: matchingStaff,
              activeBox: activeBox,
              isOccupied: activeBox !== null,
              targetPositionId: matchingStaff ? matchingStaff.targetPositionId : null,
              isFinished: matchingStaff ? matchingStaff.isFinished : null,
            };
          });

          resolve({
            rowId: Number(rowId),
            companyCenterId: rowData.companyCenterId,
            rowIndex: rowData.rowIndex,
            isEnabled: rowData.isEnabled,
            assignedStaff: staffList,
            stations: stations,
            boxes: boxes,
          });
        });
      });
    });
  });
};

/**
 * Get full package and item details for a process order (Web view)
 */
exports.getWebOrderDetails = (processOrderId) => {
  return new Promise((resolve, reject) => {
    const orderSql = `
      SELECT 
        po.id AS processOrderId,
        po.orderId AS masterOrderId,
        po.invNo AS invoiceNumber,
        o.fullTotal,
        o.total
      FROM market_place.processorders po
      JOIN market_place.orders o ON po.orderId = o.id
      WHERE po.id = ?
    `;

    db.collectionofficer.query(orderSql, [processOrderId], async (err, orderResults) => {
      if (err) {
        console.error("Error fetching order details in web-dao:", err);
        return reject(err);
      }
      if (orderResults.length === 0) {
        return resolve(null);
      }

      const orderData = orderResults[0];

      try {
        const pkgSql = `
          SELECT 
            op.id AS orderPackageId,
            op.packageId,
            mp.displayName,
            mp.productPrice
          FROM market_place.orderpackage op
          JOIN market_place.marketplacepackages mp ON op.packageId = mp.id
          WHERE op.orderId = ? OR op.orderId = ?
        `;

        const packages = await new Promise((res) => {
          db.collectionofficer.query(pkgSql, [processOrderId, orderData.masterOrderId], (e, r) => res(e ? [] : r));
        });

        for (const pkg of packages) {
          const itemsSql = `
            SELECT 
              opi.id,
              opi.orderPackageId,
              opi.productType,
              opi.productId,
              opi.qty,
              opi.price,
              pt.typeName AS productTypeName,
              mi.displayName AS productDisplayName
            FROM market_place.orderpackageitems opi
            LEFT JOIN market_place.producttypes pt ON opi.productType = pt.id
            LEFT JOIN market_place.marketplaceitems mi ON opi.productId = mi.id
            WHERE opi.orderPackageId = ?
            ORDER BY pt.typeName ASC, opi.id ASC
          `;

          const items = await new Promise((res) => {
            db.collectionofficer.query(itemsSql, [pkg.orderPackageId], (e, r) => res(e ? [] : r));
          });

          pkg.packageItems = items.map((it) => {
            const specName = it.productDisplayName || "N/A";
            const catName = it.productTypeName || "General";
            return {
              id: it.id,
              orderPackageId: it.orderPackageId,
              productType: it.productType,
              productTypeName: catName,
              productId: it.productId,
              productDisplayName: specName,
              itemDescription: specName !== "N/A" ? `${specName} (${catName})` : catName,
              qty: parseFloat(it.qty) || 1,
              price: parseFloat(it.price) || 0,
            };
          });

          const itemsByCategory = {};
          pkg.packageItems.forEach((pi) => {
            const cat = pi.productTypeName || "General";
            if (!itemsByCategory[cat]) {
              itemsByCategory[cat] = [];
            }
            itemsByCategory[cat].push(pi);
          });
          pkg.itemsByCategory = itemsByCategory;
        }

        const addSql = `
          SELECT 
            oai.id,
            oai.productId,
            oai.qty,
            oai.price,
            mi.displayName
          FROM market_place.orderadditionalitems oai
          JOIN market_place.marketplaceitems mi ON oai.productId = mi.id
          WHERE oai.orderId = ?
        `;

        const additionalItems = await new Promise((res) => {
          db.collectionofficer.query(addSql, [orderData.masterOrderId], (e, r) => res(e ? [] : r));
        });

        resolve({
          processOrderId: Number(processOrderId),
          masterOrderId: orderData.masterOrderId,
          invoiceNumber: orderData.invoiceNumber,
          fullTotal: parseFloat(orderData.fullTotal || orderData.total) || 0,
          packages: packages,
          additionalItems: additionalItems.map((ai) => ({
            id: ai.id,
            productId: ai.productId,
            displayName: ai.displayName,
            qty: parseFloat(ai.qty) || 1,
            price: parseFloat(ai.price) || 0,
          })),
        });
      } catch (e) {
        console.error("Error in getWebOrderDetails:", e);
        reject(e);
      }
    });
  });
};

/**
 * Toggle or set isFinished status for a position today
 */
exports.togglePositionOccupancy = (positionId, isFinished = 0) => {
  return new Promise((resolve, reject) => {
    const findSql = `
      SELECT id, isFinished FROM targetposition 
      WHERE positionId = ? AND DATE(createdAt) = CURDATE()
      ORDER BY id DESC LIMIT 1
    `;
    db.collectionofficer.query(findSql, [positionId], (err, results) => {
      if (err) {
        console.error("Error finding targetposition:", err);
        return reject(err);
      }
      
      if (results.length === 0) {
        return resolve({
          success: false,
          message: "No active target position assignment found for today."
        });
      }
      
      const tpId = results[0].id;
      const targetFinishedVal = isFinished; 
      
      const updateSql = `
        UPDATE targetposition 
        SET isFinished = ? 
        WHERE id = ?
      `;
      db.collectionofficer.query(updateSql, [targetFinishedVal, tpId], (upErr, upResults) => {
        if (upErr) {
          console.error("Error updating targetposition occupancy:", upErr);
          return reject(upErr);
        }
        resolve({
          success: true,
          message: `Position status updated to ${targetFinishedVal === 1 ? 'Occupied' : 'Available'}.`,
          data: { targetPositionId: tpId, isFinished: targetFinishedVal }
        });
      });
    });
  });
};