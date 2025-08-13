const db = require("../startup/database");





exports.getTargetForOfficerDao = (officerId) => {
    console.log("Getting targets for officer ID:", officerId);

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

                -- Package item counts (only for packages)
                COALESCE(package_item_counts.total_items, 0) AS totalPackageItems,
                COALESCE(package_item_counts.packed_items, 0) AS packedPackageItems,
                COALESCE(package_item_counts.pending_items, 0) AS pendingPackageItems,

                -- Package details
                package_item_counts.isLock AS packageIsLock,
                package_item_counts.packingStatus AS packagePackingStatus,
                package_item_counts.packageId AS packageId,

                -- Package item status
                CASE 
                    WHEN o.isPackage = 0 THEN NULL
                    WHEN COALESCE(package_item_counts.total_items, 0) = 0 THEN 'Pending'
                    WHEN COALESCE(package_item_counts.packed_items, 0) = 0 THEN 'Pending'
                    WHEN COALESCE(package_item_counts.packed_items, 0) > 0 AND 
                         COALESCE(package_item_counts.packed_items, 0) < COALESCE(package_item_counts.total_items, 0) THEN 'Opened'
                    WHEN COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
                    ELSE NULL
                END AS packageItemStatus,

                -- Overall status - FIXED to require BOTH additional and package items to be completed when they exist
                CASE 
                    -- For non-package orders (only check additional items)
                    WHEN o.isPackage = 0 THEN
                        CASE 
                            WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN 'Pending'
                            WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
                            WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
                                 COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
                            WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
                            ELSE 'Pending'
                        END
                    
                    -- For package orders (check both additional and package items)
                    WHEN o.isPackage = 1 THEN
                        CASE 
                            -- When both additional and package items exist
                            WHEN COALESCE(additional_item_counts.total_items, 0) > 0 AND 
                                 COALESCE(package_item_counts.total_items, 0) > 0 THEN
                                CASE 
                                    WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) AND
                                         COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
                                    WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 OR 
                                         COALESCE(package_item_counts.packed_items, 0) > 0 THEN 'Opened'
                                    ELSE 'Pending'
                                END
                            
                            -- When only additional items exist
                            WHEN COALESCE(additional_item_counts.total_items, 0) > 0 THEN
                                CASE 
                                    WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
                                    WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
                                         COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
                                    WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
                                    ELSE 'Pending'
                                END
                            
                            -- When only package items exist
                            WHEN COALESCE(package_item_counts.total_items, 0) > 0 THEN
                                CASE 
                                    WHEN COALESCE(package_item_counts.packed_items, 0) = 0 THEN 'Pending'
                                    WHEN COALESCE(package_item_counts.packed_items, 0) > 0 AND 
                                         COALESCE(package_item_counts.packed_items, 0) < COALESCE(package_item_counts.total_items, 0) THEN 'Opened'
                                    WHEN COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
                                    ELSE 'Pending'
                                END
                            
                            -- When no items exist (shouldn't happen for package orders)
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
                -- Additional items subquery
                SELECT 
                    orderId,
                    COUNT(*) as total_items,
                    SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
                    SUM(CASE WHEN isPacked = 0 THEN 1 ELSE 0 END) as pending_items
                FROM 
                    market_place.orderadditionalitems
                GROUP BY 
                    orderId
            ) additional_item_counts ON o.id = additional_item_counts.orderId
            LEFT JOIN (
                -- Package items subquery - correctly joined to processorders.id
                SELECT 
                    op.orderId,  -- This references processorders.id
                    op.isLock,
                    op.packingStatus,
                    op.packageId,
                    COUNT(opi.id) as total_items,
                    SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
                    SUM(CASE WHEN opi.isPacked = 0 THEN 1 ELSE 0 END) as pending_items
                FROM 
                    market_place.orderpackage op
                LEFT JOIN 
                    market_place.orderpackageitems opi ON op.id = opi.orderPackageId
                GROUP BY 
                    op.orderId, op.isLock, op.packingStatus, op.packageId
            ) package_item_counts ON po.id = package_item_counts.orderId  -- Correct join to processorders
            WHERE 
                dt.userId = ?
                AND DATE(dt.createdAt) = CURDATE()
            ORDER BY 
                dt.companycenterId ASC,
                dt.userId DESC,
                dt.target ASC,
                dt.complete ASC,
                o.id ASC
        `;

        // Execute the query
        db.collectionofficer.query(sql, [officerId], (err, results) => {
            if (err) {
                console.error("Error executing query:", err);
                return reject(err);
            }

            console.log("Targets found:", results.length);
            if (results.length > 0) {
                console.log("=== DEBUGGING DATA ===");

                // Log first 3 records for debugging
                results.slice(0, 3).forEach((row, index) => {
                    console.log(`Record ${index + 1}:`, {
                        distributedTargetId: row.distributedTargetId,
                        processOrderId: row.processOrderId,
                        orderId: row.orderId,
                        isPackage: row.isPackage,
                        packageData: {
                            packageId: row.packageId,
                            isLock: row.packageIsLock,
                            items: {
                                total: row.totalPackageItems,
                                packed: row.packedPackageItems,
                                pending: row.pendingPackageItems,
                                status: row.packageItemStatus
                            }
                        },
                        additionalItems: {
                            total: row.totalAdditionalItems,
                            packed: row.packedAdditionalItems,
                            pending: row.pendingAdditionalItems,
                            status: row.additionalItemStatus
                        },
                        overallStatus: row.selectedStatus
                    });
                });

                // Status summary
                const statusCounts = results.reduce((acc, row) => {
                    acc[row.selectedStatus] = (acc[row.selectedStatus] || 0) + 1;
                    return acc;
                }, {});
                console.log("Status Distribution:", statusCounts);

                console.log("=== END DEBUGGING ===");
            }

            resolve(results);
        });
    });
};

//////////////////////////////////////////////////////////////////




//////////////////////////////

// Corrected version with proper table relationships
// orders -> processorders -> orderpackage -> orderpackageitems

exports.getOrderDataDao = (orderId) => {
    console.log("Getting order data for order ID:", orderId);

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

                -- Package Details (linked through processorders)
                op.id AS orderPackageId,
                op.packageId,
                op.packingStatus,
                op.createdAt AS packageCreatedAt,

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
                opi.qty AS packageQty,
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
            
            -- Join to get process order (required for package orders)
            LEFT JOIN 
                market_place.processorders po ON o.id = po.orderId
            
            -- Left join for additional items (all orders have these)
            LEFT JOIN 
                market_place.orderadditionalitems oai ON o.id = oai.orderId
            LEFT JOIN 
                market_place.marketplaceitems mi_additional ON oai.productId = mi_additional.id

            -- Left join for package data (through processorders)
            LEFT JOIN 
                market_place.orderpackage op ON po.id = op.orderId
            
            -- Left join for package information
            LEFT JOIN 
                market_place.marketplacepackages mp ON op.packageId = mp.id
            
            -- Left join for package items
            LEFT JOIN 
                market_place.orderpackageitems opi ON op.id = opi.orderPackageId
            LEFT JOIN 
                market_place.marketplaceitems mi_package ON opi.productId = mi_package.id

            -- Left join for product types
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

        // Execute the query
        db.collectionofficer.query(sql, [orderId], (err, results) => {
            if (err) {
                console.error("Error executing query:", err);
                return reject(err);
            }

            console.log("Raw results found:", results.length);

            if (results.length === 0) {
                return resolve({
                    orderInfo: null,
                    additionalItems: [],
                    packageData: null,
                    warnings: []
                });
            }

            // Process the results
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
                processOrderId: results[0].processOrderId
            };

            const additionalItemsMap = new Map();
            const packageItemsMap = new Map();
            let packageInfo = null;
            const warnings = [];

            results.forEach(row => {
                // Process additional items
                if (row.additionalItemId && !additionalItemsMap.has(row.additionalItemId)) {
                    additionalItemsMap.set(row.additionalItemId, {
                        id: row.additionalItemId,
                        productId: row.additionalProductId,
                        qty: row.additionalQty,
                        unit: row.additionalUnit,
                        price: row.additionalPrice,
                        discount: row.additionalDiscount,
                        isPacked: row.additionalIsPacked,
                        productName: row.additionalProductName,
                        category: row.additionalProductCategory,
                        normalPrice: row.additionalNormalPrice
                    });
                }

                // Process package data (only if we have processOrder and orderPackage)
                if (orderInfo.isPackage === 1 && orderInfo.processOrderId && row.orderPackageId) {
                    if (!packageInfo) {
                        packageInfo = {
                            id: row.orderPackageId,
                            packageId: row.packageId,
                            packingStatus: row.packingStatus,
                            createdAt: row.packageCreatedAt,
                            packageName: row.packageName,
                            packageDescription: row.packageDescription,
                            packageStatus: row.packageStatus,
                            packagePrice: row.packagePrice,
                            packagePackingFee: row.packagePackingFee,
                            items: []
                        };
                    }

                    // Process package items
                    if (row.packageItemId && !packageItemsMap.has(row.packageItemId)) {
                        packageItemsMap.set(row.packageItemId, {
                            id: row.packageItemId,
                            productType: row.packageProductType,
                            productId: row.packageProductId,
                            qty: row.packageQty,
                            price: row.packageItemPrice,
                            isPacked: row.packageIsPacked,
                            productName: row.packageProductName,
                            category: row.packageProductCategory,
                            normalPrice: row.packageNormalPrice,
                            productTypeId: row.productTypeId,
                            productTypeName: row.productTypeName
                        });
                    }
                }
            });

            // Data validation and warnings
            if (orderInfo.isPackage === 1 && !orderInfo.processOrderId) {
                warnings.push({
                    type: 'MISSING_PROCESS_ORDER',
                    message: `Order ${orderId} is marked as package but missing processorders record`
                });
            }

            if (orderInfo.isPackage === 1 && orderInfo.processOrderId && !packageInfo) {
                warnings.push({
                    type: 'MISSING_PACKAGE_RECORD',
                    message: `Order ${orderId} has processorder but missing orderpackage record`
                });
            }

            // Convert maps to arrays
            const additionalItems = Array.from(additionalItemsMap.values());
            const packageItems = Array.from(packageItemsMap.values());

            // Add package items to package info
            if (packageInfo && packageItems.length > 0) {
                packageInfo.items = packageItems;
            }

            const structuredData = {
                orderInfo: orderInfo,
                additionalItems: additionalItems,
                packageData: packageInfo,
                warnings: warnings,
                meta: {
                    hasDataInconsistency: warnings.length > 0,
                    hasProcessOrder: !!orderInfo.processOrderId,
                    hasPackageData: !!packageInfo
                }
            };

            console.log("Structured order data:", {
                orderId: orderInfo.orderId,
                isPackage: orderInfo.isPackage,
                hasProcessOrder: !!orderInfo.processOrderId,
                additionalItemsCount: additionalItems.length,
                packageItemsCount: packageItems.length,
                hasPackageData: !!packageInfo,
                packageName: packageInfo ? packageInfo.packageName : null,
                warningsCount: warnings.length
            });

            resolve(structuredData);
        });
    });
};

// Function to check and fix missing process orders
exports.validateOrderStructure = async (orderId) => {
    console.log("Validating order structure for order ID:", orderId);

    try {
        // Check if order exists and needs processorder
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

        // If it's a package order but missing processorder, create it
        if (order.isPackage === 1 && !order.processOrderId) {
            const createProcessOrderSql = `
                INSERT INTO market_place.processorders (orderId, createdAt)
                VALUES (?, NOW())
            `;

            await new Promise((resolve, reject) => {
                db.collectionofficer.query(createProcessOrderSql, [orderId], (err, result) => {
                    if (err) return reject(err);
                    fixes.push({
                        type: 'CREATED_PROCESS_ORDER',
                        message: `Created processorders record for order ${orderId}`,
                        processOrderId: result.insertId
                    });
                    resolve(result);
                });
            });
        }

        return {
            orderId: orderId,
            fixes: fixes,
            fixesApplied: fixes.length > 0
        };

    } catch (error) {
        console.error("Error in validateOrderStructure:", error);
        throw error;
    }
};

// Debug function to check table relationships
exports.debugOrderRelationships = async (orderId) => {
    console.log("Debugging order relationships for order ID:", orderId);

    const queries = [
        {
            name: 'orders',
            sql: 'SELECT * FROM market_place.orders WHERE id = ?'
        },
        {
            name: 'processorders',
            sql: 'SELECT * FROM market_place.processorders WHERE orderId = ?'
        },
        {
            name: 'orderpackage',
            sql: `SELECT op.* FROM market_place.orderpackage op 
                  JOIN market_place.processorders po ON op.orderId = po.id 
                  WHERE po.orderId = ?`
        },
        {
            name: 'orderadditionalitems',
            sql: 'SELECT * FROM market_place.orderadditionalitems WHERE orderId = ?'
        }
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

// Update package items - MySQL2 compatible version
// Update package items
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
            const updatePromises = items.map(item => {
                return new Promise((resolveItem, rejectItem) => {
                    db.collectionofficer.query(sql, [item.isPacked, item.id], (err, result) => {
                        if (err) {
                            console.error(`Error updating package item ${item.id}:`, err);
                            return rejectItem(err);
                        }
                        resolveItem(result);
                    });
                });
            });

            const results = await Promise.all(updatePromises);
            console.log(`Updated ${results.length} package items`);
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
            const updatePromises = items.map(item => {
                return new Promise((resolveItem, rejectItem) => {
                    db.collectionofficer.query(sql, [item.isPacked, item.id], (err, result) => {
                        if (err) {
                            console.error(`Error updating additional item ${item.id}:`, err);
                            return rejectItem(err);
                        }
                        resolveItem(result);
                    });
                });
            });

            const results = await Promise.all(updatePromises);
            console.log(`Updated ${results.length} additional items`);
            resolve(results);
        } catch (error) {
            console.error("Error updating additional items:", error);
            reject(error);
        }
    });
};


exports.updateDistributedTargetComplete = (frontendOrderId) => {
    return new Promise((resolve, reject) => {
        // First, get the processorders.id using the frontend orderId
        const getProcessOrderIdSql = `
            SELECT id FROM market_place.processorders 
            WHERE orderId = ?
        `;

        db.collectionofficer.query(getProcessOrderIdSql, [frontendOrderId], (err, processOrderResult) => {
            if (err) {
                console.error(`Error getting process order ID for orderId ${frontendOrderId}:`, err);
                return reject(err);
            }

            if (processOrderResult.length === 0) {
                console.warn(`No process order found for orderId ${frontendOrderId}`);
                return resolve({ affectedRows: 0 });
            }

            const processOrderId = processOrderResult[0].id;
            console.log(`Found process order ID ${processOrderId} for frontend orderId ${frontendOrderId}`);

            // Now update the distributedtargetitems using the processOrderId
            const updateSql = `
                UPDATE collection_officer.distributedtargetitems 
                SET isComplete = 1, completeTime = NOW()
                WHERE orderId = ?
            `;

            db.collectionofficer.query(updateSql, [processOrderId], (updateErr, updateResult) => {
                if (updateErr) {
                    console.error(`Error updating distributed target items for process order ID ${processOrderId}:`, updateErr);
                    return reject(updateErr);
                }

                if (updateResult.affectedRows === 0) {
                    console.warn(`No distributed target items found for process order ID ${processOrderId}`);
                } else {
                    console.log(`Updated ${updateResult.affectedRows} distributed target items for process order ID ${processOrderId} (frontend orderId: ${frontendOrderId})`);
                }

                resolve(updateResult);
            });
        });
    });
};

////get markte place itemssss
// exports.getAllRetailItems = async () => {
//     return new Promise((resolve, reject) => {
//         const query = `
//             SELECT 
//                 id,
//                 varietyId,
//                 displayName,
//                 category,
//                 normalPrice,
//                 discountedPrice,
//                 discount,
//                 promo,
//                 unitType,
//                 startValue,
//                 changeby,
//                 displayType,
//                 LEFT(tags, 256) as tags,
//                 createdAt,
//                 maxQuantity
//             FROM market_place.marketplaceitems 
//             WHERE category = ?
//             ORDER BY changeby DESC, varietyId ASC
//             LIMIT 1000
//         `;

