const db = require("../startup/database");

exports.getDCenterTarget = (irmId = null) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
          co.id,
          co.irmId,

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
          po.outDlvrDate,
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
          COALESCE(additional_item_counts.total_items, 0) AS totalAdditionalItems,
          COALESCE(additional_item_counts.packed_items, 0) AS packedAdditionalItems,
          COALESCE(additional_item_counts.pending_items, 0) AS pendingAdditionalItems,

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
          COALESCE(package_item_counts.total_items, 0) AS totalPackageItems,
          COALESCE(package_item_counts.packed_items, 0) AS packedPackageItems,
          COALESCE(package_item_counts.pending_items, 0) AS pendingPackageItems,
          COALESCE(package_item_counts.total_packages, 0) AS totalPackages,
          COALESCE(package_item_counts.locked_packages, 0) AS lockedPackages,
          COALESCE(package_item_counts.completed_packages, 0) AS completedPackages,
          COALESCE(package_item_counts.opened_packages, 0) AS openedPackages,
          COALESCE(package_item_counts.pending_packages, 0) AS pendingPackages,

          package_item_counts.all_locked AS allPackagesLocked,
          package_item_counts.packing_status_summary AS packagePackingStatusSummary,

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
                              WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND
                                   COALESCE(package_item_counts.pending_packages, 0) = 0 THEN 'Opened'
                              ELSE 'Pending'
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
      LEFT JOIN 
          collectionofficer co ON dt.userId = co.id
      INNER JOIN 
          distributedtargetitems dti ON dt.id = dti.targetId
      LEFT JOIN 
          market_place.processorders po ON dti.orderId = po.id
      LEFT JOIN 
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
              CASE WHEN COUNT(CASE WHEN op.isLock = 0 THEN 1 END) = 0 THEN 1 ELSE 0 END as all_locked,
              GROUP_CONCAT(DISTINCT op.packingStatus ORDER BY op.packingStatus) as packing_status_summary,
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
          DATE(dt.createdAt) BETWEEN DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND CURDATE()
          ${irmId ? "AND (co.irmId = ? OR dt.userId = ?)" : ""}

      ORDER BY 
          dt.companycenterId ASC,
          dt.userId DESC,
          dt.target ASC,
          dt.complete ASC,
          o.id ASC
    `;

    const queryParams = irmId ? [irmId, irmId] : [];
    db.collectionofficer.query(sql, queryParams, (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getOfficerDetailsById = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        co.*, 
        co.empId,
        dc.regCode,
        dc.centerName AS collectionCenterName,
        dc.contact01 AS centerContact01,
        dc.contact02 AS centerContact02,
        dc.district AS centerDistrict,
        dc.province AS centerProvince,
        com.companyNameEnglish AS companyNameEnglish,
        com.companyNameSinhala AS companyNameSinhala,
        com.companyNameTamil AS companyNameTamil,
        com.email AS companyEmail,
        com.oicName AS companyOICName,
        com.oicEmail AS companyOICEmail
      FROM 
        collectionofficer co
      JOIN 
        distributedcenter dc ON co.distributedCenterId = dc.id
      JOIN 
        company com ON co.companyId = com.id
      WHERE 
        co.id = ?;
    `;

    db.collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Database error:", err.message);
        return reject(new Error("Database error"));
      }

      if (results.length === 0) {
        return reject(new Error("Officer not found"));
      }

      resolve(results[0]);
    });
  });
};

exports.getAllReplaceRequests = (managerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
                rr.id,
                rr.orderPackageId,
                rr.productType,
                rr.replceId,
                rr.productId,
                rr.qty,
                rr.price,
                rr.status,
                rr.createdAt,
                rr.userId,
                op.orderId,
                op.packageId,
                op.packingStatus,
                opi.id AS replaceItemId,
                opi.productType AS replaceProductType,
                opi.productId AS replaceProductId,
                opi.qty AS replaceQty,
                opi.price AS replacePrice,
                opi.isPacked AS replaceItemPacked,
                pt.typeName AS productTypeName,
                mi.displayName AS productDisplayName,
                mi.normalPrice AS productNormalPrice,
                mi.discountedPrice AS productDiscountedPrice,
                rmi.displayName AS replaceProductDisplayName,
                rmi.normalPrice AS replaceProductNormalPrice,
                rmi.discountedPrice AS replaceProductDiscountedPrice,
                po.id AS processOrderId,
                po.orderId AS processOrderOrderId,
                po.invNo,
                co.id AS collectionOfficerId,
                co.centerId,
                co.distributedCenterId,
                co.companyId
            FROM 
                market_place.replacerequest rr
            LEFT JOIN 
                market_place.orderpackage op ON rr.orderPackageId = op.id
            LEFT JOIN 
                market_place.producttypes pt ON rr.productType = pt.id
            LEFT JOIN 
                market_place.marketplaceitems mi ON rr.productId = mi.id
            LEFT JOIN 
                market_place.processorders po ON op.orderId = po.id
            LEFT JOIN 
                market_place.orderpackageitems opi ON rr.replceId = opi.id
            LEFT JOIN 
                market_place.marketplaceitems rmi ON opi.productId = rmi.id
            INNER JOIN 
                collection_officer.collectionofficer co ON rr.userId = co.id
            WHERE 
                co.irmId = ?
                AND rr.status = 'Not Approved'
            ORDER BY 
                rr.createdAt DESC,
                rr.id ASC
            LIMIT 1000
        `;

    db.marketPlace.query(sql, [managerId], (err, results) => {
      if (err) {
        console.error("Database error details:", {
          message: err.message,
          sql: err.sql,
          code: err.code,
          errno: err.errno,
        });
        return reject(
          new Error("Database error while fetching pending replace requests"),
        );
      }

      resolve(results);
    });
  });
};

exports.getOrderPackageItemByReplaceId = (replaceId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        opi.id,
        opi.productType,
        opi.productId,
        opi.qty,
        opi.price,
        opi.isPacked,
        opi.orderPackageId,
        mpi.displayName,
        pt.typeName AS productTypeName
      FROM market_place.orderpackageitems opi
      LEFT JOIN market_place.marketplaceitems mpi ON opi.productId = mpi.id
      LEFT JOIN market_place.producttypes pt ON opi.productType = pt.id
      WHERE opi.id = ?
      LIMIT 1
    `;
    db.marketPlace.query(sql, [replaceId], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return reject(
          new Error("Database error while fetching order package item"),
        );
      }
      if (results.length === 0) {
        return resolve(null);
      }
      const item = results[0];
      resolve({
        id: item.id,
        productType: item.productType,
        productId: item.productId,
        qty: parseFloat(item.qty || 0),
        price: parseFloat(item.price || 0),
        isPacked: item.isPacked,
        orderPackageId: item.orderPackageId,
        displayName: item.displayName,
        productTypeName: item.productTypeName,
      });
    });
  });
};

