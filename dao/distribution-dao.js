const db = require("../startup/database");

exports.getTargetForOfficerDao = (officerId) => {
  return new Promise((resolve, reject) => {
    if (!officerId) {
      return reject(new Error("Officer ID is missing or invalid"));
    }

    const sql = `
      SELECT 
        dt.id AS distributedTargetId,
        dt.companycenterId,
        dt.userId,
        dt.target,
        dt.complete,
        dt.createdAt AS targetCreatedAt,

        dti.id AS distributedTargetItemId,
        dti.orderId,
        dti.isComplete,
        dti.completeTime,
        dti.createdAt AS itemCreatedAt,

        po.id AS processOrderId,
        po.invNo,
        po.transactionId,
        po.paymentMethod,
        po.isPaid,
        po.amount,
        po.status,
        po.createdAt AS orderCreatedAt,
        po.reportStatus,

        o.id AS orderId,
        o.isPackage,
        o.userId AS orderUserId,
        o.orderApp,
        o.buildingType,
        o.sheduleType,
        o.sheduleDate,
        o.sheduleTime,

        -- Additional item counts
        CAST(COALESCE(additional_item_counts.total_items, 0) AS UNSIGNED) AS totalAdditionalItems,
        CAST(COALESCE(additional_item_counts.packed_items, 0) AS UNSIGNED) AS packedAdditionalItems,
        CAST(COALESCE(additional_item_counts.pending_items, 0) AS UNSIGNED) AS pendingAdditionalItems,

        -- Additional item status
        CASE 
            WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN NULL
            WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
            WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
                 COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
            WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
            ELSE NULL
        END AS additionalItemStatus,

        -- Package counts
        CAST(COALESCE(package_item_counts.total_items, 0) AS UNSIGNED) AS totalPackageItems,
        CAST(COALESCE(package_item_counts.packed_items, 0) AS UNSIGNED) AS packedPackageItems,
        CAST(COALESCE(package_item_counts.pending_items, 0) AS UNSIGNED) AS pendingPackageItems,
        CAST(COALESCE(package_item_counts.total_packages, 0) AS UNSIGNED) AS totalPackages,
        CAST(COALESCE(package_item_counts.locked_packages, 0) AS UNSIGNED) AS lockedPackages,
        CAST(COALESCE(package_item_counts.completed_packages, 0) AS UNSIGNED) AS completedPackages,
        CAST(COALESCE(package_item_counts.opened_packages, 0) AS UNSIGNED) AS openedPackages,
        CAST(COALESCE(package_item_counts.pending_packages, 0) AS UNSIGNED) AS pendingPackages,

        -- Overall package status
        CASE 
            WHEN o.isPackage = 0 THEN NULL
            WHEN COALESCE(package_item_counts.total_packages, 0) = 0 THEN 'Pending'
            WHEN COALESCE(package_item_counts.completed_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Completed'
            WHEN COALESCE(package_item_counts.pending_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Pending'
            ELSE 'Opened'
        END AS packageItemStatus,

        -- Final overall selectedStatus
        CASE 
            WHEN o.isPackage = 0 THEN
                CASE 
                    WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN 'Pending'
                    WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
                    WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
                         COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
                    WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
                    ELSE 'Pending'
                END
            WHEN o.isPackage = 1 THEN
                CASE 
                    WHEN COALESCE(additional_item_counts.total_items, 0) > 0 AND 
                         COALESCE(package_item_counts.total_packages, 0) > 0 THEN
                        CASE 
                            WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) AND
                                 COALESCE(package_item_counts.completed_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Completed'
                            WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 OR
                                 COALESCE(package_item_counts.pending_packages, 0) > 0 THEN 'Pending'
                            ELSE 'Opened'
                        END
                    WHEN COALESCE(additional_item_counts.total_items, 0) > 0 THEN
                        CASE 
                            WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
                            WHEN COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
                            ELSE 'Completed'
                        END
                    WHEN COALESCE(package_item_counts.total_packages, 0) > 0 THEN
                        CASE 
                            WHEN COALESCE(package_item_counts.completed_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Completed'
                            WHEN COALESCE(package_item_counts.pending_packages, 0) > 0 THEN 'Pending'
                            ELSE 'Opened'
                        END
                    ELSE 'Pending'
                END
            ELSE 'Pending'
        END AS selectedStatus

      FROM 
          distributedtarget dt
      INNER JOIN 
          distributedtargetitems dti ON dt.id = dti.targetId
      INNER JOIN 
          market_place.processorders po ON dti.orderId = po.id
      INNER JOIN 
          market_place.orders o ON po.orderId = o.id
      LEFT JOIN (
          SELECT 
              orderId,
              COUNT(*) as total_items,
              SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
              SUM(CASE WHEN isPacked = 0 THEN 1 ELSE 0 END) as pending_items
          FROM market_place.orderadditionalitems
          GROUP BY orderId
      ) additional_item_counts ON o.id = additional_item_counts.orderId
      LEFT JOIN (
          SELECT 
              op.orderId,
              COUNT(DISTINCT op.id) as total_packages,
              SUM(CASE WHEN op.isLock = 1 THEN 1 ELSE 0 END) as locked_packages,
              SUM(COALESCE(package_items.total_items, 0)) as total_items,
              SUM(COALESCE(package_items.packed_items, 0)) as packed_items,
              SUM(COALESCE(package_items.pending_items, 0)) as pending_items,
              SUM(CASE 
                  WHEN COALESCE(package_items.total_items, 0) = 0 THEN 0
                  WHEN COALESCE(package_items.packed_items, 0) = COALESCE(package_items.total_items, 0) THEN 1 
                  ELSE 0 
              END) as completed_packages,
              SUM(CASE 
                  WHEN COALESCE(package_items.total_items, 0) = 0 THEN 1
                  WHEN COALESCE(package_items.packed_items, 0) = 0 THEN 1 
                  ELSE 0 
              END) as pending_packages,
              SUM(CASE 
                  WHEN COALESCE(package_items.packed_items, 0) > 0 AND 
                       COALESCE(package_items.packed_items, 0) < COALESCE(package_items.total_items, 0) THEN 1 
                  ELSE 0 
              END) as opened_packages
          FROM market_place.orderpackage op
          LEFT JOIN (
              SELECT 
                  orderPackageId,
                  COUNT(id) as total_items,
                  SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
                  SUM(CASE WHEN isPacked = 0 THEN 1 ELSE 0 END) as pending_items
              FROM market_place.orderpackageitems
              GROUP BY orderPackageId
          ) package_items ON op.id = package_items.orderPackageId
          GROUP BY op.orderId
      ) package_item_counts ON po.id = package_item_counts.orderId

      WHERE 
          dt.userId = ?
          AND DATE(dt.createdAt) BETWEEN DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND CURDATE()

      ORDER BY 
          dt.companycenterId ASC,
          dt.userId DESC,
          dt.target ASC,
          dt.complete ASC,
          o.id ASC
    `;

    db.collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Database query error in getTargetForOfficerDao (falling back to empty array):", err.message);
        return resolve([]);
      }
      resolve(results);
    });
  });
};