//         db.admin.query(query, ['Retail'], (error, results) => {
//             if (error) {
//                 console.error("Error fetching retail marketplace items:", error);
//                 reject(error);
//             } else {
//                 resolve(results);
//                 console.log("Fetched", results.length, "retail items");
//             }
//         });
//     });
// };



// Route handler


// DAO function
exports.getAllRetailItems = async (orderId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                mi.id,
                mi.varietyId,
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
                mi.maxQuantity
            FROM market_place.marketplaceitems mi
            WHERE mi.category = 'Retail'
            AND mi.id NOT IN (
                SELECT DISTINCT el.mpItemId 
                FROM market_place.excludelist el
                INNER JOIN market_place.orders o ON el.userId = o.userId
                INNER JOIN market_place.processorders po ON o.id = po.orderId
                WHERE po.orderId = ?
            )
            ORDER BY mi.changeby DESC, mi.varietyId ASC
            LIMIT 1000
        `;

        db.admin.query(query, [orderId], (error, results) => {
            if (error) {
                console.error("Error fetching retail marketplace items:", error);
                reject(error);
            } else {
                resolve(results);
                console.log("Fetched", results.length, "retail items for order", orderId);
            }
        });
    });
};

////////////replace modal data upa=date 

// exports.createReplaceRequestDao = (replaceData) => {
//     console.log("Creating replace request with data:", replaceData);

//     return new Promise((resolve, reject) => {
//         // Get a connection from the pool
//         db.collectionofficer.getConnection((err, connection) => {
//             if (err) {
//                 console.error("Error getting connection from pool:", err);
//                 return reject(err);
//             }

//             // Start transaction on the connection
//             connection.beginTransaction((err) => {
//                 if (err) {
//                     console.error("Error starting transaction:", err);
//                     connection.release(); // Always release connection back to pool
//                     return reject(err);
//                 }

//                 // First, check if the record exists
//                 const checkSql = "SELECT id, isLock FROM market_place.orderpackage WHERE id = ?";
//                 console.log("Checking if record exists with ID:", replaceData.orderPackageId);

//                 connection.query(checkSql, [replaceData.orderPackageId], (err, checkResult) => {
//                     if (err) {
//                         console.error("Error checking record existence:", err);
//                         return connection.rollback(() => {
//                             connection.release();
//                             reject(err);
//                         });
//                     }

//                     console.log("Record check result:", checkResult);

//                     if (!checkResult || checkResult.length === 0) {
//                         console.error("No record found with ID:", replaceData.orderPackageId);
//                         return connection.rollback(() => {
//                             connection.release();
//                             reject(new Error(`OrderPackage with ID ${replaceData.orderPackageId} not found`));
//                         });
//                     }

//                     // Check if already locked
//                     if (checkResult[0].isLock === 1) {
//                         console.warn("Record is already locked:", replaceData.orderPackageId);
//                         return connection.rollback(() => {
//                             connection.release();
//                             reject(new Error("OrderPackage is already locked"));
//                         });
//                     }

//                     // Step 1: Update orderpackage table to set isLock = 1
//                     const updateOrderPackageSql = `
//                         UPDATE market_place.orderpackage 
//                         SET isLock = 1 
//                         WHERE id = ? AND isLock = 0
//                     `;

//                     console.log("Executing update query:", updateOrderPackageSql);
//                     console.log("With parameters:", [replaceData.orderPackageId]);

//                     connection.query(updateOrderPackageSql, [replaceData.orderPackageId], (err, updateResult) => {
//                         if (err) {
//                             console.error("Error updating orderpackage:", err);
//                             return connection.rollback(() => {
//                                 connection.release();
//                                 reject(err);
//                             });
//                         }

//                         console.log("Update result:", updateResult);
//                         console.log("OrderPackage updated, affected rows:", updateResult.affectedRows);

//                         if (updateResult.affectedRows === 0) {
//                             console.error("No rows were updated");
//                             return connection.rollback(() => {
//                                 connection.release();
//                                 reject(new Error("Failed to lock OrderPackage - no rows affected"));
//                             });
//                         }

//                         // Step 2: Insert into replacerequest table
//                         const insertReplaceSql = `
//                             INSERT INTO market_place.replacerequest 
//                             (orderPackageId,replceId, productType, productId, qty, price, status,  createdAt) 
//                             VALUES (?, ?, ?, ?, ?, ?, ? ,NOW())
//                         `;

//                         const insertValues = [
//                             replaceData.orderPackageId,
//                             replaceData.replaceId,
//                             replaceData.productType,

//                             replaceData.productId,
//                             replaceData.qty,
//                             replaceData.price,
//                             replaceData.status

//                         ];

//                         console.log("Inserting replace request with values:", insertValues);

//                         connection.query(insertReplaceSql, insertValues, (err, insertResult) => {
//                             if (err) {
//                                 console.error("Error inserting replace request:", err);
//                                 return connection.rollback(() => {
//                                     connection.release();
//                                     reject(err);
//                                 });
//                             }

//                             console.log("Replace request inserted, ID:", insertResult.insertId);

//                             // Commit transaction
//                             connection.commit((err) => {
//                                 if (err) {
//                                     console.error("Error committing transaction:", err);
//                                     return connection.rollback(() => {
//                                         connection.release();
//                                         reject(err);
//                                     });
//                                 }

//                                 console.log("Replace request transaction completed successfully");

//                                 // Release connection back to pool
//                                 connection.release();

//                                 resolve({
//                                     replaceRequestId: insertResult.insertId,
//                                     orderPackageId: replaceData.orderPackageId,
//                                     message: "Replacement request created and order package locked successfully"
//                                 });
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     });
// };