exports.getRetailItemsExcludingUserExclusions = (orderId) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
                mi.id,
                mi.varietyId,
                mi.displayName,
                mi.category,
                mi.normalPrice,
                mi.discountedPrice,
                mi.unitType
            FROM 
                market_place.marketplaceitems mi
            WHERE 
                mi.category = 'Retail'
                AND mi.id NOT IN (
                    SELECT DISTINCT el.mpItemId 
                    FROM market_place.excludelist el
                    WHERE el.userId = (
                        SELECT o.userId 
                        FROM market_place.processorders po
                        INNER JOIN market_place.orders o ON o.id = po.orderId
                        WHERE po.id = ?
                    )
                    AND el.mpItemId IS NOT NULL
                )
            ORDER BY 
                mi.displayName ASC
        `;

    db.marketPlace.query(sql, [orderId], (err, results) => {
      if (err) {
        console.error("Database error details:", {
          message: err.message,
          sql: err.sql,
          code: err.code,
          errno: err.errno,
        });
        return reject(new Error("Database error while fetching retail items"));
      }

      const formattedResults = results.map((item) => ({
        id: item.id,
        varietyId: item.varietyId,
        displayName: item.displayName,
        category: item.category,
        normalPrice: parseFloat(item.normalPrice || 0),
        discountedPrice: item.discountedPrice
          ? parseFloat(item.discountedPrice)
          : null,
        unitType: item.unitType,
      }));

      resolve(formattedResults);
    });
  });
};

exports.getOrdreReplace = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        rr.replceId,
        rr.id,
        rr.orderPackageId,
        rr.productType,
        rr.productId,
        rr.qty,
        rr.price,
        rr.status,
        rr.userId,
        rr.createdAt,
        mpi.displayName
      FROM market_place.replacerequest rr
      LEFT JOIN market_place.marketplaceitems mpi ON rr.productId = mpi.id
      WHERE rr.id = ?  
      ORDER BY rr.replceId DESC, rr.id ASC, rr.orderPackageId ASC, 
               rr.productType ASC, rr.productId ASC, rr.qty ASC, 
               rr.price ASC, rr.status ASC, rr.userId ASC
    `;

    db.marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        console.error("Database error details:", {
          message: err.message,
          sql: err.sql,
          code: err.code,
          errno: err.errno,
        });
        return reject(
          new Error("Database error while fetching replace request data"),
        );
      }

      const formattedResults = results.map((item) => ({
        replceId: item.replceId,
        id: item.id,
        orderPackageId: item.orderPackageId,
        productType: item.productType,
        productId: item.productId,
        qty: parseFloat(item.qty || 0),
        price: parseFloat(item.price || 0),
        status: item.status,
        userId: item.userId,
        createdAt: item.createdAt,

        displayName: item.displayName,
      }));

      resolve(formattedResults);
    });
  });
};