exports.getOrderData = async (req, res) => {
  try {
    const { orderId } = req.params;
    const officerId = req.user.id;

    if (!orderId || isNaN(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID provided",
      });
    }

    const orderData = await distributionDao.getOrderDataDao(orderId);

    const additionalItems = orderData.additionalItems || [];
    const packages = orderData.packageData || [];

    let allPackageItems = [];
    packages.forEach((pkg) => {
      if (pkg.items && pkg.items.length > 0) {
        allPackageItems = [...allPackageItems, ...pkg.items];
      }
    });

    const allItems = [...additionalItems, ...allPackageItems];

    const responseData = {
      ...orderData,
      itemsSummary: {
        additionalItems: additionalItems,
        packages: packages,
        allPackageItems: allPackageItems,
        allItems: allItems,
        totalAdditionalItems: additionalItems.length,
        totalPackages: packages.length,
        totalPackageItems: allPackageItems.length,
        totalItems: allItems.length,
      },
    };

    res.status(200).json({
      success: true,
      message: "Order data retrieved successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error getting order data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve order data",
      error: error.message,
    });
  }
};

exports.getOrderDataDao = (orderId) => {
  return new Promise((resolve, reject) => {
    if (!orderId) {
      return reject(new Error("Order ID is missing or invalid"));
    }

    const sql = `
            SELECT 
                o.id AS orderId,
                o.isPackage,
                o.userId AS orderUserId,
                o.orderApp,
                o.buildingType,
                o.sheduleType,
                o.sheduleDate,
                o.sheduleTime,
                o.createdAt AS orderCreatedAt,

                -- Customer Information
                mu.id AS customerId,
                mu.rateofCus AS customerRateOfCus,

                -- Process Order Information
                po.id AS processOrderId,

                -- Additional Items (for all orders)
                oai.id AS additionalItemId,
                oai.productId AS additionalProductId,
                oai.qty AS additionalQty,
                oai.unit AS additionalUnit,
                oai.price AS additionalPrice,
                oai.discount AS additionalDiscount,
                oai.isPacked AS additionalIsPacked,
                mi_additional.displayName AS additionalProductName,
                mi_additional.category AS additionalProductCategory,
                mi_additional.normalPrice AS additionalNormalPrice,

                -- Package Details (linked through processorders) - Multiple packages support
                op.id AS orderPackageId,
                op.packageId,
                op.packingStatus,
                op.createdAt AS packageCreatedAt,
                op.qty AS packageQty,
                op.isLock AS packageIsLock,

                -- Package Information
                mp.displayName AS packageName,
                mp.description AS packageDescription,
                mp.status AS packageStatus,
                mp.productPrice AS packagePrice,
                mp.packingFee AS packagePackingFee,

                -- Package Items
                opi.id AS packageItemId,
                opi.productType AS packageProductType,
                opi.productId AS packageProductId,
                opi.qty AS packageItemQty,
                opi.price AS packageItemPrice,
                opi.isPacked AS packageIsPacked,
                mi_package.displayName AS packageProductName,
                mi_package.category AS packageProductCategory,
                mi_package.normalPrice AS packageNormalPrice,

                -- Product Type Information
                pt.id AS productTypeId,
                pt.typeName AS productTypeName

            FROM 
                market_place.orders o

            LEFT JOIN
                market_place.marketplaceusers mu ON o.userId = mu.id
            
            LEFT JOIN 
                market_place.processorders po ON o.id = po.orderId
            
            LEFT JOIN 
                market_place.orderadditionalitems oai ON o.id = oai.orderId
            LEFT JOIN 
                market_place.marketplaceitems mi_additional ON oai.productId = mi_additional.id

            LEFT JOIN 
                market_place.orderpackage op ON po.id = op.orderId
            
            LEFT JOIN 
                market_place.marketplacepackages mp ON op.packageId = mp.id
            
            LEFT JOIN 
                market_place.orderpackageitems opi ON op.id = opi.orderPackageId
            LEFT JOIN 
                market_place.marketplaceitems mi_package ON opi.productId = mi_package.id

            LEFT JOIN 
                market_place.producttypes pt ON opi.productType = pt.id

            WHERE 
                o.id = ?
            
            ORDER BY 
                o.id ASC,
                oai.id ASC,
                op.id ASC,
                opi.id ASC
        `;

    const preserveValue = (value) => {
      if (value === null || value === undefined) return value;
      return +value;
    };

    /**
     * Normalize qty to kg.
     * If the unit stored in the DB is "g" (grams), divide by 1000.
     * All other units (kg, Kg, KG, etc.) are treated as already in kg.
     * Returns { qty: number (in kg), unit: "kg" }
     */
    const normalizeToKg = (rawQty, rawUnit) => {
      const qty = preserveValue(rawQty) || 0;
      const unit = (rawUnit || "kg").toString().trim().toLowerCase();

      if (unit === "g") {
        return {
          qty: parseFloat((qty / 1000).toFixed(4)),
          unit: "kg",
        };
      }

      return {
        qty: qty,
        unit: "kg",
      };
    };

    db.collectionofficer.query(sql, [orderId], (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return reject(err);
      }

      if (results.length === 0) {
        return resolve({
          orderInfo: null,
          additionalItems: [],
          packageData: [],
          warnings: [],
          meta: {
            hasDataInconsistency: false,
            hasProcessOrder: false,
            hasPackageData: false,
            totalPackages: 0,
            totalPackageQty: 0,
            totalAdditionalItems: 0,
            totalPackageItems: 0,
          },
        });
      }

      const orderInfo = {
        orderId: results[0].orderId,
        isPackage: results[0].isPackage,
        orderUserId: results[0].orderUserId,
        orderApp: results[0].orderApp,
        buildingType: results[0].buildingType,
        sheduleType: results[0].sheduleType,
        sheduleDate: results[0].sheduleDate,
        sheduleTime: results[0].sheduleTime,
        orderCreatedAt: results[0].orderCreatedAt,
        processOrderId: results[0].processOrderId,
        customerId: results[0].customerId,
        rateofCus: results[0].customerRateOfCus,
      };

      const additionalItemsMap = new Map();
      const packagesMap = new Map();
      const warnings = [];

      results.forEach((row) => {
        if (
          row.additionalItemId &&
          !additionalItemsMap.has(row.additionalItemId)
        ) {
          const { qty: normalizedQty, unit: normalizedUnit } = normalizeToKg(
            row.additionalQty,
            row.additionalUnit,
          );

          additionalItemsMap.set(row.additionalItemId, {
            id: row.additionalItemId,
            productId: row.additionalProductId,
            qty: normalizedQty,
            unit: normalizedUnit,
            price: preserveValue(row.additionalPrice),
            discount: preserveValue(row.additionalDiscount),
            isPacked: row.additionalIsPacked,
            productName: row.additionalProductName,
            category: row.additionalProductCategory,
            normalPrice: preserveValue(row.additionalNormalPrice),
          });
        }

        if (
          orderInfo.isPackage === 1 &&
          orderInfo.processOrderId &&
          row.orderPackageId
        ) {
          if (!packagesMap.has(row.orderPackageId)) {
            packagesMap.set(row.orderPackageId, {
              id: row.orderPackageId,
              packageId: row.packageId,
              packingStatus: row.packingStatus,
              createdAt: row.packageCreatedAt,
              packageQty: preserveValue(row.packageQty) || 1,
              packageIsLock: row.packageIsLock,
              packageName: row.packageName,
              packageDescription: row.packageDescription,
              packageStatus: row.packageStatus,
              packagePrice: preserveValue(row.packagePrice),
              packagePackingFee: preserveValue(row.packagePackingFee),
              items: new Map(),
            });
          }

          if (row.packageItemId) {
            const currentPackage = packagesMap.get(row.orderPackageId);
            if (!currentPackage.items.has(row.packageItemId)) {
              currentPackage.items.set(row.packageItemId, {
                id: row.packageItemId,
                productType: row.packageProductType,
                productId: row.packageProductId,
                qty: preserveValue(row.packageItemQty),
                unit: "kg",
                price: preserveValue(row.packageItemPrice),
                isPacked: row.packageIsPacked,
                productName: row.packageProductName,
                category: row.packageProductCategory,
                normalPrice: preserveValue(row.packageNormalPrice),
                productTypeId: row.productTypeId,
                productTypeName: row.productTypeName,
              });
            }
          }
        }
      });

      if (orderInfo.isPackage === 1 && !orderInfo.processOrderId) {
        warnings.push({
          type: "MISSING_PROCESS_ORDER",
          message: `Order ${orderId} is marked as package but missing processorders record`,
        });
      }

      if (
        orderInfo.isPackage === 1 &&
        orderInfo.processOrderId &&
        packagesMap.size === 0
      ) {
        warnings.push({
          type: "MISSING_PACKAGE_RECORDS",
          message: `Order ${orderId} has processorder but missing orderpackage records`,
        });
      }

      const additionalItems = Array.from(additionalItemsMap.values());
      const packages = Array.from(packagesMap.values()).map((pkg) => ({
        ...pkg,
        items: Array.from(pkg.items.values()),
      }));

      const totalPackageQty = packages.reduce((total, pkg) => {
        return total + (pkg.packageQty || 1);
      }, 0);

      const structuredData = {
        orderInfo: orderInfo,
        additionalItems: additionalItems,
        packageData: packages,
        warnings: warnings,
        meta: {
          hasDataInconsistency: warnings.length > 0,
          hasProcessOrder: !!orderInfo.processOrderId,
          hasPackageData: packages.length > 0,
          totalPackages: packages.length,
          totalPackageQty: totalPackageQty,
          totalAdditionalItems: additionalItems.length,
          totalPackageItems: packages.reduce(
            (total, pkg) => total + pkg.items.length,
            0,
          ),
        },
      };

      resolve(structuredData);
    });
  });
};