exports.createReplaceRequestDao = (replaceData) => {
    console.log("Creating replace request with data:", replaceData);

    return new Promise((resolve, reject) => {
        // Get a connection from the pool
        db.collectionofficer.getConnection((err, connection) => {
            if (err) {
                console.error("Error getting connection from pool:", err);
                return reject(err);
            }

            // Start transaction on the connection
            connection.beginTransaction((err) => {
                if (err) {
                    console.error("Error starting transaction:", err);
                    connection.release();
                    return reject(err);
                }

                // First, check if the record exists
                const checkSql = "SELECT id, isLock FROM market_place.orderpackage WHERE id = ?";
                console.log("Checking if record exists with ID:", replaceData.orderPackageId);

                connection.query(checkSql, [replaceData.orderPackageId], (err, checkResult) => {
                    if (err) {
                        console.error("Error checking record existence:", err);
                        return connection.rollback(() => {
                            connection.release();
                            reject(err);
                        });
                    }

                    console.log("Record check result:", checkResult);

                    if (!checkResult || checkResult.length === 0) {
                        console.error("No record found with ID:", replaceData.orderPackageId);
                        return connection.rollback(() => {
                            connection.release();
                            reject(new Error(`OrderPackage with ID ${replaceData.orderPackageId} not found`));
                        });
                    }

                    // Check if already locked (only relevant for DIO operations)
                    if (replaceData.isDIO && checkResult[0].isLock === 1) {
                        console.warn("Record is already locked:", replaceData.orderPackageId);
                        return connection.rollback(() => {
                            connection.release();
                            reject(new Error("OrderPackage is already locked"));
                        });
                    }

                    // Additional check: Verify that the replaceId exists in orderpackageitems table
                    const checkItemSql = "SELECT id FROM market_place.orderpackageitems WHERE id = ? AND orderPackageId = ?";
                    console.log("Checking if orderpackageitem exists with ID:", replaceData.replaceId);

                    connection.query(checkItemSql, [replaceData.replaceId, replaceData.orderPackageId], (err, itemCheckResult) => {
                        if (err) {
                            console.error("Error checking orderpackageitem existence:", err);
                            return connection.rollback(() => {
                                connection.release();
                                reject(err);
                            });
                        }

                        if (!itemCheckResult || itemCheckResult.length === 0) {
                            console.error("No orderpackageitem found with ID:", replaceData.replaceId);
                            return connection.rollback(() => {
                                connection.release();
                                reject(new Error(`OrderPackageItem with ID ${replaceData.replaceId} not found for OrderPackage ${replaceData.orderPackageId}`));
                            });
                        }

                        // Handle different roles
                        if (replaceData.isDBM) {
                            // DBM: Only update orderpackageitems table
                            handleDBMUpdates(connection, replaceData, resolve, reject);
                        } else if (replaceData.isDIO) {
                            // DIO: Update orderpackage (set isLock=1) and insert into replacerequest
                            handleDIOUpdates(connection, replaceData, resolve, reject);
                        } else {
                            // Unknown role
                            console.error("Unknown user role");
                            return connection.rollback(() => {
                                connection.release();
                                reject(new Error("Unknown user role"));
                            });
                        }
                    });
                });
            });
        });
    });
};