exports.approveReplaceRequest = (params) => {
  return new Promise((resolve, reject) => {
    const { replaceRequestId, newProductId, quantity, price } = params;

    if (!replaceRequestId || !newProductId || !quantity || !price) {
      return reject(
        new Error(
          "Missing required parameters: replaceRequestId, newProductId, quantity, price",
        ),
      );
    }

    db.marketPlace.getConnection((err, connection) => {
      if (err) {
        console.error("Failed to get connection from pool:", err);
        return reject(new Error("Failed to get database connection"));
      }

      connection.beginTransaction((err) => {
        if (err) {
          console.error("Transaction begin error:", err);
          connection.release();
          return reject(new Error("Failed to start transaction"));
        }

        const getReplaceRequestSql = `
                    SELECT 
                        rr.id,
                        rr.replceId,
                        rr.orderPackageId,
                        rr.productType,
                        rr.productId as oldProductId,
                        rr.qty as oldQty,
                        rr.price as oldPrice,
                        rr.status,
                        op.isLock
                    FROM market_place.replacerequest rr
                    JOIN market_place.orderpackage op ON rr.orderPackageId = op.id
                    WHERE rr.id = ?
                `;

        connection.query(
          getReplaceRequestSql,
          [replaceRequestId],
          (err, replaceResults) => {
            if (err) {
              console.error("Get replace request error:", err);
              return connection.rollback(() => {
                connection.release();
                reject(new Error("Failed to get replace request details"));
              });
            }

            if (replaceResults.length === 0) {
              return connection.rollback(() => {
                connection.release();
                reject(
                  new Error(
                    `Replace request not found with id: ${replaceRequestId}`,
                  ),
                );
              });
            }

            const replaceRequest = replaceResults[0];

            if (replaceRequest.status === "Approved") {
              return connection.rollback(() => {
                connection.release();
                reject(new Error("Replace request is already approved"));
              });
            }

            const getOrderPackageItemsSql = `
                        SELECT id, productType, productId, qty, price 
                        FROM market_place.orderpackageitems 
                        WHERE id = ?
                    `;

            connection.query(
              getOrderPackageItemsSql,
              [replaceRequest.replceId],
              (err, itemsResults) => {
                if (err) {
                  console.error("Get order package items error:", err);
                  return connection.rollback(() => {
                    connection.release();
                    reject(new Error("Failed to get order package items"));
                  });
                }

                if (itemsResults.length === 0) {
                  return connection.rollback(() => {
                    connection.release();
                    reject(
                      new Error(
                        `No order package item found with id: ${replaceRequest.replceId}`,
                      ),
                    );
                  });
                }

                const orderPackageItem = itemsResults[0];

                if (
                  orderPackageItem.productId !== replaceRequest.oldProductId
                ) {
                  console.log(`WARNING: Product ID mismatch detected!`);
                }

                const updateReplaceRequestSql = `
                                UPDATE market_place.replacerequest 
                                SET 
                                    productId = ?,
                                    qty = ?,
                                    price = ?,
                                    status = 'Approved'
                                WHERE id = ?
                            `;

                connection.query(
                  updateReplaceRequestSql,
                  [newProductId, quantity, price, replaceRequest.id],
                  (err, updateReplaceResult) => {
                    if (err) {
                      console.error("Update replace request error:", err);
                      return connection.rollback(() => {
                        connection.release();
                        reject(new Error("Failed to update replace request"));
                      });
                    }

                    const insertPrevDefineProductSql = `
                                        INSERT INTO market_place.prevdefineproduct 
                                        (orderPackageId, replceId, productType, productId, qty, price)
                                        SELECT ?, ?, productType, productId, qty, price
                                        FROM market_place.orderpackageitems
                                        WHERE id = ?
                                        AND NOT EXISTS (
                                            SELECT 1 FROM market_place.prevdefineproduct 
                                            WHERE orderPackageId = ? AND replceId = ?
                                        )
                                    `;

                    connection.query(
                      insertPrevDefineProductSql,
                      [
                        replaceRequest.orderPackageId,
                        replaceRequest.replceId,
                        orderPackageItem.id,
                        replaceRequest.orderPackageId,
                        replaceRequest.replceId,
                      ],
                      (err, insertPrevDefineResult) => {
                        if (err) {
                          console.error("Insert prevdefineproduct error:", err);
                          return connection.rollback(() => {
                            connection.release();
                            reject(
                              new Error(
                                "Failed to insert into prevdefineproduct",
                              ),
                            );
                          });
                        }

                        const updateOrderPackageItemsSql = `
                                                UPDATE market_place.orderpackageitems 
                                                SET 
                                                    productId = ?,
                                                    qty = ?,
                                                    price = ?
                                                WHERE id = ?
                                            `;

                        connection.query(
                          updateOrderPackageItemsSql,
                          [newProductId, quantity, price, orderPackageItem.id],
                          (err, updateItemsResult) => {
                            if (err) {
                              console.error(
                                "Update order package items error:",
                                err,
                              );
                              return connection.rollback(() => {
                                connection.release();
                                reject(
                                  new Error(
                                    "Failed to update order package items",
                                  ),
                                );
                              });
                            }

                            const updateOrderPackageSql = `
                                                        UPDATE market_place.orderpackage 
                                                        SET isLock = 0
                                                        WHERE id = ?
                                                    `;

                            connection.query(
                              updateOrderPackageSql,
                              [replaceRequest.orderPackageId],
                              (err, updatePackageResult) => {
                                if (err) {
                                  console.error(
                                    "Update order package error:",
                                    err,
                                  );
                                  return connection.rollback(() => {
                                    connection.release();
                                    reject(
                                      new Error(
                                        "Failed to update order package",
                                      ),
                                    );
                                  });
                                }

                                connection.commit((err) => {
                                  if (err) {
                                    console.error(
                                      "Transaction commit error:",
                                      err,
                                    );
                                    return connection.rollback(() => {
                                      connection.release();
                                      reject(
                                        new Error(
                                          "Failed to commit transaction",
                                        ),
                                      );
                                    });
                                  }

                                  connection.release();

                                  resolve({
                                    success: true,
                                    message:
                                      "Replace request approved successfully",
                                    data: {
                                      replaceRequestId: replaceRequestId,
                                      replceId: replaceRequest.replceId,
                                      orderPackageId:
                                        replaceRequest.orderPackageId,
                                      oldProductId: orderPackageItem.productId,
                                      newProductId: newProductId,
                                      oldQuantity: orderPackageItem.qty,
                                      newQuantity: quantity,
                                      oldPrice: orderPackageItem.price,
                                      newPrice: price,
                                      updatedTables: [
                                        "replacerequest",
                                        "prevdefineproduct (inserted)",
                                        "orderpackageitems",
                                        "orderpackage",
                                      ],
                                    },
                                  });
                                });
                              },
                            );
                          },
                        );
                      },
                    );
                  },
                );
              },
            );
          },
        );
      });
    });
  });
};

