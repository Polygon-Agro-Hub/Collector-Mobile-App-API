const db = require("../../startup/database");


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
                orders o

            LEFT JOIN
                marketplaceusers mu ON o.userId = mu.id
            
            LEFT JOIN 
                processorders po ON o.id = po.orderId
            
            LEFT JOIN 
                orderadditionalitems oai ON o.id = oai.orderId
            LEFT JOIN 
                marketplaceitems mi_additional ON oai.productId = mi_additional.id

            LEFT JOIN 
                orderpackage op ON po.id = op.orderId
            
            LEFT JOIN 
                marketplacepackages mp ON op.packageId = mp.id
            
            LEFT JOIN 
                orderpackageitems opi ON op.id = opi.orderPackageId
            LEFT JOIN 
                marketplaceitems mi_package ON opi.productId = mi_package.id

            LEFT JOIN 
                producttypes pt ON opi.productType = pt.id

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
            FROM orders o
            LEFT JOIN processorders po ON o.id = po.orderId
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
                INSERT INTO processorders (orderId, createdAt)
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
      sql: "SELECT * FROM orders WHERE id = ?",
    },
    {
      name: "processorders",
      sql: "SELECT * FROM processorders WHERE orderId = ?",
    },
    {
      name: "orderpackage",
      sql: `SELECT op.* FROM orderpackage op 
                  JOIN processorders po ON op.orderId = po.id 
                  WHERE po.orderId = ?`,
    },
    {
      name: "orderadditionalitems",
      sql: "SELECT * FROM orderadditionalitems WHERE orderId = ?",
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
            UPDATE orderpackageitems 
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
            UPDATE orderadditionalitems 
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
            SELECT id FROM processorders 
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
                UPDATE processorders 
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
          "SELECT id, isLock FROM orderpackage WHERE id = ?";

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
              "SELECT id FROM orderpackageitems WHERE id = ? AND orderPackageId = ?";

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
        FROM orderpackageitems 
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
            INSERT INTO prevdefineproduct 
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
                UPDATE orderpackageitems 
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
        UPDATE orderpackage 
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
            INSERT INTO replacerequest 
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
                    UPDATE orderpackageitems 
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
        INNER JOIN processorders po
            ON po.id = dti.orderId
        INNER JOIN orders o
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