// Handle DBM updates - only update orderpackageitems table
function handleDBMUpdates(connection, replaceData, resolve, reject) {
    console.log("Processing DBM updates");

    // DBM can only update productType, productId, qty, price (NOT isPacked)
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
        replaceData.orderPackageId
    ];

    console.log("DBM updating specific orderpackageitem (limited fields):", updateItemsValues);

    connection.query(updateItemsSql, updateItemsValues, (err, itemsResult) => {
        if (err) {
            console.error("Error updating orderpackageitems:", err);
            return connection.rollback(() => {
                connection.release();
                reject(err);
            });
        }

        console.log("OrderPackageItems updated (DBM):", itemsResult.affectedRows);

        if (itemsResult.affectedRows === 0) {
            console.warn("No orderpackageitem was updated - item might not exist");
            return connection.rollback(() => {
                connection.release();
                reject(new Error("Failed to update orderpackageitem"));
            });
        }

        // Commit transaction for DBM
        connection.commit((err) => {
            if (err) {
                console.error("Error committing DBM transaction:", err);
                return connection.rollback(() => {
                    connection.release();
                    reject(err);
                });
            }

            console.log("DBM transaction completed successfully");
            connection.release();

            resolve({
                orderPackageId: replaceData.orderPackageId,
                replaceItemId: replaceData.replaceId,
                message: "Order package item updated successfully by DBM",
                updatedBy: replaceData.userId,
                permissions: 'DBM - Limited access (orderpackageitems only)'
            });
        });
    });
}