exports.getDistributionOfficerTarget = (officerId) => {
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

          CAST(COALESCE(additional_item_counts.total_items, 0) AS UNSIGNED) AS totalAdditionalItems,
          CAST(COALESCE(additional_item_counts.packed_items, 0) AS UNSIGNED) AS packedAdditionalItems,
          CAST(COALESCE(additional_item_counts.pending_items, 0) AS UNSIGNED) AS pendingAdditionalItems,

          CASE 
              WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN NULL
              WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
              WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
                   COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
              WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
              ELSE NULL
          END AS additionalItemStatus,

          CAST(COALESCE(package_item_counts.total_items, 0) AS UNSIGNED) AS totalPackageItems,
          CAST(COALESCE(package_item_counts.packed_items, 0) AS UNSIGNED) AS packedPackageItems,
          CAST(COALESCE(package_item_counts.pending_items, 0) AS UNSIGNED) AS pendingPackageItems,
          CAST(COALESCE(package_item_counts.total_packages, 0) AS UNSIGNED) AS totalPackages,
          CAST(COALESCE(package_item_counts.locked_packages, 0) AS UNSIGNED) AS lockedPackages,
          CAST(COALESCE(package_item_counts.completed_packages, 0) AS UNSIGNED) AS completedPackages,
          CAST(COALESCE(package_item_counts.opened_packages, 0) AS UNSIGNED) AS openedPackages,
          CAST(COALESCE(package_item_counts.pending_packages, 0) AS UNSIGNED) AS pendingPackages,

          CASE 
              WHEN o.isPackage = 0 THEN NULL
              WHEN COALESCE(package_item_counts.total_packages, 0) = 0 THEN 'Pending'
              WHEN COALESCE(package_item_counts.completed_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Completed'
              WHEN COALESCE(package_item_counts.pending_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Pending'
              ELSE 'Opened'
          END AS packageItemStatus,

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
                              WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND
                                   COALESCE(package_item_counts.pending_packages, 0) = 0 THEN 'Opened'
                              ELSE 'Pending'
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
          WHERE COALESCE(op.isLock, 0) = 0
          GROUP BY op.orderId
      ) package_item_counts ON po.id = package_item_counts.orderId

      WHERE
          dt.userId = ?
          AND DATE(dt.createdAt) BETWEEN DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND CURDATE()
          AND NOT EXISTS (
              SELECT 1 
              FROM market_place.orderpackage op_check
              WHERE op_check.orderId = po.id 
              AND o.isPackage = 1
              HAVING COUNT(*) = SUM(CASE WHEN op_check.isLock = 1 THEN 1 ELSE 0 END)
          )

      ORDER BY 
          dt.companycenterId ASC,
          dt.userId DESC,
          dt.target ASC,
          dt.complete ASC,
          o.id ASC
    `;

    db.collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getAllDistributionOfficer = async (managerId) => {
  try {
    const managerQuery = `
      SELECT 
        id,
        centerId,
        distributedCenterId,
        companyId,
        irmId,
        firstNameEnglish,
        firstNameSinhala,
        firstNameTamil,
        lastNameEnglish,
        lastNameSinhala,
        lastNameTamil,
        jobRole,
        empId
      FROM collectionofficer 
      WHERE id = ?
    `;

    const officersQuery = `
      SELECT 
        id,
        centerId,
        distributedCenterId,
        companyId,
        irmId,
        firstNameEnglish,
        firstNameSinhala,
        firstNameTamil,
        lastNameEnglish,
        lastNameSinhala,
        lastNameTamil,
        jobRole,
        empId
      FROM collectionofficer 
      WHERE irmId = ? AND status = 'Approved'
    `;

    const [managerRows] = await db.collectionofficer
      .promise()
      .query(managerQuery, [managerId]);
    const [officerRows] = await db.collectionofficer
      .promise()
      .query(officersQuery, [managerId]);

    const allData = [];

    if (managerRows.length > 0) {
      allData.push(managerRows[0]);
    }

    allData.push(...officerRows);

    return allData;
  } catch (error) {
    console.error("Error in getAllDistributionOfficer DAO:", error);
    throw error;
  }
};

exports.targetPass = async (params) => {
  try {
    const {
      assigneeOfficerId,
      targetItems,
      invoiceNumbers,
      processOrderId,
      officerId,
    } = params;

    if (!officerId) {
      return { success: false, message: "officerId is required" };
    }

    if (!assigneeOfficerId) {
      return { success: false, message: "assigneeOfficerId is required" };
    }

    if (!Array.isArray(processOrderId) || processOrderId.length === 0) {
      return {
        success: false,
        message: "processOrderId must be a non-empty array",
      };
    }

    let sourceOfficerId;

    const sourceQuery = `
      SELECT id FROM collection_officer.collectionofficer
      WHERE empId = ?
      LIMIT 1
    `;
    const sourceResult = await db.collectionofficer
      .promise()
      .query(sourceQuery, [officerId]);

    if (!sourceResult[0] || sourceResult[0].length === 0) {
      return {
        success: false,
        message: `Source officer not found with empId: ${officerId}`,
      };
    }
    sourceOfficerId = parseInt(sourceResult[0][0].id);

    let targetOfficerId;

    if (
      typeof assigneeOfficerId === "number" ||
      !isNaN(parseInt(assigneeOfficerId))
    ) {
      targetOfficerId = parseInt(assigneeOfficerId);
    } else {
      const assigneeQuery = `
        SELECT id FROM collection_officer.collectionofficer
        WHERE empId = ?
        LIMIT 1
      `;
      const assigneeResult = await db.collectionofficer
        .promise()
        .query(assigneeQuery, [assigneeOfficerId]);

      if (!assigneeResult[0] || assigneeResult[0].length === 0) {
        return {
          success: false,
          message: `Assignee officer not found with code: ${assigneeOfficerId}`,
        };
      }
      targetOfficerId = parseInt(assigneeResult[0][0].id);
    }

    const targetFromOrderQuery = `
      SELECT dt.id, dt.userId, dt.target, dt.complete, dt.createdAt, dt.companycenterId
      FROM collection_officer.distributedtargetitems dti
      JOIN collection_officer.distributedtarget dt ON dti.targetId = dt.id
      WHERE dti.orderId = ?
      LIMIT 1
    `;
    const targetFromOrderResult = await db.collectionofficer
      .promise()
      .query(targetFromOrderQuery, [parseInt(processOrderId[0])]);

    const sourceRows = targetFromOrderResult[0];

    if (!sourceRows || sourceRows.length === 0) {
      return {
        success: false,
        message: `Could not find a target record for the selected orders.`,
      };
    }

    if (parseInt(sourceRows[0].userId) !== sourceOfficerId) {
      return {
        success: false,
        message: `These orders do not belong to officer ${officerId}. They belong to userId: ${sourceRows[0].userId}.`,
      };
    }

    const sourceTargetId = parseInt(sourceRows[0].id);
    const sourceTargetCount = sourceRows[0].target;
    const sourceComplete = sourceRows[0].complete;
    const sourceCreatedAt = sourceRows[0].createdAt;

    const assigneeTargetQuery = `
      SELECT id, userId, target, complete, createdAt
      FROM collection_officer.distributedtarget
      WHERE userId = ?
      AND DATE(createdAt) = CURDATE()
      ORDER BY id DESC
      LIMIT 1
    `;
    const assigneeTargetResult = await db.collectionofficer
      .promise()
      .query(assigneeTargetQuery, [targetOfficerId]);

    const assigneeRows = assigneeTargetResult[0];

    let assigneeTargetId;
    let assigneeTargetCount;

    if (!assigneeRows || assigneeRows.length === 0) {
      const getCompanyCenterQuery = `
        SELECT companycenterId
        FROM collection_officer.distributedtarget
        WHERE userId = ?
        ORDER BY id DESC
        LIMIT 1
      `;
      const companyCenterResult = await db.collectionofficer
        .promise()
        .query(getCompanyCenterQuery, [targetOfficerId]);

      let companycenterId;
      if (companyCenterResult[0] && companyCenterResult[0].length > 0) {
        companycenterId = companyCenterResult[0][0].companycenterId;
      } else {
        companycenterId = sourceRows[0].companycenterId || null;
      }

      const createTargetQuery = `
        INSERT INTO collection_officer.distributedtarget
        (companycenterId, userId, target, complete, createdAt)
        VALUES (?, ?, 0, 0, NOW())
      `;
      const createResult = await db.collectionofficer
        .promise()
        .query(createTargetQuery, [companycenterId, targetOfficerId]);

      assigneeTargetId = parseInt(createResult[0].insertId);
      assigneeTargetCount = 0;
    } else {
      assigneeTargetId = parseInt(assigneeRows[0].id);
      assigneeTargetCount = assigneeRows[0].target;
    }

    const transferCount = processOrderId.length;

    if (sourceTargetCount < transferCount) {
      return {
        success: false,
        message: `Source officer does not have enough targets. Has ${sourceTargetCount}, trying to transfer ${transferCount}.`,
      };
    }

    const newSourceTarget = sourceTargetCount - transferCount;
    const updateSourceQuery = `
      UPDATE collection_officer.distributedtarget
      SET target = ?
      WHERE id = ?
    `;
    await db.collectionofficer
      .promise()
      .query(updateSourceQuery, [newSourceTarget, sourceTargetId]);

    const newAssigneeTarget = assigneeTargetCount + transferCount;
    const updateAssigneeQuery = `
      UPDATE collection_officer.distributedtarget
      SET target = ?
      WHERE id = ?
    `;
    await db.collectionofficer
      .promise()
      .query(updateAssigneeQuery, [newAssigneeTarget, assigneeTargetId]);

    const results = [];
    const errors = [];

    for (const orderId of processOrderId) {
      try {
        const orderIdInt = parseInt(orderId);

        const checkOrderQuery = `
          SELECT id, targetId, orderId
          FROM collection_officer.distributedtargetitems
          WHERE orderId = ?
        `;
        const existingRecords = await db.collectionofficer
          .promise()
          .query(checkOrderQuery, [orderIdInt]);
        const existingRows = existingRecords[0];

        if (!existingRows || existingRows.length === 0) {
          errors.push(`No records found for order ID: ${orderIdInt}`);
          continue;
        }

        if (existingRows[0].targetId !== sourceTargetId) {
          errors.push(
            `Order ID ${orderIdInt} does not belong to source target (targetId mismatch: ${existingRows[0].targetId} vs ${sourceTargetId})`,
          );
          continue;
        }

        const updateItemsQuery = `
          UPDATE collection_officer.distributedtargetitems
          SET targetId = ?
          WHERE orderId = ?
        `;
        const updateResult = await db.collectionofficer
          .promise()
          .query(updateItemsQuery, [assigneeTargetId, orderIdInt]);

        if (updateResult[0].affectedRows === 0) {
          errors.push(`No records updated for order ID: ${orderIdInt}`);
          continue;
        }

        const updatedRecordsQuery = `
          SELECT id, targetId, orderId
          FROM collection_officer.distributedtargetitems
          WHERE orderId = ?
          ORDER BY id ASC
        `;
        const updatedRecords = await db.collectionofficer
          .promise()
          .query(updatedRecordsQuery, [orderIdInt]);

        results.push({
          orderId: orderIdInt,
          previousTargetId: sourceTargetId,
          newTargetId: assigneeTargetId,
          affectedRows: updateResult[0].affectedRows,
          updatedRecords: updatedRecords[0],
        });
      } catch (orderError) {
        console.error(`Error processing order ID ${orderId}:`, orderError);
        errors.push(
          `Failed to process order ID ${orderId}: ${orderError.message}`,
        );
      }
    }

    const response = {
      success: results.length > 0,
      message:
        results.length > 0
          ? "Target passed successfully"
          : "No targets were passed",
      data: {
        sourceOfficer: {
          officerId: officerId,
          targetId: sourceTargetId,
          previousTarget: sourceTargetCount,
          newTarget: newSourceTarget,
          reduced: transferCount,
        },
        assigneeOfficer: {
          officerId: assigneeOfficerId,
          targetId: assigneeTargetId,
          previousTarget: assigneeTargetCount,
          newTarget: newAssigneeTarget,
          increased: transferCount,
        },
        transferredOrders: {
          successful: results.length,
          total: processOrderId.length,
          failed: errors.length,
        },
        targetItems: targetItems,
        invoiceNumbers: invoiceNumbers,
        results: results,
      },
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.message += ` (${errors.length} error(s) occurred)`;
    }

    return response;
  } catch (error) {
    console.error("Error in targetPass DAO:", error);
    return {
      success: false,
      message: "Database operation failed",
      error: error.message,
    };
  }
};

exports.getOfficerDetails = async (empId) => {
  const sql = `
    SELECT 
      firstNameEnglish AS firstName, 
      lastNameEnglish AS lastName, 
      jobRole 
    FROM 
      collectionofficer
    WHERE 
      empId = ?;
  `;
  return db.collectionofficer.promise().query(sql, [empId]);
};

exports.getDistributionPaymentsSummary = async ({
  collectionOfficerId,
  fromDate,
  toDate,
}) => {
  const sql = `
    SELECT 
        DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30')) AS date,
        COUNT(dti.id) AS completedOrders,
        SUM(COALESCE(po.amount, 0)) AS totalAmount,
        MIN(po.invNo) AS invNo,
        po.orderId AS orderId,
        o.sheduleDate AS sheduleDate,
        o.sheduleTime AS sheduleTime
    FROM 
        collection_officer.distributedtarget dt
    JOIN 
        collection_officer.distributedtargetitems dti ON dt.id = dti.targetId
    JOIN 
        market_place.processorders po ON po.id = dti.orderId
    JOIN 
        market_place.orders o ON o.id = po.orderId
    WHERE 
        dt.userId = ?
        AND dti.isComplete = 1
        AND dti.completeTime IS NOT NULL
        AND DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30')) BETWEEN ? AND ?
    GROUP BY 
        DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30')),
        po.orderId,
        o.sheduleDate,
        o.sheduleTime
    ORDER BY 
        DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30'));
    `;
  return db.collectionofficer
    .promise()
    .query(sql, [collectionOfficerId, fromDate, toDate]);
};

exports.getOfficerSummaryDaoManager = async (collectionOfficerId) => {
  try {
    const query = `
      SELECT 
        COUNT(dti.id) AS totalTasks,
        SUM(CASE WHEN dti.isComplete = 1 THEN 1 ELSE 0 END) AS completedTasks,
        SUM(CASE WHEN dti.isComplete = 1 THEN 1 ELSE 0 END) AS totalComplete,
        COUNT(dti.id) AS totalTarget
      FROM distributedtarget dt
      INNER JOIN distributedtargetitems dti
        ON dti.targetId = dt.id
      INNER JOIN market_place.processorders po
        ON po.id = dti.orderId
      INNER JOIN market_place.orders o
        ON o.id = po.orderId
      WHERE
        dt.userId = ?
        AND DATE(dt.createdAt) BETWEEN DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND CURDATE()
        AND DATE(o.sheduleDate) = CURDATE()
    `;

    const [results] = await db.collectionofficer
      .promise()
      .query(query, [collectionOfficerId]);

    if (!results || results.length === 0 || results[0].totalTasks === null) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        totalComplete: 0,
        totalTarget: 0,
      };
    }

    return {
      totalTasks: parseInt(results[0].totalTasks) || 0,
      completedTasks: parseInt(results[0].completedTasks) || 0,
      totalComplete: parseInt(results[0].totalComplete) || 0,
      totalTarget: parseInt(results[0].totalTarget) || 0,
    };
  } catch (error) {
    console.error("Database error in getOfficerSummaryDao:", error);
    throw new Error(`Database operation failed: ${error.message}`);
  }
};

exports.getOrderById = async (orderId) => {
  let connection;

  try {
    connection = await db.marketPlace.promise().getConnection();

    const orderSql = `
      SELECT
          o.id AS orderId,
          o.userId,
          o.orderApp,
          o.sheduleType,
          o.sheduleDate,
          o.sheduleTime,
          o.createdAt,
          o.total,
          o.buildingType AS orderBuildingType,
          o.discount,
          o.fullTotal,
          o.isPackage AS orderIsPackage,
          o.isCoupon,
          o.couponValue,
          o.couponType,
          o.delivaryMethod,
          o.centerId,
          o.title,
          o.fullName,
          o.phonecode1,
          o.phone1,
          o.phonecode2,
          o.phone2,
          o.buildingType AS userBuildingType,
          c.email
      FROM orders o
      JOIN marketplaceusers c ON o.userId = c.id
      WHERE o.id = ?
    `;

    const [orderResults] = await connection.execute(orderSql, [orderId]);

    if (orderResults.length === 0) {
      return { message: "No order found with the given ID" };
    }

    const order = orderResults[0];

    let finalIsPackage = 0;
    let processOrderId = null;
    let invoiceNumber = null;
    let orderStatus = null;
    let reportStatus = null;
    let paymentMethod = null;

    if (order.orderApp === "Marketplace") {
      finalIsPackage = order.orderIsPackage || 0;

      const processOrderSql = `
        SELECT 
            id AS processOrderId,
            invNo AS invoiceNumber,
            status,
            paymentMethod,
            reportStatus
        FROM processorders 
        WHERE orderId = ?
      `;

      const [processOrderResults] = await connection.execute(processOrderSql, [
        orderId,
      ]);

      if (processOrderResults.length > 0) {
        const processOrder = processOrderResults[0];
        processOrderId = processOrder.processOrderId;
        invoiceNumber = processOrder.invoiceNumber;
        orderStatus = processOrder.status;
        paymentMethod = processOrder.paymentMethod;
        reportStatus = processOrder.reportStatus;
      }
    } else if (order.orderApp === "Dash") {
      const processOrderSql = `
        SELECT 
            id AS processOrderId,
            invNo AS invoiceNumber,
            status,
            paymentMethod,
            reportStatus
        FROM processorders 
        WHERE orderId = ?
      `;

      const [processOrderResults] = await connection.execute(processOrderSql, [
        orderId,
      ]);

      if (processOrderResults.length > 0) {
        const processOrder = processOrderResults[0];
        processOrderId = processOrder.processOrderId;
        invoiceNumber = processOrder.invoiceNumber;
        orderStatus = processOrder.status;
        paymentMethod = processOrder.paymentMethod;
        reportStatus = processOrder.reportStatus;

        const packageCheckSql = `
          SELECT COUNT(*) as packageCount
          FROM orderpackage 
          WHERE orderId = ?
        `;

        const [packageCheckResults] = await connection.execute(
          packageCheckSql,
          [processOrderId],
        );

        if (packageCheckResults[0].packageCount > 0) {
          finalIsPackage = 1;
        } else {
          finalIsPackage = 0;
        }
      }
    }

    const buildingType = order.orderBuildingType || order.userBuildingType;

    let formattedAddress = "";
    let apartmentAddress = null;

    if (buildingType === "House") {
      const addressSql = `
        SELECT
            houseNo,
            streetName,
            city
        FROM orderhouse
        WHERE orderId = ?
      `;

      const [addressResults] = await connection.execute(addressSql, [orderId]);

      if (addressResults[0]) {
        const addr = addressResults[0];
        formattedAddress =
          `${addr.houseNo || ""}, ${addr.streetName || ""}, ${addr.city || ""}`.trim();

        formattedAddress = formattedAddress
          .replace(/^,\s*/, "")
          .replace(/,\s*$/, "")
          .replace(/,\s*,/g, ",")
          .replace(/\s+/g, " ")
          .trim();
      } else {
        console.log("No house address found for orderId:", orderId);
      }
    } else if (buildingType === "Apartment") {
      const addressSql = `
        SELECT
            buildingNo,
            buildingName,
            unitNo,
            floorNo,
            houseNo,
            streetName,
            city
        FROM orderapartment
        WHERE orderId = ?
      `;

      const [addressResults] = await connection.execute(addressSql, [orderId]);

      if (addressResults[0]) {
        const addr = addressResults[0];

        apartmentAddress = {
          buildingNo: addr.buildingNo || null,
          buildingName: addr.buildingName || null,
          unitNo: addr.unitNo || null,
          floorNo: addr.floorNo || null,
          houseNo: addr.houseNo || null,
          streetName: addr.streetName || null,
          city: addr.city || null,
        };

        const addressParts = [];
        if (addr.buildingName) addressParts.push(addr.buildingName);
        if (addr.buildingNo) addressParts.push(addr.buildingNo);
        if (addr.unitNo) addressParts.push(`Unit ${addr.unitNo}`);
        if (addr.floorNo) addressParts.push(`Floor ${addr.floorNo}`);
        if (addr.houseNo) addressParts.push(addr.houseNo);
        if (addr.streetName) addressParts.push(addr.streetName);
        if (addr.city) addressParts.push(addr.city);
        formattedAddress = addressParts.join(", ");
      } else {
        console.log("No apartment address found for orderId:", orderId);
      }
    } else {
      console.log("Unknown building type:", buildingType);
    }

    let centerDetails = null;

    if (order.delivaryMethod === "Pickup" && order.centerId) {
      const centerSql = `
        SELECT
            centerName,
            city        AS centerCity,
            district    AS centerDistrict,
            province    AS centerProvince,
            country     AS centerCountry
        FROM collection_officer.distributedcenter
        WHERE id = ?
      `;

      let centerConnection;
      try {
        centerConnection = await db.collectionofficer.promise().getConnection();
        const [centerResults] = await centerConnection.execute(centerSql, [
          order.centerId,
        ]);

        if (centerResults.length > 0) {
          centerDetails = centerResults[0];
        } else {
          console.log("No center found for centerId:", order.centerId);
        }
      } catch (centerErr) {
        console.error("Failed to fetch center details:", centerErr);
      } finally {
        if (centerConnection) centerConnection.release();
      }
    }

    const additionalItemsSql = `
      SELECT
          oai.qty,
          oai.productId,
          oai.unit,
          oai.price,
          oai.discount AS itemDiscount
      FROM orderadditionalitems oai
      WHERE oai.orderId = ?
    `;

    const [additionalItemsResults] = await connection.execute(
      additionalItemsSql,
      [orderId],
    );

    const additionalItems = additionalItemsResults
      .filter((item) => item.productId !== null && item.productId !== undefined)
      .map((item) => ({
        productId: item.productId,
        qty: parseFloat(item.qty) || 0,
        unit: item.unit || "",
        price: parseFloat(item.price) || 0,
        discount: parseFloat(item.itemDiscount) || 0,
      }));

    let allPackages = [];

    if (finalIsPackage === 1 && processOrderId) {
      const packagesSql = `
        SELECT
            op.id AS orderPackageId,
            op.packageId,
            op.qty,
            mpp.displayName AS packageDisplayName,
            mpp.productPrice AS packagePrice,
            mpp.packingFee AS packagePackingFee,
            mpp.serviceFee AS packageServiceFee,
            mpp.status AS packageStatus,
            op.packingStatus,
            op.isLock,
            op.createdAt AS packageCreatedAt
        FROM orderpackage op
        LEFT JOIN marketplacepackages mpp ON mpp.id = op.packageId
        WHERE op.orderId = ?
        ORDER BY op.id ASC
      `;

      const [packagesResults] = await connection.execute(packagesSql, [
        processOrderId,
      ]);

      for (const packageData of packagesResults) {
        const packageItemsSql = `
          SELECT
              opi.id,
              opi.orderPackageId,
              opi.productType,
              opi.productId,
              opi.qty,
              opi.price,
              opi.isPacked,
              pt.typeName AS productTypeName,
              mi.displayName AS productDisplayName,
              mi.varietyId,
              mi.category,
              mi.normalPrice,
              mi.discountedPrice
          FROM orderpackageitems opi
          JOIN producttypes pt ON pt.id = opi.productType
          LEFT JOIN marketplaceitems mi ON mi.id = opi.productId
          WHERE opi.orderPackageId = ?
          ORDER BY opi.id ASC
        `;

        const [packageItemsResults] = await connection.execute(
          packageItemsSql,
          [packageData.orderPackageId],
        );

        const packageItems = packageItemsResults.map((item) => ({
          id: item.id,
          orderPackageId: item.orderPackageId,
          productType: item.productType,
          productTypeName: item.productTypeName,
          productId: item.productId,
          productDisplayName: item.productDisplayName || "N/A",
          varietyId: item.varietyId,
          category: item.category,
          normalPrice: item.normalPrice,
          discountedPrice: item.discountedPrice,
          qty: parseFloat(item.qty) || 0,
          price: parseFloat(item.price) || 0,
          isPacked: item.isPacked,
        }));

        const packageInfo = {
          packageId: packageData.packageId,
          orderPackageId: packageData.orderPackageId,
          qty: parseInt(packageData.qty) || 1,
          displayName: packageData.packageDisplayName,
          productPrice: parseFloat(packageData.packagePrice) || 0,
          packingFee: parseFloat(packageData.packagePackingFee) || 0,
          serviceFee: parseFloat(packageData.packageServiceFee) || 0,
          status: packageData.packageStatus,
          packingStatus: packageData.packingStatus,
          isLock: packageData.isLock,
          packageCreatedAt: packageData.packageCreatedAt,
          packageItems: packageItems,
        };

        allPackages.push(packageInfo);
      }

      const expandedPackages = [];
      for (const pkg of allPackages) {
        const qty = parseInt(pkg.qty) || 1;
        for (let i = 0; i < qty; i++) {
          expandedPackages.push({ ...pkg });
        }
      }
      allPackages = expandedPackages;
    }

    let enhancedAdditionalItems = [];
    if (additionalItems.length > 0) {
      const productIds = additionalItems.map((item) => item.productId);
      const placeholders = productIds.map(() => "?").join(",");

      const productDetailsSql = `
        SELECT
            mi.id,
            mi.displayName,
            mi.varietyId,
            mi.category,
            mi.normalPrice,
            mi.discountedPrice
        FROM marketplaceitems mi
        WHERE mi.id IN (${placeholders})
      `;

      const [productResults] = await connection.execute(
        productDetailsSql,
        productIds,
      );

      enhancedAdditionalItems = additionalItems.map((item) => {
        const productDetail = productResults.find(
          (p) => p.id === item.productId,
        );
        return {
          ...item,
          displayName: productDetail
            ? productDetail.displayName
            : "Unknown Product",
          varietyId: productDetail ? productDetail.varietyId : null,
          category: productDetail ? productDetail.category : null,
          normalPrice: productDetail ? productDetail.normalPrice : null,
          discountedPrice: productDetail ? productDetail.discountedPrice : null,
        };
      });
    }

    const result = {
      orderId: order.orderId,
      userId: order.userId,
      orderApp: order.orderApp,
      scheduleType: order.sheduleType,
      scheduleDate: order.sheduleDate,
      scheduleTime: order.sheduleTime,
      createdAt: order.createdAt,
      total: parseFloat(order.total) || 0,
      discount: parseFloat(order.discount) || 0,
      fullTotal: parseFloat(order.fullTotal) || 0,
      isPackage: finalIsPackage,
      isCoupon: order.isCoupon,
      couponType: order.couponType || null,
      couponValue:
        order.orderApp === "Marketplace"
          ? parseFloat(order.couponValue) || 0
          : null,
      delivaryMethod: order.delivaryMethod || "Delivery",
      centerName: centerDetails?.centerName || null,
      centerCity: centerDetails?.centerCity || null,
      centerDistrict: centerDetails?.centerDistrict || null,
      centerProvince: centerDetails?.centerProvince || null,
      centerCountry: centerDetails?.centerCountry || null,
      customerInfo: {
        title: order.title || null,
        fullName: order.fullName || null,
        phoneCode1: order.phonecode1 || null,
        phone1: order.phone1 || null,
        phoneCode2: order.phonecode2 || null,
        phone2: order.phone2 || null,
        buildingType: buildingType,
        email: order.email,
      },
      fullAddress: formattedAddress,
      apartmentAddress: apartmentAddress,
      orderStatus: {
        processOrderId: processOrderId,
        invoiceNumber: invoiceNumber,
        status: orderStatus,
        paymentMethod: paymentMethod,
        reportStatus: reportStatus,
      },
      additionalItems: enhancedAdditionalItems,
      packages: allPackages,
    };

    return result;
  } catch (err) {
    console.error("Database error:", err);
    throw err;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.getDataCustomerId = async (customerId) => {
  let connection;

  try {
    connection = await db.marketPlace.promise().getConnection();

    const customerSql = `
            SELECT 
                id,
                cusId,
                salesAgent,
                title,
                firstName,
                lastName,
                phoneCode,
                phoneNumber,
                email,
                buildingType
            FROM marketplaceusers
            WHERE id = ?
        `;

    const [customerResults] = await connection.execute(customerSql, [
      customerId,
    ]);

    if (customerResults.length === 0) {
      return { message: "No customer found with this ID" };
    }

    const customer = customerResults[0];

    if (customer.phoneCode && customer.phoneNumber) {
      customer.phoneNumber = `${customer.phoneCode}${customer.phoneNumber}`;
    } else if (customer.phoneNumber && !customer.phoneCode) {
      customer.phoneNumber = customer.phoneNumber;
    } else if (customer.phoneCode && !customer.phoneNumber) {
      customer.phoneNumber = `${customer.phoneCode}`;
    } else {
      customer.phoneNumber = "";
    }

    delete customer.phoneCode;

    const buildingType = customer.buildingType.toLowerCase();

    const buildingSql = `
            SELECT * FROM ${buildingType}
            WHERE customerId = ?
        `;

    const [buildingResults] = await connection.execute(buildingSql, [
      customerId,
    ]);

    const result = {
      ...customer,
      buildingDetails: buildingResults.length > 0 ? buildingResults[0] : null,
    };

    return result;
  } catch (err) {
    console.error("Database error:", err);
    throw err;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.getAllCity = async () => {
  return new Promise((resolve, reject) => {
    const query = `
        SELECT id, city, charge,   createdAt
        FROM deliverycharge
      
        ORDER BY city ASC
        `;

    db.collectionofficer.query(query, (error, results) => {
      if (error) {
        console.error("Error fetching packages:", error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};

exports.getOrderMarketplaceOrdash = async (orderId) => {
  let connection;
  try {
    connection = await db.marketPlace.promise().getConnection();

    const [orderRows] = await connection.execute(
      "SELECT * FROM orders WHERE id = ?",
      [orderId],
    );

    if (orderRows.length === 0) {
      return {
        error: true,
        message: "Order not found",
      };
    }

    const order = orderRows[0];

    let orderResponse = {
      ...order,
      couponValue: null,
      isPackage: 0,
    };

    if (order.orderApp === "Marketplace") {
      orderResponse.couponValue = order.couponValue || null;
    } else if (order.orderApp === "Dash") {
      const [processOrderRows] = await connection.execute(
        "SELECT id FROM processorders WHERE orderId = ?",
        [orderId],
      );

      if (processOrderRows.length > 0) {
        const processOrderId = processOrderRows[0].id;

        const [packageRows] = await connection.execute(
          "SELECT COUNT(*) as packageCount FROM orderpackage WHERE orderId = ?",
          [processOrderId],
        );

        const packageCount = packageRows[0].packageCount;
        orderResponse.isPackage = packageCount > 0 ? 1 : 0;
      } else {
        orderResponse.isPackage = 0;
      }
    }

    return orderResponse;
  } catch (error) {
    console.error("Database error in getOrderMarketplaceOrdash:", error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

exports.getClaimOfficer = (empID, jobRole, OfficercompanyId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        c.*, 
        comp.companyNameEnglish,
        comp.companyNameSinhala,
        comp.companyNameTamil
      FROM 
        collectionofficer c 
      INNER JOIN 
        company comp 
      ON 
        c.companyId = comp.id 
      WHERE 
        c.empId = ? 
        AND c.jobRole = ? 
        AND c.centerId IS NULL 
        AND c.claimStatus = 0
        AND c.companyId = ?
    `;

    db.collectionofficer.query(
      sql,
      [empID, jobRole, OfficercompanyId],
      (err, results) => {
        if (err) {
          return reject(err);
        }

        resolve(results);
      },
    );
  });
};

exports.getAllRetailItems = (orderId, productTypeId) => {
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

    db.marketPlace.query(query, params, (error, results) => {
      if (error) {
        console.error(
          "Error fetching retail marketplace items (distribution-manager):",
          error,
        );
        return reject(error);
      }
      const retailOnly = results.filter((item) => item.category === "Retail");
      resolve(retailOnly);
    });
  });
};