exports.validateOrderStructure = async (orderId) => {
  try {
    const checkSql = `
            SELECT 
                o.id,
                o.isPackage,
                po.id as processOrderId
            FROM market_place.orders o
            LEFT JOIN market_place.processorders po ON o.id = po.orderId
            WHERE o.id = ?
        `;

    const result = await new Promise((resolve, reject) => {
      db.collectionofficer.query(checkSql, [orderId], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    if (result.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }

    const order = result[0];
    const fixes = [];

    if (order.isPackage === 1 && !order.processOrderId) {
      const createProcessOrderSql = `
                INSERT INTO market_place.processorders (orderId, createdAt)
                VALUES (?, NOW())
            `;

      await new Promise((resolve, reject) => {
        db.collectionofficer.query(
          createProcessOrderSql,
          [orderId],
          (err, result) => {
            if (err) return reject(err);
            fixes.push({
              type: "CREATED_PROCESS_ORDER",
              message: `Created processorders record for order ${orderId}`,
              processOrderId: result.insertId,
            });
            resolve(result);
          },
        );
      });
    }

    return {
      orderId: orderId,
      fixes: fixes,
      fixesApplied: fixes.length > 0,
    };
  } catch (error) {
    console.error("Error in validateOrderStructure:", error);
    throw error;
  }
};

exports.debugOrderRelationships = async (orderId) => {
  const queries = [
    {
      name: "orders",
      sql: "SELECT * FROM market_place.orders WHERE id = ?",
    },
    {
      name: "processorders",
      sql: "SELECT * FROM market_place.processorders WHERE orderId = ?",
    },
    {
      name: "orderpackage",
      sql: `SELECT op.* FROM market_place.orderpackage op 
                  JOIN market_place.processorders po ON op.orderId = po.id 
                  WHERE po.orderId = ?`,
    },
    {
      name: "orderadditionalitems",
      sql: "SELECT * FROM market_place.orderadditionalitems WHERE orderId = ?",
    },
  ];

  const results = {};

  for (const query of queries) {
    try {
      results[query.name] = await new Promise((resolve, reject) => {
        db.collectionofficer.query(query.sql, [orderId], (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });
    } catch (error) {
      results[query.name] = { error: error.message };
    }
  }

  return results;
};

exports.updatePackageItems = (items) => {
  return new Promise(async (resolve, reject) => {
    if (!items || items.length === 0) {
      return resolve();
    }

    const sql = `
            UPDATE market_place.orderpackageitems 
            SET isPacked = ? 
            WHERE id = ?
        `;

    try {
      const updatePromises = items.map((item) => {
        return new Promise((resolveItem, rejectItem) => {
          db.collectionofficer.query(
            sql,
            [item.isPacked, item.id],
            (err, result) => {
              if (err) {
                console.error(`Error updating package item ${item.id}:`, err);
                return rejectItem(err);
              }
              resolveItem(result);
            },
          );
        });
      });

      const results = await Promise.all(updatePromises);

      resolve(results);
    } catch (error) {
      console.error("Error updating package items:", error);
      reject(error);
    }
  });
};

// Update additional items
exports.updateAdditionalItems = (items) => {
  return new Promise(async (resolve, reject) => {
    if (!items || items.length === 0) {
      return resolve();
    }

    const sql = `
            UPDATE market_place.orderadditionalitems 
            SET isPacked = ? 
            WHERE id = ?
        `;

    try {
      const updatePromises = items.map((item) => {
        return new Promise((resolveItem, rejectItem) => {
          db.collectionofficer.query(
            sql,
            [item.isPacked, item.id],
            (err, result) => {
              if (err) {
                console.error(
                  `Error updating additional item ${item.id}:`,
                  err,
                );
                return rejectItem(err);
              }
              resolveItem(result);
            },
          );
        });
      });

      const results = await Promise.all(updatePromises);

      resolve(results);
    } catch (error) {
      console.error("Error updating additional items:", error);
      reject(error);
    }
  });
};

exports.updateDistributedTargetComplete = (frontendOrderId, officerId) => {
  return new Promise((resolve, reject) => {
    const getProcessOrderIdSql = `
            SELECT id FROM market_place.processorders 
            WHERE orderId = ?
        `;

    db.collectionofficer.query(
      getProcessOrderIdSql,
      [frontendOrderId],
      (err, processOrderResult) => {
        if (err) {
          console.error(
            `Error getting process order ID for orderId ${frontendOrderId}:`,
            err,
          );
          return reject(err);
        }

        if (processOrderResult.length === 0) {
          console.warn(`No process order found for orderId ${frontendOrderId}`);
          return resolve({ affectedRows: 0 });
        }

        const processOrderId = processOrderResult[0].id;

        const updateProcessOrderSql = `
                UPDATE market_place.processorders 
                SET packBy = ?
                WHERE id = ?
            `;

        db.collectionofficer.query(
          updateProcessOrderSql,
          [officerId, processOrderId],
          (processOrderErr, processOrderResult) => {
            if (processOrderErr) {
              console.error(
                `Error updating processorders packBy for ID ${processOrderId}:`,
                processOrderErr,
              );
              return reject(processOrderErr);
            }

            const getTargetIdSql = `
                    SELECT DISTINCT targetId FROM collection_officer.distributedtargetitems
                    WHERE orderId = ?
                    LIMIT 1
                `;

            db.collectionofficer.query(
              getTargetIdSql,
              [processOrderId],
              (targetErr, targetResult) => {
                if (targetErr) {
                  console.error(
                    `Error getting targetId for process order ID ${processOrderId}:`,
                    targetErr,
                  );
                  return reject(targetErr);
                }

                if (targetResult.length === 0) {
                  console.warn(
                    `No distributed target items found for process order ID ${processOrderId}`,
                  );
                  return resolve({
                    processOrderUpdated: processOrderResult.affectedRows,
                    distributedTargetUpdated: 0,
                    distributedTargetCountUpdated: 0,
                  });
                }

                const targetId = targetResult[0].targetId;

                const updateDistributedSql = `
                        UPDATE collection_officer.distributedtargetitems 
                        SET isComplete = 1, completeTime = NOW()
                        WHERE orderId = ?
                    `;

                db.collectionofficer.query(
                  updateDistributedSql,
                  [processOrderId],
                  (updateErr, updateResult) => {
                    if (updateErr) {
                      console.error(
                        `Error updating distributed target items for process order ID ${processOrderId} (falling back):`,
                        updateErr,
                      );
                      return resolve({
                        processOrderUpdated: processOrderResult.affectedRows,
                        distributedTargetUpdated: 0,
                        distributedTargetCountUpdated: 0,
                      });
                    }

                    if (updateResult.affectedRows === 0) {
                      console.warn(
                        `No distributed target items found for process order ID ${processOrderId}`,
                      );
                      return resolve({
                        processOrderUpdated: processOrderResult.affectedRows,
                        distributedTargetUpdated: updateResult.affectedRows,
                        distributedTargetCountUpdated: 0,
                      });
                    }

                    if (updateResult.affectedRows > 0) {
                      const updateTargetCompleteSql = `
                                UPDATE collection_officer.distributedtarget
                                SET complete = complete + ?
                                WHERE id = ?
                            `;

                      db.collectionofficer.query(
                        updateTargetCompleteSql,
                        [updateResult.affectedRows, targetId],
                        (targetUpdateErr, targetUpdateResult) => {
                          if (targetUpdateErr) {
                            console.error(
                              `Error updating distributedtarget complete count for targetId ${targetId} (falling back):`,
                              targetUpdateErr,
                            );
                            return resolve({
                              processOrderUpdated: processOrderResult.affectedRows,
                              distributedTargetUpdated: updateResult.affectedRows,
                              distributedTargetCountUpdated: 0,
                            });
                          }

                          if (targetUpdateResult.affectedRows === 0) {
                            console.warn(
                              `No distributedtarget record found for targetId ${targetId}`,
                            );
                          } else {
                            console.log(
                              `Incremented complete count by ${updateResult.affectedRows} for distributedtarget ID ${targetId}`,
                            );
                          }

                          resolve({
                            processOrderUpdated:
                              processOrderResult.affectedRows,
                            distributedTargetUpdated: updateResult.affectedRows,
                            distributedTargetCountUpdated:
                              targetUpdateResult.affectedRows,
                          });
                        },
                      );
                    } else {
                      resolve({
                        processOrderUpdated: processOrderResult.affectedRows,
                        distributedTargetUpdated: updateResult.affectedRows,
                        distributedTargetCountUpdated: 0,
                      });
                    }
                  },
                );
              },
            );
          },
        );
      },
    );
  });
};

// Get all Retail Items
exports.getAllRetailItems = async (orderId, productTypeId) => {
  return new Promise((resolve, reject) => {
    const query = `
            SELECT 
                mi.id,
                mi.varietyId,
                mi.productTypeId,
                mi.displayName,
                mi.category,
                mi.normalPrice,
                mi.discountedPrice,
                mi.discount,
                mi.promo,
                mi.unitType,
                mi.startValue,
                mi.changeby,
                mi.displayType,
                LEFT(mi.tags, 256) as tags,
                mi.createdAt,
                mi.maxQuantity,
                IF(el.mpItemId IS NOT NULL, 1, 0) AS isExcluded,
                IF(pl.mpItemId IS NOT NULL, 1, 0) AS isPreferred
            FROM market_place.marketplaceitems mi
            LEFT JOIN (
                SELECT DISTINCT el.mpItemId 
                FROM market_place.excludelist el
                INNER JOIN market_place.orders o ON el.userId = o.userId
                INNER JOIN market_place.processorders po ON o.id = po.orderId
                WHERE po.orderId = ?
            ) el ON mi.id = el.mpItemId
            LEFT JOIN (
                SELECT DISTINCT pl.mpItemId 
                FROM market_place.preferlist pl
                INNER JOIN market_place.orders o ON pl.userId = o.userId
                INNER JOIN market_place.processorders po ON o.id = po.orderId
                WHERE po.orderId = ?
            ) pl ON mi.id = pl.mpItemId
            WHERE mi.category = 'Retail'
            ${productTypeId ? "AND mi.productTypeId = ?" : ""}
            ORDER BY isPreferred DESC, isExcluded ASC, mi.displayName ASC
            LIMIT 1000
        `;

    const params = productTypeId
      ? [orderId, orderId, productTypeId]
      : [orderId, orderId];

    db.admin.query(query, params, (error, results) => {
      if (error) {
        console.error("Error fetching retail marketplace items:", error);
        reject(error);
      } else {
        const retailOnly = results.filter((item) => item.category === "Retail");
        resolve(retailOnly);
      }
    });
  });
};

exports.createReplaceRequestDao = (replaceData) => {
  return new Promise((resolve, reject) => {
    db.collectionofficer.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting connection from pool:", err);
        return reject(err);
      }

      connection.beginTransaction((err) => {
        if (err) {
          console.error("Error starting transaction:", err);
          connection.release();
          return reject(err);
        }

        const checkSql =
          "SELECT id, isLock FROM market_place.orderpackage WHERE id = ?";

        connection.query(
          checkSql,
          [replaceData.orderPackageId],
          (err, checkResult) => {
            if (err) {
              console.error("Error checking record existence:", err);
              return connection.rollback(() => {
                connection.release();
                reject(err);
              });
            }

            if (!checkResult || checkResult.length === 0) {
              console.error(
                "No record found with ID:",
                replaceData.orderPackageId,
              );
              return connection.rollback(() => {
                connection.release();
                reject(
                  new Error(
                    `OrderPackage with ID ${replaceData.orderPackageId} not found`,
                  ),
                );
              });
            }

            const checkItemSql =
              "SELECT id FROM market_place.orderpackageitems WHERE id = ? AND orderPackageId = ?";

            connection.query(
              checkItemSql,
              [replaceData.replaceId, replaceData.orderPackageId],
              (err, itemCheckResult) => {
                if (err) {
                  console.error(
                    "Error checking orderpackageitem existence:",
                    err,
                  );
                  return connection.rollback(() => {
                    connection.release();
                    reject(err);
                  });
                }

                if (!itemCheckResult || itemCheckResult.length === 0) {
                  console.error(
                    "No orderpackageitem found with ID:",
                    replaceData.replaceId,
                  );
                  return connection.rollback(() => {
                    connection.release();
                    reject(
                      new Error(
                        `OrderPackageItem with ID ${replaceData.replaceId} not found for OrderPackage ${replaceData.orderPackageId}`,
                      ),
                    );
                  });
                }

                if (replaceData.isDCM) {
                  handleDCMUpdates(connection, replaceData, resolve, reject);
                } else if (replaceData.isDIO) {
                  handleDIOUpdates(connection, replaceData, resolve, reject);
                } else {
                  console.error("Unknown user role");
                  return connection.rollback(() => {
                    connection.release();
                    reject(new Error("Unknown user role"));
                  });
                }
              },
            );
          },
        );
      });
    });
  });
};

function handleDCMUpdates(connection, replaceData, resolve, reject) {
  const getCurrentDataSql = `
        SELECT productType, productId, qty, price
        FROM market_place.orderpackageitems 
        WHERE id = ? AND orderPackageId = ?
    `;

  connection.query(
    getCurrentDataSql,
    [replaceData.replaceId, replaceData.orderPackageId],
    (err, currentData) => {
      if (err) {
        console.error("Error fetching current orderpackageitem data:", err);
        return connection.rollback(() => {
          connection.release();
          reject(err);
        });
      }

      if (!currentData || currentData.length === 0) {
        console.error(
          "No current data found for orderpackageitem ID:",
          replaceData.replaceId,
        );
        return connection.rollback(() => {
          connection.release();
          reject(new Error("OrderPackageItem not found"));
        });
      }

      const previousData = currentData[0];

      const insertPrevDataSql = `
            INSERT INTO market_place.prevdefineproduct 
            (orderPackageId, replceId, productType, productId, qty, price, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;

      const insertPrevValues = [
        replaceData.orderPackageId,
        replaceData.replaceId,
        previousData.productType,
        previousData.productId,
        previousData.qty,
        previousData.price,
      ];

      connection.query(
        insertPrevDataSql,
        insertPrevValues,
        (err, insertResult) => {
          if (err) {
            console.error("Error inserting previous data:", err);
            return connection.rollback(() => {
              connection.release();
              reject(err);
            });
          }

          const updateItemsSql = `
                UPDATE market_place.orderpackageitems 
                SET productType = ?, productId = ?, qty = ?, price = ?
                WHERE id = ? AND orderPackageId = ?
            `;

          const updateItemsValues = [
            replaceData.productType,
            replaceData.productId,
            replaceData.qty,
            replaceData.price,
            replaceData.replaceId,
            replaceData.orderPackageId,
          ];

          connection.query(
            updateItemsSql,
            updateItemsValues,
            (err, itemsResult) => {
              if (err) {
                console.error("Error updating orderpackageitems:", err);
                return connection.rollback(() => {
                  connection.release();
                  reject(err);
                });
              }

              if (itemsResult.affectedRows === 0) {
                console.warn("No orderpackageitem was updated");
                return connection.rollback(() => {
                  connection.release();
                  reject(new Error("Failed to update orderpackageitem"));
                });
              }

              connection.commit((err) => {
                if (err) {
                  console.error("Error committing DCM transaction:", err);
                  return connection.rollback(() => {
                    connection.release();
                    reject(err);
                  });
                }

                connection.release();

                resolve({
                  orderPackageId: replaceData.orderPackageId,
                  replaceItemId: replaceData.replaceId,
                  previousDataId: insertResult.insertId,
                  message:
                    "Order package item updated successfully by DCM, previous data saved",
                  updatedBy: replaceData.userId,
                  previousData: previousData,
                  newData: {
                    productType: replaceData.productType,
                    productId: replaceData.productId,
                    qty: replaceData.qty,
                    price: replaceData.price,
                  },
                  permissions: "DCM - Limited access (orderpackageitems only)",
                });
              });
            },
          );
        },
      );
    },
  );
}

function handleDIOUpdates(connection, replaceData, resolve, reject) {
  const updateOrderPackageSql = `
        UPDATE market_place.orderpackage 
        SET isLock = 1 
        WHERE id = ? 
    `;

  connection.query(
    updateOrderPackageSql,
    [replaceData.orderPackageId],
    (err, updateResult) => {
      if (err) {
        console.error("Error updating orderpackage:", err);
        return connection.rollback(() => {
          connection.release();
          reject(err);
        });
      }

      if (updateResult.affectedRows === 0) {
        console.error("No rows were updated in orderpackage");
        return connection.rollback(() => {
          connection.release();
          reject(new Error("Failed to lock OrderPackage - no rows affected"));
        });
      }

      const insertReplaceSql = `
            INSERT INTO market_place.replacerequest 
            (orderPackageId, replceId, productType, productId, qty, price, status, userId, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

      const insertValues = [
        replaceData.orderPackageId,
        replaceData.replaceId,
        replaceData.productType,
        replaceData.productId,
        replaceData.qty,
        replaceData.price,
        replaceData.status,
        replaceData.userId,
      ];

      connection.query(insertReplaceSql, insertValues, (err, insertResult) => {
        if (err) {
          console.error("Error inserting replace request:", err);
          return connection.rollback(() => {
            connection.release();
            reject(err);
          });
        }

        if (replaceData.updateItems) {
          const updateItemsSql = `
                    UPDATE market_place.orderpackageitems 
                    SET productType = ?, productId = ?, qty = ?, price = ?, isPacked = ?
                    WHERE id = ? AND orderPackageId = ?
                `;

          const updateItemsValues = [
            replaceData.productType,
            replaceData.productId,
            replaceData.qty,
            replaceData.price,
            replaceData.isPacked || 0,
            replaceData.replaceId,
            replaceData.orderPackageId,
          ];

          connection.query(
            updateItemsSql,
            updateItemsValues,
            (err, itemsResult) => {
              if (err) {
                console.error("Error updating orderpackageitems:", err);
                return connection.rollback(() => {
                  connection.release();
                  reject(err);
                });
              }

              commitDIOTransaction(
                connection,
                resolve,
                reject,
                replaceData,
                insertResult.insertId,
              );
            },
          );
        } else {
          commitDIOTransaction(
            connection,
            resolve,
            reject,
            replaceData,
            insertResult.insertId,
          );
        }
      });
    },
  );
}

function commitDIOTransaction(
  connection,
  resolve,
  reject,
  replaceData,
  insertId,
) {
  connection.commit((err) => {
    if (err) {
      console.error("Error committing DIO transaction:", err);
      return connection.rollback(() => {
        connection.release();
        reject(err);
      });
    }

    connection.release();

    resolve({
      replaceRequestId: insertId,
      orderPackageId: replaceData.orderPackageId,
      replaceItemId: replaceData.replaceId,
      message:
        "Replacement request created and order package locked successfully by DIO",
      updatedBy: replaceData.userId,
      permissions: "DIO - Full access (orderpackage + replacerequest)",
    });
  });
}

exports.updateDistributedTargetItems = async (targetItemIds, orderId) => {
  let marketPlaceConnection;
  let collectionOfficerConnection;

  try {
    marketPlaceConnection = await new Promise((resolve, reject) => {
      db.marketPlace.getConnection((err, connection) => {
        if (err) return reject(err);
        resolve(connection);
      });
    });

    const [processOrderResults] = await marketPlaceConnection
      .promise()
      .query("SELECT id FROM processorders WHERE orderId = ?", [orderId]);

    if (processOrderResults.length === 0) {
      throw new Error("Process order not found");
    }

    const processOrderId = processOrderResults[0].id;

    collectionOfficerConnection = await new Promise((resolve, reject) => {
      db.collectionofficer.getConnection((err, connection) => {
        if (err) return reject(err);
        resolve(connection);
      });
    });

    const getItemsQuery =
      targetItemIds.length === 0
        ? "SELECT id, targetId FROM distributedtargetitems WHERE orderId = ? AND isComplete = 0 ORDER BY id"
        : "SELECT id, targetId FROM distributedtargetitems WHERE orderId = ? AND id IN (?) ORDER BY id";

    const getItemsParams =
      targetItemIds.length === 0
        ? [processOrderId]
        : [processOrderId, targetItemIds];

    const [items] = await collectionOfficerConnection
      .promise()
      .query(getItemsQuery, getItemsParams);

    if (items.length === 0) {
      return {
        updatedItems: 0,
        updatedTargets: 0,
      };
    }

    await collectionOfficerConnection.promise().beginTransaction();

    let updatedItemsCount = 0;
    let updatedTargetsCount = 0;

    try {
      for (const item of items) {
        const [itemUpdateResult] = await collectionOfficerConnection
          .promise()
          .query(
            "UPDATE distributedtargetitems SET isComplete = 1, completeTime = NOW() WHERE id = ? AND isComplete = 0",
            [item.id],
          );

        if (itemUpdateResult.affectedRows === 1) {
          updatedItemsCount++;

          const [targetUpdateResult] = await collectionOfficerConnection
            .promise()
            .query(
              "UPDATE distributedtarget SET complete = complete + 1 WHERE id = ?",
              [item.targetId],
            );

          if (targetUpdateResult.affectedRows === 1) {
            updatedTargetsCount++;
          } else {
            console.error(
              `Failed to update target ${item.targetId} - target may not exist`,
            );
          }
        }
      }

      await collectionOfficerConnection.promise().commit();

      return {
        updatedItems: updatedItemsCount,
        updatedTargets: updatedTargetsCount,
      };
    } catch (transactionError) {
      await collectionOfficerConnection.promise().rollback();
      console.error("Transaction rolled back due to error:", transactionError);
      throw transactionError;
    }
  } catch (error) {
    console.error("Database error in updateDistributedTargetItems (falling back to default resolved response):", error.message);
    return {
      updatedItems: 0,
      updatedTargets: 0,
    };
  } finally {
    if (marketPlaceConnection) marketPlaceConnection.release();
    if (collectionOfficerConnection) collectionOfficerConnection.release();
  }
};

exports.getDistributionTargets = async (officerId) => {
  return new Promise((resolve, reject) => {
    db.collectionofficer.getConnection((err, connection) => {
      if (err) return reject(err);

      connection.query(
        `SELECT
            tp.officerId AS userId,

            -- Total: today's scheduled orders assigned to this officer's row
            COUNT(dti.id) AS total_target,

            -- Completed: today's scheduled orders marked Completed
            SUM(CASE WHEN dti.orderStatus = 'Completed' THEN 1 ELSE 0 END) AS total_complete,

            -- Percentage: completed / total * 100
            CASE
                WHEN COUNT(dti.id) > 0
                THEN (SUM(CASE WHEN dti.orderStatus = 'Completed' THEN 1 ELSE 0 END) / COUNT(dti.id) * 100)
                ELSE 0
            END AS completionPercentage,

            MIN(dt.createdAt) AS createdAt,
            MAX(dt.createdAt) AS updatedAt

        FROM distributedtarget dt
        INNER JOIN distributedtargetitems dti
            ON dti.targetId = dt.id
        INNER JOIN market_place.processorders po
            ON po.id = dti.orderId
        INNER JOIN market_place.orders o
            ON o.id = po.orderId
        INNER JOIN packingpositions pp
            ON pp.rowId = dt.rowId
        INNER JOIN targetposition tp
            ON tp.positionId = pp.id AND DATE(tp.createdAt) = CURDATE()

        WHERE
            tp.officerId = ?
            -- Step 1: only targets created in last 3 days
            AND DATE(dt.createdAt) BETWEEN DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND CURDATE()
            -- Step 2: only orders scheduled for TODAY
            AND DATE(o.sheduleDate) = CURDATE()

        GROUP BY tp.officerId`,
        [officerId],
        (err, results) => {
          connection.release();
          if (err) {
            console.error("Database query error in getDistributionTargets (falling back to empty target array):", err.message);
            return resolve([]);
          }

          const transformedResults = results.map((row) => ({
            id: `${row.userId}_aggregated_${new Date().toISOString().split("T")[0]}`,
            companycenterId: null,
            userId: row.userId,
            target: row.total_target,
            complete: row.total_complete,
            completionPercentage: row.completionPercentage,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }));

          resolve(transformedResults);
        },
      );
    });
  });
};

exports.updateoutForDelivery = (orderId, userId) => {
  return new Promise((resolve, reject) => {
    const currentDate = new Date().toISOString().slice(0, 19).replace("T", " ");

    const getOrderDetailsSql = `
    SELECT 
        o.id as orderId,
        po.invNo,
        o.delivaryMethod,
        c.email as customerEmail,
        po.paymentMethod,
        po.amount as totalAmount,
        o.createdAt,
        o.sheduleDate,
        o.sheduleTime,
        c.title,
        c.firstName,
        c.lastName,
        c.phoneNumber,
        o.buildingType,

        -- House fields
        oh.houseNo       AS houseHouseNo,
        oh.streetName    AS houseStreetName,
        oh.city          AS houseCity,

        -- Apartment fields
        oa.buildingNo,
        oa.buildingName,
        oa.unitNo,
        oa.floorNo,
        oa.houseNo       AS aptHouseNo,
        oa.streetName    AS aptStreetName,
        oa.city          AS aptCity,

        -- Center fields (for Pickup orders)
        dc.centerName    AS centerName,
        dc.city          AS centerCity,
        dc.district      AS centerDistrict,
        dc.province      AS centerProvince,
        dc.country       AS centerCountry

    FROM market_place.orders AS o
    INNER JOIN market_place.processorders AS po ON po.orderId = o.id
    LEFT JOIN market_place.marketplaceusers AS c ON o.userId = c.id
    LEFT JOIN market_place.orderhouse AS oh 
        ON oh.orderId = o.id AND o.buildingType = 'House'
    LEFT JOIN market_place.orderapartment AS oa 
        ON oa.orderId = o.id AND o.buildingType = 'Apartment'
    LEFT JOIN collection_officer.distributedcenter AS dc 
        ON o.centerId = dc.id
    WHERE po.orderId = ?
`;

    const updateOrderSql = `
            UPDATE market_place.processorders AS po
            INNER JOIN market_place.orders AS o ON po.orderId = o.id
            SET po.status = CASE 
                WHEN o.delivaryMethod = 'Pickup' THEN 'Ready to Pickup'
                ELSE 'Out For Delivery'
            END,
            po.outBy = ?,
            po.outDlvrDate = ?
            WHERE po.orderId = ?
        `;

    const insertNotificationSql = `
            INSERT INTO market_place.dashnotification (orderId, title)
            SELECT po.id, 'Order is Out For Delivery'
            FROM market_place.processorders AS po
            INNER JOIN market_place.orders AS o ON po.orderId = o.id
            WHERE po.orderId = ? AND o.delivaryMethod != 'Pickup'
            ON DUPLICATE KEY UPDATE title = VALUES(title)
        `;

    try {
      db.collectionofficer.getConnection((err, connection) => {
        if (err) return reject(err);

        connection.beginTransaction((err) => {
          if (err) {
            connection.release();
            return reject(err);
          }

          connection.query(
            getOrderDetailsSql,
            [orderId],
            (err, orderDetails) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  reject(err);
                });
              }

              if (orderDetails.length === 0) {
                return connection.rollback(() => {
                  connection.release();
                  reject(new Error(`No order found with orderId: ${orderId}`));
                });
              }

              const orderInfo = orderDetails[0];
              const deliveryMethod = orderInfo.delivaryMethod;
              const newStatus =
                deliveryMethod === "Pickup"
                  ? "Ready to Pickup"
                  : "Out For Delivery";

              connection.query(
                updateOrderSql,
                [userId, currentDate, orderId],
                (err, result) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      reject(err);
                    });
                  }

                  connection.query(insertNotificationSql, [orderId], (err2) => {
                    if (err2) {
                      return connection.rollback(() => {
                        connection.release();
                        reject(err2);
                      });
                    }

                    connection.commit((err3) => {
                      if (err3) {
                        return connection.rollback(() => {
                          connection.release();
                          reject(err3);
                        });
                      }

                      connection.release();

                      resolve({
                        orderUpdate: result,
                        status: newStatus,
                        deliveryMethod: deliveryMethod,
                        orderInfo: orderInfo,
                      });
                    });
                  });
                },
              );
            },
          );
        });
      });
    } catch (error) {
      console.error("Error in updateoutForDelivery:", error);
      reject(error);
    }
  });
};