// Handle DIO updates - update orderpackage (set isLock=1) and insert into replacerequest
function handleDIOUpdates(connection, replaceData, resolve, reject) {
    console.log("Processing DIO updates");

    // Step 1: Update orderpackage table to set isLock = 1
    const updateOrderPackageSql = `
        UPDATE market_place.orderpackage 
        SET isLock = 1 
        WHERE id = ? AND isLock = 0
    `;

    console.log("DIO updating orderpackage isLock:", [replaceData.orderPackageId]);

    connection.query(updateOrderPackageSql, [replaceData.orderPackageId], (err, updateResult) => {
        if (err) {
            console.error("Error updating orderpackage:", err);
            return connection.rollback(() => {
                connection.release();
                reject(err);
            });
        }

        console.log("OrderPackage updated (DIO):", updateResult.affectedRows);

        if (updateResult.affectedRows === 0) {
            console.error("No rows were updated in orderpackage");
            return connection.rollback(() => {
                connection.release();
                reject(new Error("Failed to lock OrderPackage - no rows affected"));
            });
        }

        // Step 2: Insert into replacerequest table (now includes userId)
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
            replaceData.userId  // Added userId to the insert
        ];

        console.log("DIO inserting replace request with values:", insertValues);

        connection.query(insertReplaceSql, insertValues, (err, insertResult) => {
            if (err) {
                console.error("Error inserting replace request:", err);
                return connection.rollback(() => {
                    connection.release();
                    reject(err);
                });
            }

            console.log("Replace request inserted (DIO), ID:", insertResult.insertId);

            // Step 3: Optionally update orderpackageitems if DIO wants to update items too
            if (replaceData.updateItems) {
                // DIO can update all fields including isPacked
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
                    replaceData.orderPackageId
                ];

                console.log("DIO updating specific orderpackageitem (all fields):", updateItemsValues);

                connection.query(updateItemsSql, updateItemsValues, (err, itemsResult) => {
                    if (err) {
                        console.error("Error updating orderpackageitems:", err);
                        return connection.rollback(() => {
                            connection.release();
                            reject(err);
                        });
                    }

                    console.log("OrderPackageItems updated (DIO):", itemsResult.affectedRows);
                    commitDIOTransaction(connection, resolve, reject, replaceData, insertResult.insertId);
                });
            } else {
                // Just commit without updating items
                commitDIOTransaction(connection, resolve, reject, replaceData, insertResult.insertId);
            }
        });
    });
}

// Helper function to commit DIO transaction
function commitDIOTransaction(connection, resolve, reject, replaceData, insertId) {
    connection.commit((err) => {
        if (err) {
            console.error("Error committing DIO transaction:", err);
            return connection.rollback(() => {
                connection.release();
                reject(err);
            });
        }

        console.log("DIO transaction completed successfully");
        connection.release();

        resolve({
            replaceRequestId: insertId,
            orderPackageId: replaceData.orderPackageId,
            replaceItemId: replaceData.replaceId,
            message: "Replacement request created and order package locked successfully by DIO",
            updatedBy: replaceData.userId,
            permissions: 'DIO - Full access (orderpackage + replacerequest)'
        });
    });
}





//////////////////////////////////

// FIXED CODE - Remove orderId from WHERE clause since it doesn't match

// exports.updateDistributedTargetItems = async (targetItemIds, orderId) => {
//     return new Promise((resolve, reject) => {
//         // First, get the process order ID from the orderId
//         db.marketPlace.getConnection((err, marketPlaceConnection) => {
//             if (err) return reject(err);

//             marketPlaceConnection.query(
//                 'SELECT id FROM processorders WHERE orderId = ?',
//                 [orderId],
//                 (err, processOrderResults) => {
//                     marketPlaceConnection.release();

//                     if (err) return reject(err);
//                     if (processOrderResults.length === 0) {
//                         return reject(new Error('Process order not found'));
//                     }

//                     const processOrderId = processOrderResults[0].id;

//                     // Now work with collection_officer database
//                     db.collectionofficer.getConnection((err, connection) => {
//                         if (err) return reject(err);

//                         const handleFinal = (error, result) => {
//                             connection.release();
//                             if (error) return reject(error);
//                             resolve(result);
//                         };

//                         // If no specific item IDs provided, get all incomplete items
//                         if (targetItemIds.length === 0) {
//                             connection.query(
//                                 'SELECT id FROM distributedtargetitems WHERE orderId = ? AND isComplete = 0',
//                                 [processOrderId],
//                                 (err, results) => {
//                                     if (err) return handleFinal(err);
//                                     console.log(`Found ${results.length} incomplete items for order ${processOrderId}`);
//                                     updateItems(results.map(row => row.id));
//                                 }
//                             );
//                         } else {
//                             // Validate the provided targetItemIds belong to this process order
//                             connection.query(
//                                 'SELECT id FROM distributedtargetitems WHERE orderId = ? AND id IN (?)',
//                                 [processOrderId, targetItemIds],
//                                 (err, results) => {
//                                     if (err) return handleFinal(err);
//                                     console.log(`Found ${results.length} valid items for order ${processOrderId}`);
//                                     updateItems(results.map(row => row.id));
//                                 }
//                             );
//                         }

//                         function updateItems(itemsToUpdate) {
//                             if (itemsToUpdate.length === 0) {
//                                 return handleFinal(null, {
//                                     updatedItems: 0,
//                                     updatedTargets: 0
//                                 });
//                             }

//                             // Update only the distributed target items
//                             connection.query(
//                                 'UPDATE distributedtargetitems SET isComplete = 1, completeTime = NOW() WHERE id IN (?)',
//                                 [itemsToUpdate],
//                                 (err, result) => {
//                                     if (err) return handleFinal(err);

//                                     handleFinal(null, {
//                                         updatedItems: result.affectedRows,
//                                         updatedTargets: 0 // Skip target update since table doesn't exist
//                                     });
//                                 }
//                             );
//                         }
//                     });
//                 }
//             );
//         });
//     });
// };

exports.updateDistributedTargetItems = async (targetItemIds, orderId) => {
    let marketPlaceConnection;
    let collectionOfficerConnection;

    try {
        // 1. Get the process order ID from the orderId using promise connection
        marketPlaceConnection = await new Promise((resolve, reject) => {
            db.marketPlace.getConnection((err, connection) => {
                if (err) return reject(err);
                resolve(connection);
            });
        });

        const [processOrderResults] = await marketPlaceConnection.promise().query(
            'SELECT id FROM processorders WHERE orderId = ?',
            [orderId]
        );

        if (processOrderResults.length === 0) {
            throw new Error('Process order not found');
        }

        const processOrderId = processOrderResults[0].id;

        // 2. Connect to collection_officer database using promise
        collectionOfficerConnection = await new Promise((resolve, reject) => {
            db.collectionofficer.getConnection((err, connection) => {
                if (err) return reject(err);
                resolve(connection);
            });
        });

        // 3. Get incomplete items for this order
        const getItemsQuery = targetItemIds.length === 0
            ? 'SELECT id, targetId FROM distributedtargetitems WHERE orderId = ? AND isComplete = 0 ORDER BY id'
            : 'SELECT id, targetId FROM distributedtargetitems WHERE orderId = ? AND id IN (?) ORDER BY id';

        const getItemsParams = targetItemIds.length === 0
            ? [processOrderId]
            : [processOrderId, targetItemIds];

        const [items] = await collectionOfficerConnection.promise().query(getItemsQuery, getItemsParams);

        if (items.length === 0) {
            return {
                updatedItems: 0,
                updatedTargets: 0
            };
        }

        // 4. Process updates in a transaction
        await collectionOfficerConnection.promise().query('START TRANSACTION');

        let updatedItemsCount = 0;
        let updatedTargetsCount = 0;

        // Process items one by one
        for (const item of items) {
            try {
                // Update the distributedtargetitems record
                const [itemUpdateResult] = await collectionOfficerConnection.promise().query(
                    'UPDATE distributedtargetitems SET isComplete = 1, completeTime = NOW() WHERE id = ?',
                    [item.id]
                );

                if (itemUpdateResult.affectedRows === 1) {
                    updatedItemsCount++;

                    // Increment the complete count in distributedtarget
                    const [targetUpdateResult] = await collectionOfficerConnection.promise().query(
                        'UPDATE distributedtarget SET complete = complete + 1 WHERE id = ?',
                        [item.targetId]
                    );

                    if (targetUpdateResult.affectedRows === 1) {
                        updatedTargetsCount++;
                    }
                }
            } catch (itemError) {
                await collectionOfficerConnection.promise().query('ROLLBACK');
                throw itemError;
            }
        }

        await collectionOfficerConnection.promise().query('COMMIT');

        return {
            updatedItems: updatedItemsCount,
            updatedTargets: updatedTargetsCount
        };

    } catch (error) {
        // Rollback transaction if it was started
        if (collectionOfficerConnection) {
            await collectionOfficerConnection.promise().query('ROLLBACK').catch(rollbackError => {
                console.error('Rollback failed:', rollbackError);
            });
        }
        throw error;
    } finally {
        // Always release connections
        if (marketPlaceConnection) marketPlaceConnection.release();
        if (collectionOfficerConnection) collectionOfficerConnection.release();
    }
};




/////////////get terget 

// distributionDao.js
// exports.getDistributionTargets = async (officerId) => {
//     return new Promise((resolve, reject) => {
//         db.collectionofficer.getConnection((err, connection) => {
//             if (err) return reject(err);

//             connection.query(
//                 `SELECT 
//                     id,
//                     companycenterId,
//                     userId,
//                     target,
//                     complete,
//                     (complete/target * 100) AS completionPercentage,
//                     createdAt

//                 FROM distributedtarget 
//                 WHERE userId = ?
//                 ORDER BY companycenterId ASC, userId DESC, target ASC, complete ASC, createdAt ASC
//                 LIMIT 1000`,
//                 [officerId],
//                 (err, results) => {
//                     connection.release();
//                     if (err) return reject(err);
//                     resolve(results);
//                 }
//             );
//         });
//     });
// };

exports.getDistributionTargets = async (officerId) => {
    return new Promise((resolve, reject) => {
        db.collectionofficer.getConnection((err, connection) => {
            if (err) return reject(err);
            connection.query(
                `SELECT 
                    id,
                    companycenterId,
                    userId,
                    target,
                    complete,
                    (complete/target * 100) AS completionPercentage,
                    createdAt
                FROM distributedtarget 
                WHERE userId = ? 
                AND DATE(createdAt) = CURDATE()
                ORDER BY companycenterId ASC, userId DESC, target ASC, complete ASC, createdAt ASC
                LIMIT 1000`,
                [officerId],
                (err, results) => {
                    connection.release();
                    if (err) return reject(err);
                    resolve(results);
                }
            );
        });
    });
};



// exports.updateoutForDelivery = (orderId, userId) => {
//     return new Promise((resolve, reject) => {
//         // SQL to update status to 'Out For Delivery' and set outBy to userId
//         const sql = `
//             UPDATE market_place.processorders 
//             SET status = 'Out For Delivery', outBy = ?
//             WHERE orderId = ?
//         `;

//         try {
//             db.collectionofficer.query(sql, [userId, orderId], (err, result) => {
//                 if (err) {
//                     console.error(`Error updating order ${orderId}:`, err);
//                     return reject(err);
//                 }

//                 if (result.affectedRows === 0) {
//                     return reject(new Error(`No order found with orderId: ${orderId}`));
//                 }

//                 console.log(`Successfully updated order ${orderId} - affected rows: ${result.affectedRows}`);
//                 resolve(result);
//             });
//         } catch (error) {
//             console.error("Error in updateoutForDelivery:", error);
//             reject(error);
//         }
//     });
// };
exports.updateoutForDelivery = (orderId, userId) => {
    return new Promise((resolve, reject) => {
        const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const sql = `
            UPDATE market_place.processorders 
            SET status = 'Out For Delivery', 
                outBy = ?,
                outDlvrDate = ?
            WHERE orderId = ?
        `;

        try {
            db.collectionofficer.query(sql, [userId, currentDate, orderId], (err, result) => {
                if (err) {
                    console.error(`Error updating order ${orderId}:`, err);
                    return reject(err);
                }

                if (result.affectedRows === 0) {
                    return reject(new Error(`No order found with orderId: ${orderId}`));
                }

                console.log(`Successfully updated order ${orderId} - affected rows: ${result.affectedRows}`);
                resolve(result);
            });
        } catch (error) {
            console.error("Error in updateoutForDelivery:", error);
            reject(error);
        }
    });
};
