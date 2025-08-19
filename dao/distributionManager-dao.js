const db = require("../startup/database");



// exports.getDCenterTarget = (irmId = null) => {
//     console.log("Getting targets for IRM ID:", irmId || "ALL OFFICERS");

//     return new Promise((resolve, reject) => {
//         const sql = `
//             SELECT 
//                 co.id,
//                 co.irmId,

//                 dt.id AS distributedTargetId,
//                 dt.companycenterId,
//                 dt.userId,
//                 dt.target,
//                 dt.complete,
//                 dt.createdAt AS targetCreatedAt,

//                 dti.id AS distributedTargetItemId,
//                 dti.orderId,
//                 dti.isComplete,
//                 dti.completeTime,
//                 dti.createdAt AS itemCreatedAt,

//                 po.id AS processOrderId,
//                 po.invNo,
//                 po.transactionId,
//                 po.paymentMethod,
//                 po.isPaid,
//                 po.amount,
//                 po.status,
//                 po.outDlvrDate,
//                 po.createdAt AS orderCreatedAt,
//                 po.reportStatus,

//                 o.id AS orderId,
//                 o.isPackage,
//                 o.userId AS orderUserId,
//                 o.orderApp,
//                 o.buildingType,
//                 o.sheduleType,
//                 o.sheduleDate,
//                 o.sheduleTime,

//                 -- Additional item counts
//                 COALESCE(additional_item_counts.total_items, 0) AS totalAdditionalItems,
//                 COALESCE(additional_item_counts.packed_items, 0) AS packedAdditionalItems,
//                 COALESCE(additional_item_counts.pending_items, 0) AS pendingAdditionalItems,

//                 -- Additional item status
//                 CASE 
//                     WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN NULL
//                     WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                     WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
//                          COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
//                     WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
//                     ELSE NULL
//                 END AS additionalItemStatus,

//                 -- Package item counts (aggregated at order level)
//                 COALESCE(package_item_counts.total_items, 0) AS totalPackageItems,
//                 COALESCE(package_item_counts.packed_items, 0) AS packedPackageItems,
//                 COALESCE(package_item_counts.pending_items, 0) AS pendingPackageItems,
//                 COALESCE(package_item_counts.total_packages, 0) AS totalPackages,

//                 -- Package details (aggregated)
//                 package_item_counts.all_locked AS allPackagesLocked,
//                 package_item_counts.packing_status_summary AS packagePackingStatusSummary,

//                 -- Package item status
//                 CASE 
//                     WHEN o.isPackage = 0 THEN NULL
//                     WHEN COALESCE(package_item_counts.total_items, 0) = 0 THEN 'Pending'
//                     WHEN COALESCE(package_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                     WHEN COALESCE(package_item_counts.packed_items, 0) > 0 AND 
//                          COALESCE(package_item_counts.packed_items, 0) < COALESCE(package_item_counts.total_items, 0) THEN 'Opened'
//                     WHEN COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
//                     ELSE NULL
//                 END AS packageItemStatus,

//                 -- Overall status
//                 CASE 
//                     -- For non-package orders (only check additional items)
//                     WHEN o.isPackage = 0 THEN
//                         CASE 
//                             WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN 'Pending'
//                             WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                             WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
//                                  COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
//                             WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
//                             ELSE 'Pending'
//                         END

//                     -- For package orders (check both additional and package items)
//                     WHEN o.isPackage = 1 THEN
//                         CASE 
//                             -- When both additional and package items exist
//                             WHEN COALESCE(additional_item_counts.total_items, 0) > 0 AND 
//                                  COALESCE(package_item_counts.total_items, 0) > 0 THEN
//                                 CASE 
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) AND
//                                          COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 OR 
//                                          COALESCE(package_item_counts.packed_items, 0) > 0 THEN 'Opened'
//                                     ELSE 'Pending'
//                                 END

//                             -- When only additional items exist
//                             WHEN COALESCE(additional_item_counts.total_items, 0) > 0 THEN
//                                 CASE 
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
//                                          COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
//                                     ELSE 'Pending'
//                                 END

//                             -- When only package items exist
//                             WHEN COALESCE(package_item_counts.total_items, 0) > 0 THEN
//                                 CASE 
//                                     WHEN COALESCE(package_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                                     WHEN COALESCE(package_item_counts.packed_items, 0) > 0 AND 
//                                          COALESCE(package_item_counts.packed_items, 0) < COALESCE(package_item_counts.total_items, 0) THEN 'Opened'
//                                     WHEN COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
//                                     ELSE 'Pending'
//                                 END

//                             -- When no items exist (shouldn't happen for package orders)
//                             ELSE 'Pending'
//                         END
//                     ELSE 'Pending'
//                 END AS selectedStatus

//             FROM 
//                 distributedtarget dt
//             LEFT JOIN 
//                 collectionofficer co ON dt.userId = co.id
//             LEFT JOIN 
//                 distributedtargetitems dti ON dt.id = dti.targetId
//             LEFT JOIN 
//                 market_place.processorders po ON dti.orderId = po.id
//             LEFT JOIN 
//                 market_place.orders o ON po.orderId = o.id
//             LEFT JOIN (
//                 -- Additional items subquery
//                 SELECT 
//                     orderId,
//                     COUNT(*) as total_items,
//                     SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
//                     SUM(CASE WHEN isPacked = 0 THEN 1 ELSE 0 END) as pending_items
//                 FROM 
//                     market_place.orderadditionalitems
//                 GROUP BY 
//                     orderId
//             ) additional_item_counts ON o.id = additional_item_counts.orderId
//             LEFT JOIN (
//                 -- Package items subquery - FIXED: Aggregated at order level
//                 SELECT 
//                     op.orderId,
//                     COUNT(DISTINCT op.id) as total_packages,
//                     COUNT(opi.id) as total_items,
//                     SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
//                     SUM(CASE WHEN opi.isPacked = 0 THEN 1 ELSE 0 END) as pending_items,
//                     -- Check if all packages are locked
//                     CASE WHEN COUNT(CASE WHEN op.isLock = 0 THEN 1 END) = 0 THEN 1 ELSE 0 END as all_locked,
//                     -- Create a summary of packing statuses
//                     GROUP_CONCAT(DISTINCT op.packingStatus ORDER BY op.packingStatus) as packing_status_summary
//                 FROM 
//                     market_place.orderpackage op
//                 LEFT JOIN 
//                     market_place.orderpackageitems opi ON op.id = opi.orderPackageId
//                 GROUP BY 
//                     op.orderId
//             ) package_item_counts ON po.id = package_item_counts.orderId
//             WHERE 
//                 DATE(dt.createdAt) = CURDATE()
//                 ${irmId ? 'AND (co.irmId = ? OR dt.userId = ?)' : ''}
//             ORDER BY 
//                 dt.companycenterId ASC,
//                 dt.userId DESC,
//                 dt.target ASC,
//                 dt.complete ASC,
//                 o.id ASC
//         `;

//         // Execute the query with conditional parameters
//         const queryParams = irmId ? [irmId, irmId] : [];
//         db.collectionofficer.query(sql, queryParams, (err, results) => {
//             if (err) {
//                 console.error("Error executing query:", err);
//                 return reject(err);
//             }

//             console.log("Targets found:", results.length);
//             if (results.length > 0) {
//                 console.log("=== DEBUGGING DATA ===");

//                 // Log first 3 records for debugging
//                 results.slice(0, 3).forEach((row, index) => {
//                     console.log(`Record ${index + 1}:`, {
//                         collectionOfficerId: row.id,
//                         irmId: row.irmId,
//                         distributedTargetId: row.distributedTargetId,
//                         processOrderId: row.processOrderId,
//                         orderId: row.orderId,
//                         isPackage: row.isPackage,
//                         packageData: {
//                             totalPackages: row.totalPackages,
//                             allPackagesLocked: row.allPackagesLocked,
//                             packingStatusSummary: row.packagePackingStatusSummary,
//                             items: {
//                                 total: row.totalPackageItems,
//                                 packed: row.packedPackageItems,
//                                 pending: row.pendingPackageItems,
//                                 status: row.packageItemStatus
//                             }
//                         },
//                         additionalItems: {
//                             total: row.totalAdditionalItems,
//                             packed: row.packedAdditionalItems,
//                             pending: row.pendingAdditionalItems,
//                             status: row.additionalItemStatus
//                         },
//                         overallStatus: row.selectedStatus
//                     });
//                 });

//                 // Check for duplicate orders
//                 const orderCounts = results.reduce((acc, row) => {
//                     acc[row.orderId] = (acc[row.orderId] || 0) + 1;
//                     return acc;
//                 }, {});

//                 const duplicateOrders = Object.entries(orderCounts)
//                     .filter(([orderId, count]) => count > 1)
//                     .map(([orderId, count]) => ({ orderId, count }));

//                 if (duplicateOrders.length > 0) {
//                     console.log("⚠️  WARNING: Duplicate orders found:", duplicateOrders);
//                 } else {
//                     console.log("✅ No duplicate orders found - each order appears only once");
//                 }

//                 // Status summary
//                 const statusCounts = results.reduce((acc, row) => {
//                     acc[row.selectedStatus] = (acc[row.selectedStatus] || 0) + 1;
//                     return acc;
//                 }, {});
//                 console.log("Status Distribution:", statusCounts);

//                 console.log("=== END DEBUGGING ===");
//             }

//             resolve(results);
//         });
//     });
// };


exports.getDCenterTarget = (irmId = null) => {
    console.log("Getting targets for IRM ID:", irmId || "ALL OFFICERS");

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

                -- Package item counts (aggregated at order level)
                COALESCE(package_item_counts.total_items, 0) AS totalPackageItems,
                COALESCE(package_item_counts.packed_items, 0) AS packedPackageItems,
                COALESCE(package_item_counts.pending_items, 0) AS pendingPackageItems,
                COALESCE(package_item_counts.total_packages, 0) AS totalPackages,

                -- Package details (aggregated)
                package_item_counts.all_locked AS allPackagesLocked,
                package_item_counts.packing_status_summary AS packagePackingStatusSummary,

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

                -- Overall status
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
            LEFT JOIN 
                collectionofficer co ON dt.userId = co.id
            LEFT JOIN 
                distributedtargetitems dti ON dt.id = dti.targetId
            LEFT JOIN 
                market_place.processorders po ON dti.orderId = po.id
            LEFT JOIN 
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
                -- Package items subquery - FIXED: Aggregated at order level
                SELECT 
                    op.orderId,
                    COUNT(DISTINCT op.id) as total_packages,
                    COUNT(opi.id) as total_items,
                    SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
                    SUM(CASE WHEN opi.isPacked = 0 THEN 1 ELSE 0 END) as pending_items,
                    -- Check if all packages are locked
                    CASE WHEN COUNT(CASE WHEN op.isLock = 0 THEN 1 END) = 0 THEN 1 ELSE 0 END as all_locked,
                    -- Create a summary of packing statuses
                    GROUP_CONCAT(DISTINCT op.packingStatus ORDER BY op.packingStatus) as packing_status_summary
                FROM 
                    market_place.orderpackage op
                LEFT JOIN 
                    market_place.orderpackageitems opi ON op.id = opi.orderPackageId
                GROUP BY 
                    op.orderId
            ) package_item_counts ON po.id = package_item_counts.orderId
            WHERE 
                (
                    -- Last 3 days: get all data without filtering
                    DATE(dt.createdAt) >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
                    OR 
                    -- Older than 3 days: only incomplete orders
                    (DATE(dt.createdAt) < DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND (dti.isComplete IS NULL OR dti.isComplete = 0))
                )
                ${irmId ? 'AND (co.irmId = ? OR dt.userId = ?)' : ''}
            ORDER BY 
                dt.companycenterId ASC,
                dt.userId DESC,
                dt.target ASC,
                dt.complete ASC,
                o.id ASC
        `;

        // Execute the query with conditional parameters
        const queryParams = irmId ? [irmId, irmId] : [];
        db.collectionofficer.query(sql, queryParams, (err, results) => {
            if (err) {
                console.error("Error executing query:", err);
                return reject(err);
            }

            console.log("Targets found (3 days all data + older incomplete):", results.length);
            if (results.length > 0) {
                console.log("=== DEBUGGING DATA (3 DAYS ALL + OLDER INCOMPLETE) ===");

                // Log first 3 records for debugging
                results.slice(0, 3).forEach((row, index) => {
                    console.log(`Record ${index + 1}:`, {
                        collectionOfficerId: row.id,
                        irmId: row.irmId,
                        distributedTargetId: row.distributedTargetId,
                        distributedTargetItemId: row.distributedTargetItemId,
                        isComplete: row.isComplete,
                        createdDate: row.targetCreatedAt, // Show the date for verification
                        processOrderId: row.processOrderId,
                        orderId: row.orderId,
                        isPackage: row.isPackage,
                        packageData: {
                            totalPackages: row.totalPackages,
                            allPackagesLocked: row.allPackagesLocked,
                            packingStatusSummary: row.packagePackingStatusSummary,
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

                // Check for duplicate orders
                const orderCounts = results.reduce((acc, row) => {
                    acc[row.orderId] = (acc[row.orderId] || 0) + 1;
                    return acc;
                }, {});

                const duplicateOrders = Object.entries(orderCounts)
                    .filter(([orderId, count]) => count > 1)
                    .map(([orderId, count]) => ({ orderId, count }));

                if (duplicateOrders.length > 0) {
                    console.log("⚠️  WARNING: Duplicate orders found:", duplicateOrders);
                } else {
                    console.log("✅ No duplicate orders found - each order appears only once");
                }

                // Status summary
                const statusCounts = results.reduce((acc, row) => {
                    acc[row.selectedStatus] = (acc[row.selectedStatus] || 0) + 1;
                    return acc;
                }, {});
                console.log("Status Distribution (3 days all + older incomplete):", statusCounts);

                // Completion status summary
                const completionCounts = results.reduce((acc, row) => {
                    const status = row.isComplete === null ? 'NULL' : row.isComplete.toString();
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {});
                console.log("Completion Status Distribution:", completionCounts);

                // Date-wise summary
                const dateCounts = results.reduce((acc, row) => {
                    const date = new Date(row.targetCreatedAt).toISOString().split('T')[0];
                    acc[date] = (acc[date] || 0) + 1;
                    return acc;
                }, {});
                console.log("Date-wise Distribution:", dateCounts);

                console.log("=== END DEBUGGING ===");
            }

            resolve(results);
        });
    });
};

// /**
//  * Alternative method if you want separate data instead of nested structure
//  */
// exports.getCenterTargetSeparate = async (officerId) => {
//     try {
//         console.log("getCenterTargetSeparate DAO called with officerId:", officerId);

//         // Get related officers
//         const officerQuery = `
//             SELECT id, centerId, distributedCenterId, companyId, irmId
//             FROM collectionofficer
//             WHERE irmId = (SELECT irmId FROM collectionofficer WHERE id = ?)
//         `;

//         const officers = await db.query(officerQuery, [officerId]);

//         if (!officers || officers.length === 0) {
//             return { officers: [], targets: [], targetItems: [] };
//         }

//         const officerIds = officers.map(officer => officer.id);
//         const placeholders = officerIds.map(() => '?').join(',');

//         // Get targets
//         const targetsQuery = `
//             SELECT * FROM distributedtarget
//             WHERE userId IN (${placeholders})
//             ORDER BY companycenterId ASC, userId DESC, target ASC, complete ASC, createdAt ASC
//         `;

//         const targets = await db.query(targetsQuery, officerIds);

//         // Get target items if targets exist
//         let targetItems = [];
//         if (targets && targets.length > 0) {
//             const targetIds = targets.map(target => target.id);
//             const targetPlaceholders = targetIds.map(() => '?').join(',');

//             const targetItemsQuery = `
//                 SELECT * FROM distributedtargetitems
//                 WHERE targetId IN (${targetPlaceholders})
//                 ORDER BY id ASC, targetId ASC, orderId ASC, isComplete ASC, completeTime ASC, createdAt ASC
//             `;

//             targetItems = await db.query(targetItemsQuery, targetIds);
//         }

//         return {
//             officers: officers,
//             targets: targets || [],
//             targetItems: targetItems || []
//         };

//     } catch (error) {
//         console.error('Error in getCenterTargetSeparate DAO:', error);
//         throw new Error(`Database error: ${error.message}`);
//     }
// };
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

            resolve(results[0]); // Return the first result as the officer details
        });
    });
};






exports.getAllReplaceRequests = (managerId) => {
    console.log("manager Id", managerId);
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
                AND rr.status = 'Pending'
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
                    errno: err.errno
                });
                return reject(new Error("Database error while fetching pending replace requests"));
            }

            console.log(`Found ${results.length} pending replace requests for manager ${managerId}`);
            resolve(results);
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
                    errno: err.errno
                });
                return reject(new Error("Database error while fetching retail items"));
            }

            // Format the results
            const formattedResults = results.map(item => ({
                id: item.id,
                varietyId: item.varietyId,
                displayName: item.displayName,
                category: item.category,
                normalPrice: parseFloat(item.normalPrice || 0),
                discountedPrice: item.discountedPrice ? parseFloat(item.discountedPrice) : null,
                unitType: item.unitType
            }));

            resolve(formattedResults);
        });
    });
};

exports.getOrdreReplace = (id) => {
    console.log("DAO getOrdreReplace called with ID:", id);
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

        console.log("Executing SQL:", sql);
        console.log("With parameter:", [id]);
        db.marketPlace.query(sql, [id], (err, results) => {
            if (err) {
                console.error("Database error details:", {
                    message: err.message,
                    sql: err.sql,
                    code: err.code,
                    errno: err.errno
                });
                return reject(new Error("Database error while fetching replace request data"));
            }

            console.log("Query results:", results);

            // Format the results
            const formattedResults = results.map(item => ({
                replceId: item.replceId,
                id: item.id,
                orderPackageId: item.orderPackageId,
                productType: item.productType,
                productId: item.productId,
                qty: parseInt(item.qty || 0),
                price: parseFloat(item.price || 0),
                status: item.status,
                userId: item.userId,
                createdAt: item.createdAt,

                displayName: item.displayName // Product display name from join
            }));

            resolve(formattedResults);
        });
    });
};


// targetDDao.approveReplaceRequest function
exports.approveReplaceRequest = (params) => {
    console.log("DAO approveReplaceRequest called with params:", params);

    return new Promise((resolve, reject) => {
        // Fix: Map replaceRequestId to replceId (the actual database column name)
        const { replaceRequestId, newProductId, quantity, price } = params;
        const replceId = replaceRequestId; // Map to the actual database column name

        // Validate required parameters
        if (!replceId || !newProductId || !quantity || !price) {
            return reject(new Error("Missing required parameters: replaceRequestId, newProductId, quantity, price"));
        }

        console.log("Using replceId:", replceId); // Debug log

        // Get connection from pool and start transaction
        db.marketPlace.getConnection((err, connection) => {
            if (err) {
                console.error("Failed to get connection from pool:", err);
                return reject(new Error("Failed to get database connection"));
            }

            // Start transaction
            connection.beginTransaction((err) => {
                if (err) {
                    console.error("Transaction begin error:", err);
                    connection.release();
                    return reject(new Error("Failed to start transaction"));
                }

                // Step 1: Get replace request details first
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

                connection.query(getReplaceRequestSql, [replceId], (err, replaceResults) => {
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
                            reject(new Error(`Replace request not found with replceId: ${replceId}`));
                        });
                    }

                    const replaceRequest = replaceResults[0];
                    console.log("Replace request found:", replaceRequest);

                    // Check if already approved
                    if (replaceRequest.status === 'Approved') {
                        return connection.rollback(() => {
                            connection.release();
                            reject(new Error("Replace request is already approved"));
                        });
                    }

                    // Step 1.5: Find the corresponding orderpackageitems record
                    // FIX: Instead of looking for the old product ID, find the item by orderPackageId only
                    // since there might be a mismatch between replace request and actual order items
                    const getOrderPackageItemsSql = `
                        SELECT id, productId, qty, price 
                        FROM market_place.orderpackageitems 
                        WHERE orderPackageId = ?
                        ORDER BY id ASC
                        LIMIT 1
                    `;

                    console.log("Looking for orderpackageitems with orderPackageId:", replaceRequest.orderPackageId);

                    connection.query(
                        getOrderPackageItemsSql,
                        [replaceRequest.orderPackageId],
                        (err, itemsResults) => {
                            if (err) {
                                console.error("Get order package items error:", err);
                                return connection.rollback(() => {
                                    connection.release();
                                    reject(new Error("Failed to get order package items"));
                                });
                            }

                            console.log("Order package items query results:", itemsResults);

                            if (itemsResults.length === 0) {
                                return connection.rollback(() => {
                                    connection.release();
                                    reject(new Error("No order package items found for this order"));
                                });
                            }

                            const orderPackageItem = itemsResults[0];
                            console.log("Order package item to update:", orderPackageItem);

                            // Log the mismatch if it exists
                            if (orderPackageItem.productId !== replaceRequest.oldProductId) {
                                console.log(`WARNING: Product ID mismatch detected!`);
                                console.log(`Replace request expects oldProductId: ${replaceRequest.oldProductId}`);
                                console.log(`But order package item has productId: ${orderPackageItem.productId}`);
                                console.log(`Proceeding with the update using the actual order package item...`);
                            }

                            // Step 2: Update replacerequest table
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

                                    console.log("Replace request updated:", updateReplaceResult);

                                    // Step 3: Update orderpackageitems table
                                    const updateOrderPackageItemsSql = `
                                        UPDATE market_place.orderpackageitems 
                                        SET 
                                            productId = ?,
                                            qty = ?,
                                            price = ?
                                           
                                        WHERE id = ?
                                    `;

                                    console.log("About to update orderpackageitems with:", {
                                        newProductId,
                                        quantity,
                                        price,
                                        orderPackageItemId: orderPackageItem.id
                                    });

                                    connection.query(
                                        updateOrderPackageItemsSql,
                                        [newProductId, quantity, price, orderPackageItem.id],
                                        (err, updateItemsResult) => {
                                            if (err) {
                                                console.error("Update order package items error:", err);
                                                return connection.rollback(() => {
                                                    connection.release();
                                                    reject(new Error("Failed to update order package items"));
                                                });
                                            }

                                            console.log("Order package items updated:", updateItemsResult);
                                            console.log("Affected rows:", updateItemsResult.affectedRows);

                                            if (updateItemsResult.affectedRows === 0) {
                                                console.log("WARNING: No rows were updated in orderpackageitems!");
                                            }

                                            // Step 4: Update orderpackage table (set isLock = 0)
                                            const updateOrderPackageSql = `
                                                UPDATE market_place.orderpackage 
                                                SET 
                                                    isLock = 0
                                                
                                                WHERE id = ?
                                            `;

                                            connection.query(
                                                updateOrderPackageSql,
                                                [replaceRequest.orderPackageId],
                                                (err, updatePackageResult) => {
                                                    if (err) {
                                                        console.error("Update order package error:", err);
                                                        return connection.rollback(() => {
                                                            connection.release();
                                                            reject(new Error("Failed to update order package"));
                                                        });
                                                    }

                                                    console.log("Order package updated:", updatePackageResult);

                                                    // Step 5: Commit transaction
                                                    connection.commit((err) => {
                                                        if (err) {
                                                            console.error("Transaction commit error:", err);
                                                            return connection.rollback(() => {
                                                                connection.release();
                                                                reject(new Error("Failed to commit transaction"));
                                                            });
                                                        }

                                                        console.log("Transaction committed successfully");

                                                        // Release connection back to pool
                                                        connection.release();

                                                        // Return success response
                                                        resolve({
                                                            success: true,
                                                            message: 'Replace request approved successfully',
                                                            data: {
                                                                replaceRequestId: replaceRequestId,
                                                                replceId: replceId,
                                                                orderPackageId: replaceRequest.orderPackageId,
                                                                oldProductId: orderPackageItem.productId, // Use actual product ID from order
                                                                newProductId: newProductId,
                                                                oldQuantity: orderPackageItem.qty,
                                                                newQuantity: quantity,
                                                                oldPrice: orderPackageItem.price,
                                                                newPrice: price,
                                                                updatedTables: [
                                                                    'replacerequest',
                                                                    'orderpackageitems',
                                                                    'orderpackage'
                                                                ]
                                                            }
                                                        });
                                                    });
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                });
            });
        });
    });
};




// exports.getDistributionOfficerTarget = (officerId) => {
//     console.log("Getting targets for officer ID:", officerId);

//     return new Promise((resolve, reject) => {
//         if (!officerId) {
//             return reject(new Error("Officer ID is missing or invalid"));
//         }

//         const sql = `
//             SELECT 
//                 dt.id AS distributedTargetId,
//                 dt.companycenterId,
//                 dt.userId,
//                 dt.target,
//                 dt.complete,
//                 dt.createdAt AS targetCreatedAt,

//                 dti.id AS distributedTargetItemId,
//                 dti.orderId,
//                 dti.isComplete,
//                 dti.completeTime,
//                 dti.createdAt AS itemCreatedAt,

//                 po.id AS processOrderId,
//                 po.invNo,
//                 po.transactionId,
//                 po.paymentMethod,
//                 po.isPaid,
//                 po.amount,
//                 po.status,
//                 po.createdAt AS orderCreatedAt,
//                 po.reportStatus,

//                 o.id AS orderId,
//                 o.isPackage,
//                 o.userId AS orderUserId,
//                 o.orderApp,
//                 o.buildingType,
//                 o.sheduleType,
//                 o.sheduleDate,
//                 o.sheduleTime,

//                 -- Additional item counts
//                 COALESCE(additional_item_counts.total_items, 0) AS totalAdditionalItems,
//                 COALESCE(additional_item_counts.packed_items, 0) AS packedAdditionalItems,
//                 COALESCE(additional_item_counts.pending_items, 0) AS pendingAdditionalItems,

//                 -- Additional item status
//                 CASE 
//                     WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN NULL
//                     WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                     WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
//                          COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
//                     WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
//                     ELSE NULL
//                 END AS additionalItemStatus,

//                 -- Package item counts (only for packages)
//                 COALESCE(package_item_counts.total_items, 0) AS totalPackageItems,
//                 COALESCE(package_item_counts.packed_items, 0) AS packedPackageItems,
//                 COALESCE(package_item_counts.pending_items, 0) AS pendingPackageItems,

//                 -- Package details
//                 package_item_counts.isLock AS packageIsLock,
//                 package_item_counts.packingStatus AS packagePackingStatus,
//                 package_item_counts.packageId AS packageId,

//                 -- Package item status
//                 CASE 
//                     WHEN o.isPackage = 0 THEN NULL
//                     WHEN COALESCE(package_item_counts.total_items, 0) = 0 THEN 'Pending'
//                     WHEN COALESCE(package_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                     WHEN COALESCE(package_item_counts.packed_items, 0) > 0 AND 
//                          COALESCE(package_item_counts.packed_items, 0) < COALESCE(package_item_counts.total_items, 0) THEN 'Opened'
//                     WHEN COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
//                     ELSE NULL
//                 END AS packageItemStatus,

//                 -- Overall status - FIXED to require BOTH additional and package items to be completed when they exist
//                 CASE 
//                     -- For non-package orders (only check additional items)
//                     WHEN o.isPackage = 0 THEN
//                         CASE 
//                             WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN 'Pending'
//                             WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                             WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
//                                  COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
//                             WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
//                             ELSE 'Pending'
//                         END

//                     -- For package orders (check both additional and package items)
//                     WHEN o.isPackage = 1 THEN
//                         CASE 
//                             -- When both additional and package items exist
//                             WHEN COALESCE(additional_item_counts.total_items, 0) > 0 AND 
//                                  COALESCE(package_item_counts.total_items, 0) > 0 THEN
//                                 CASE 
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) AND
//                                          COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 OR 
//                                          COALESCE(package_item_counts.packed_items, 0) > 0 THEN 'Opened'
//                                     ELSE 'Pending'
//                                 END

//                             -- When only additional items exist
//                             WHEN COALESCE(additional_item_counts.total_items, 0) > 0 THEN
//                                 CASE 
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
//                                          COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
//                                     WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
//                                     ELSE 'Pending'
//                                 END

//                             -- When only package items exist
//                             WHEN COALESCE(package_item_counts.total_items, 0) > 0 THEN
//                                 CASE 
//                                     WHEN COALESCE(package_item_counts.packed_items, 0) = 0 THEN 'Pending'
//                                     WHEN COALESCE(package_item_counts.packed_items, 0) > 0 AND 
//                                          COALESCE(package_item_counts.packed_items, 0) < COALESCE(package_item_counts.total_items, 0) THEN 'Opened'
//                                     WHEN COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
//                                     ELSE 'Pending'
//                                 END

//                             -- When no items exist (shouldn't happen for package orders)
//                             ELSE 'Pending'
//                         END
//                     ELSE 'Pending'
//                 END AS selectedStatus

//             FROM 
//                 distributedtarget dt
//             INNER JOIN 
//                 distributedtargetitems dti ON dt.id = dti.targetId
//             INNER JOIN 
//                 market_place.processorders po ON dti.orderId = po.id
//             INNER JOIN 
//                 market_place.orders o ON po.orderId = o.id
//             LEFT JOIN (
//                 -- Additional items subquery
//                 SELECT 
//                     orderId,
//                     COUNT(*) as total_items,
//                     SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
//                     SUM(CASE WHEN isPacked = 0 THEN 1 ELSE 0 END) as pending_items
//                 FROM 
//                     market_place.orderadditionalitems
//                 GROUP BY 
//                     orderId
//             ) additional_item_counts ON o.id = additional_item_counts.orderId
//             LEFT JOIN (
//                 -- Package items subquery - correctly joined to processorders.id
//                 SELECT 
//                     op.orderId,  -- This references processorders.id
//                     op.isLock,
//                     op.packingStatus,
//                     op.packageId,
//                     COUNT(opi.id) as total_items,
//                     SUM(CASE WHEN opi.isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
//                     SUM(CASE WHEN opi.isPacked = 0 THEN 1 ELSE 0 END) as pending_items
//                 FROM 
//                     market_place.orderpackage op
//                 LEFT JOIN 
//                     market_place.orderpackageitems opi ON op.id = opi.orderPackageId
//                 GROUP BY 
//                     op.orderId, op.isLock, op.packingStatus, op.packageId
//             ) package_item_counts ON po.id = package_item_counts.orderId  -- Correct join to processorders
//             WHERE 
//                 dt.userId = ?
//                 AND DATE(dt.createdAt) = CURDATE()
//             ORDER BY 
//                 dt.companycenterId ASC,
//                 dt.userId DESC,
//                 dt.target ASC,
//                 dt.complete ASC,
//                 o.id ASC
//         `;

//         // Execute the query
//         db.collectionofficer.query(sql, [officerId], (err, results) => {
//             if (err) {
//                 console.error("Error executing query:", err);
//                 return reject(err);
//             }

//             console.log("Targets found:", results.length);
//             if (results.length > 0) {
//                 console.log("=== DEBUGGING DATA ===");

//                 // Log first 3 records for debugging
//                 results.slice(0, 3).forEach((row, index) => {
//                     console.log(`Record ${index + 1}:`, {
//                         distributedTargetId: row.distributedTargetId,
//                         processOrderId: row.processOrderId,
//                         orderId: row.orderId,
//                         isPackage: row.isPackage,
//                         packageData: {
//                             packageId: row.packageId,
//                             isLock: row.packageIsLock,
//                             items: {
//                                 total: row.totalPackageItems,
//                                 packed: row.packedPackageItems,
//                                 pending: row.pendingPackageItems,
//                                 status: row.packageItemStatus
//                             }
//                         },
//                         additionalItems: {
//                             total: row.totalAdditionalItems,
//                             packed: row.packedAdditionalItems,
//                             pending: row.pendingAdditionalItems,
//                             status: row.additionalItemStatus
//                         },
//                         overallStatus: row.selectedStatus
//                     });
//                 });

//                 // Status summary
//                 const statusCounts = results.reduce((acc, row) => {
//                     acc[row.selectedStatus] = (acc[row.selectedStatus] || 0) + 1;
//                     return acc;
//                 }, {});
//                 console.log("Status Distribution:", statusCounts);

//                 console.log("=== END DEBUGGING ===");
//             }

//             resolve(results);
//         });
//     });
// };

exports.getDistributionOfficerTarget = (officerId) => {
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

                -- Package item counts (aggregated for ALL packages of this order)
                COALESCE(package_item_counts.total_items, 0) AS totalPackageItems,
                COALESCE(package_item_counts.packed_items, 0) AS packedPackageItems,
                COALESCE(package_item_counts.pending_items, 0) AS pendingPackageItems,
                COALESCE(package_item_counts.total_packages, 0) AS totalPackages,

                -- Package item status (considering all packages)
                CASE 
                    WHEN o.isPackage = 0 THEN NULL
                    WHEN COALESCE(package_item_counts.total_items, 0) = 0 THEN 'Pending'
                    WHEN COALESCE(package_item_counts.packed_items, 0) = 0 THEN 'Pending'
                    WHEN COALESCE(package_item_counts.packed_items, 0) > 0 AND 
                         COALESCE(package_item_counts.packed_items, 0) < COALESCE(package_item_counts.total_items, 0) THEN 'Opened'
                    WHEN COALESCE(package_item_counts.packed_items, 0) = COALESCE(package_item_counts.total_items, 0) THEN 'Completed'
                    ELSE NULL
                END AS packageItemStatus,

                -- Overall status - considering all items across all packages
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
                    
                    -- For package orders (check both additional and package items - ALL packages combined)
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
                            
                            -- When only package items exist (across all packages)
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
                -- Package items subquery - FIXED: Aggregate ALL packages for each processorder
                SELECT 
                    op.orderId,  -- This references processorders.id
                    COUNT(DISTINCT op.id) as total_packages,  -- Count total packages
                    SUM(COALESCE(package_items.total_items, 0)) as total_items,
                    SUM(COALESCE(package_items.packed_items, 0)) as packed_items,
                    SUM(COALESCE(package_items.pending_items, 0)) as pending_items
                FROM 
                    market_place.orderpackage op
                LEFT JOIN (
                    -- Get item counts for each package
                    SELECT 
                        orderPackageId,
                        COUNT(id) as total_items,
                        SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
                        SUM(CASE WHEN isPacked = 0 THEN 1 ELSE 0 END) as pending_items
                    FROM 
                        market_place.orderpackageitems
                    GROUP BY 
                        orderPackageId
                ) package_items ON op.id = package_items.orderPackageId
                GROUP BY 
                    op.orderId  -- Group by processorders.id to get one row per order
            ) package_item_counts ON po.id = package_item_counts.orderId
            WHERE 
                dt.userId = ?
                AND (
                    -- Last 3 days: get all data without filtering
                    DATE(dt.createdAt) >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
                    OR 
                    -- Older than 3 days: only incomplete orders
                    (DATE(dt.createdAt) < DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND (dti.isComplete IS NULL OR dti.isComplete = 0))
                )
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

            console.log("Targets found (3 days all data + older incomplete):", results.length);
            if (results.length > 0) {
                console.log("=== DEBUGGING DATA (3 DAYS ALL + OLDER INCOMPLETE) ===");

                // Log first 3 records for debugging
                results.slice(0, 3).forEach((row, index) => {
                    console.log(`Record ${index + 1}:`, {
                        distributedTargetId: row.distributedTargetId,
                        distributedTargetItemId: row.distributedTargetItemId,
                        isComplete: row.isComplete,
                        createdDate: row.targetCreatedAt, // Show the date for verification
                        processOrderId: row.processOrderId,
                        orderId: row.orderId,
                        isPackage: row.isPackage,
                        packageData: {
                            totalPackages: row.totalPackages,
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
                console.log("Status Distribution (3 days all + older incomplete):", statusCounts);

                // Completion status summary
                const completionCounts = results.reduce((acc, row) => {
                    const status = row.isComplete === null ? 'NULL' : row.isComplete.toString();
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {});
                console.log("Completion Status Distribution:", completionCounts);

                // Date-wise summary
                const dateCounts = results.reduce((acc, row) => {
                    const date = new Date(row.targetCreatedAt).toISOString().split('T')[0];
                    acc[date] = (acc[date] || 0) + 1;
                    return acc;
                }, {});
                console.log("Date-wise Distribution:", dateCounts);

                console.log("=== END DEBUGGING ===");
            }

            resolve(results);
        });
    });
};



exports.getAllDistributionOfficer = async (managerId) => {
    try {
        // Query to get manager details
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

        // Query to get distribution officers under this manager
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

        // Execute both queries
        const [managerRows] = await db.collectionofficer.promise().query(managerQuery, [managerId]);
        const [officerRows] = await db.collectionofficer.promise().query(officersQuery, [managerId]);

        // Combine both arrays into single array
        const allData = [];

        // Add manager first if exists
        if (managerRows.length > 0) {
            allData.push(managerRows[0]);
        }

        // Add all distribution officers
        allData.push(...officerRows);

        return allData;
    } catch (error) {
        console.error('Error in getAllDistributionOfficer DAO:', error);
        throw error;
    }
};



// Updated targetPass function
exports.targetPass = async (params) => {
    console.log("targetPass DAO called with params:", params);

    try {
        const { assigneeOfficerId, targetItems, invoiceNumbers, processOrderId, officerId } = params;

        // Validate that processOrderId is an array
        if (!Array.isArray(processOrderId) || processOrderId.length === 0) {
            return {
                success: false,
                message: 'processOrderId must be a non-empty array'
            };
        }

        // Step 1: Get the id from distributedtarget table using assigneeOfficerId as userId
        // This id will be used as the new targetId in distributedtargetitems table
        const distributedTargetQuery = `
            SELECT id, userId FROM collection_officer.distributedtarget 
            WHERE userId = ? 
            ORDER BY companycenterId ASC, userId DESC, target ASC, complete ASC 
            LIMIT 1
        `;

        const distributedTargetResult = await db.collectionofficer.promise().query(distributedTargetQuery, [parseInt(assigneeOfficerId)]);

        console.log(`Query result for assigneeOfficerId ${assigneeOfficerId}:`, distributedTargetResult);

        // MySQL2 returns [rows, fields] - we need the first element (rows)
        const rows = distributedTargetResult[0];

        if (!rows || rows.length === 0) {
            return {
                success: false,
                message: `Assignee officer not found in distributed targets: ${assigneeOfficerId}`
            };
        }

        const newTargetId = parseInt(rows[0].id); // Ensure it's an integer
        const userId = rows[0].userId;
        console.log(`New Target ID (from distributedtarget.id): ${newTargetId}, User ID: ${userId}`);

        // Step 2: Process each processOrderId
        const results = [];
        const errors = [];

        for (const orderId of processOrderId) {
            try {
                const orderIdInt = parseInt(orderId); // Ensure it's an integer
                console.log(`Processing order ID: ${orderIdInt}`);

                // Check if orderId exists in distributedtargetitems table
                const checkOrderQuery = `
                    SELECT id, targetId, orderId FROM collection_officer.distributedtargetitems 
                    WHERE orderId = ?
                `;

                const existingRecords = await db.collectionofficer.promise().query(checkOrderQuery, [orderIdInt]);

                // MySQL2 returns [rows, fields] - we need the first element (rows)
                const existingRows = existingRecords[0];

                if (!existingRows || existingRows.length === 0) {
                    errors.push(`No records found for order ID: ${orderIdInt}`);
                    continue;
                }

                console.log(`Found ${existingRows.length} records for order ID: ${orderIdInt}`);
                console.log(`Current targetId for order ${orderIdInt}:`, existingRows[0].targetId);

                // Update distributedtargetitems table - change targetId for matching orderId
                const updateQuery = `
                    UPDATE collection_officer.distributedtargetitems 
                    SET targetId = ? 
                    WHERE orderId = ?
                `;

                console.log(`Executing update query: UPDATE distributedtargetitems SET targetId = ${newTargetId} WHERE orderId = ${orderIdInt}`);

                const updateResult = await db.collectionofficer.promise().query(updateQuery, [newTargetId, orderIdInt]);

                console.log(`Update result:`, updateResult);

                if (updateResult.affectedRows === 0) {
                    errors.push(`No records updated for order ID: ${orderIdInt}`);
                    continue;
                }

                console.log(`Updated ${updateResult.affectedRows} records for order ID: ${orderIdInt}`);

                // Get updated records for response - let's check what was actually updated
                const updatedRecordsQuery = `
                    SELECT id, targetId, orderId FROM collection_officer.distributedtargetitems 
                    WHERE orderId = ?
                    ORDER BY id ASC
                `;

                const updatedRecords = await db.collectionofficer.promise().query(updatedRecordsQuery, [orderIdInt]);

                // MySQL2 returns [rows, fields] - we need the first element (rows)
                const updatedRows = updatedRecords[0];
                console.log(`Updated records for order ID ${orderIdInt}:`, updatedRows);

                // Add successful result
                results.push({
                    orderId: orderIdInt,
                    previousTargetId: existingRows[0].targetId || 'NULL',
                    newTargetId: newTargetId,
                    assigneeOfficerId: assigneeOfficerId,
                    assigneeUserId: userId,
                    updatedRecords: updatedRows,
                    affectedRows: updateResult.affectedRows
                });

                console.log(`Successfully processed order ID ${orderIdInt}: ${existingRows[0].targetId || 'NULL'} -> ${newTargetId}`);

            } catch (orderError) {
                console.error(`Error processing order ID ${orderId}:`, orderError);
                errors.push(`Failed to process order ID ${orderId}: ${orderError.message}`);
            }
        }

        // Prepare response
        const response = {
            success: results.length > 0,
            message: results.length > 0 ? 'Target passed successfully' : 'No targets were passed',
            data: {
                officerId: officerId,
                assigneeOfficerId: assigneeOfficerId,
                newTargetId: newTargetId,
                processedOrders: results.length,
                totalOrders: processOrderId.length,
                targetItems: targetItems,
                invoiceNumbers: invoiceNumbers,
                results: results
            }
        };

        if (errors.length > 0) {
            response.errors = errors;
            response.message += ` (${errors.length} error(s) occurred)`;
        }

        console.log("DAO returning:", response);
        return response;

    } catch (error) {
        console.error('Error in targetPass DAO:', error);
        return {
            success: false,
            message: 'Database operation failed',
            error: error.message
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


// exports.getDistributionPaymentsSummary = async ({ collectionOfficerId, fromDate, toDate }) => {
//     const sql = `
//     SELECT 
//         DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30')) AS date,
//         COUNT(dti.id) AS completedOrders,
//         SUM(COALESCE(po.amount, 0)) AS totalAmount,
//         po.invNo AS invNo
//     FROM 
//         collection_officer.distributedtarget dt
//     JOIN 
//         collection_officer.distributedtargetitems dti ON dt.id = dti.targetId
//     JOIN 
//         market_place.processorders po ON po.id = dti.orderId
//     WHERE 
//         dt.userId = ?
//         AND dti.isComplete = 1
//         AND dti.completeTime IS NOT NULL
//         AND DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30')) BETWEEN ? AND ?
//     GROUP BY 
//         DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30'))
//     ORDER BY 
//         DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30'));
//     `;
//     return db.collectionofficer.promise().query(sql, [collectionOfficerId, fromDate, toDate]);
// };

exports.getDistributionPaymentsSummary = async ({ collectionOfficerId, fromDate, toDate }) => {
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
    return db.collectionofficer.promise().query(sql, [collectionOfficerId, fromDate, toDate]);
};


// exports.getOfficerSummaryDaoManager = async (collectionOfficerId) => {
//     try {
//         const query = `
//             SELECT 
//                 COUNT(*) AS totalTasks,
//                 SUM(CASE WHEN complete >= target THEN 1 ELSE 0 END) AS completedTasks
//             FROM distributedtarget
//             WHERE userId = ?;
//         `;

//         const [results] = await db.collectionofficer.promise().query(query, [collectionOfficerId]);
//         return results[0];

//     } catch (error) {
//         console.error("Database error in getOfficerSummaryDao:", error);
//         throw error;
//     }
// };

exports.getOfficerSummaryDaoManager = async (collectionOfficerId) => {
    try {
        const query = `
            SELECT 
                COUNT(*) AS totalTasks,
                SUM(CASE WHEN complete >= target THEN 1 ELSE 0 END) AS completedTasks,
                COALESCE(SUM(complete), 0) AS totalComplete,
                COALESCE(SUM(target), 0) AS totalTarget
            FROM distributedtarget 
            WHERE userId = ? AND target > 0;
        `;

        const [results] = await db.collectionofficer.promise().query(query, [collectionOfficerId]);

        // Handle case where no results found
        if (!results || results.length === 0) {
            return {
                totalTasks: 0,
                completedTasks: 0,
                totalComplete: 0,
                totalTarget: 0
            };
        }

        return {
            totalTasks: parseInt(results[0].totalTasks) || 0,
            completedTasks: parseInt(results[0].completedTasks) || 0,
            totalComplete: parseInt(results[0].totalComplete) || 0,
            totalTarget: parseInt(results[0].totalTarget) || 0
        };

    } catch (error) {
        console.error("Database error in getOfficerSummaryDao:", error);
        throw new Error(`Database operation failed: ${error.message}`);
    }
};



// exports.getOrderById = async (orderId) => {
//     let connection;

//     try {
//         // Get connection from pool
//         connection = await db.marketPlace.promise().getConnection();
//         console.log('Database connection acquired');

//         // First, get the basic order information
//         const orderSql = `
//             SELECT
//                 o.id AS orderId,
//                 o.userId,
//                 o.sheduleType,
//                 o.sheduleDate,
//                 o.sheduleTime,
//                 o.createdAt,
//                 o.total,
//                 o.buildingType AS orderBuildingType,
//                 o.discount,
//                 o.fullTotal,
//                 o.isPackage,
//                 c.title,
//                 c.firstName,
//                 c.lastName,
//                 c.phoneNumber,
//                 c.buildingType AS userBuildingType,
//                 c.email,
//                 p.invNo AS invoiceNumber,
//                 p.status As status,
//                 p.reportStatus As reportStatus,
//                 p.id AS processOrderId
//             FROM orders o
//             JOIN marketplaceusers c ON o.userId = c.id
//             LEFT JOIN processorders p ON o.id = p.orderId
//             WHERE o.id = ?
//         `;

//         const [orderResults] = await connection.execute(orderSql, [orderId]);
//         console.log("Order results:", orderResults);

//         if (orderResults.length === 0) {
//             return { message: 'No order found with the given ID' };
//         }

//         const order = orderResults[0];

//         // IMPORTANT: Use the correct variable names from the SQL query
//         const buildingType = order.orderBuildingType || order.userBuildingType;

//         console.log("=== BUILDING TYPE DEBUG ===");
//         console.log("Order building type (from orders table):", order.orderBuildingType);
//         console.log("User building type (from users table):", order.userBuildingType);
//         console.log("Final building type being used:", buildingType);
//         console.log("========================");

//         let formattedAddress = '';

//         // Handle address based on building type using correct tables
//         if (buildingType === 'House') {
//             console.log("✅ Processing HOUSE building type for order", orderId);

//             const addressSql = `
//                 SELECT
//                     houseNo,
//                     streetName,
//                     city
//                 FROM orderhouse
//                 WHERE orderId = ?
//             `;

//             const [addressResults] = await connection.execute(addressSql, [orderId]);
//             console.log("House address results:", addressResults);

//             if (addressResults[0]) {
//                 const addr = addressResults[0];
//                 formattedAddress = `${addr.houseNo || ''}, ${addr.streetName || ''}, ${addr.city || ''}`.trim();
//                 // Clean up extra spaces and commas
//                 formattedAddress = formattedAddress.replace(/^,\s*/, '').replace(/,\s*$/, '').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
//                 console.log("✅ House address found:", formattedAddress);
//             } else {
//                 console.log("❌ No house address found for orderId:", orderId);
//             }

//         } else if (buildingType === 'Apartment') {
//             console.log("✅ Processing APARTMENT building type for order", orderId);

//             const addressSql = `
//                 SELECT
//                     buildingNo,
//                     buildingName,
//                     unitNo,
//                     floorNo,
//                     houseNo,
//                     streetName,
//                     city
//                 FROM orderapartment
//                 WHERE orderId = ?
//             `;

//             const [addressResults] = await connection.execute(addressSql, [orderId]);
//             console.log("Apartment address results:", addressResults);

//             if (addressResults[0]) {
//                 const addr = addressResults[0];
//                 // Build address parts array to handle empty values better
//                 const addressParts = [];

//                 if (addr.buildingName) addressParts.push(addr.buildingName);
//                 if (addr.buildingNo) addressParts.push(addr.buildingNo);
//                 if (addr.unitNo) addressParts.push(`Unit ${addr.unitNo}`);
//                 if (addr.floorNo) addressParts.push(`Floor ${addr.floorNo}`);
//                 if (addr.houseNo) addressParts.push(addr.houseNo);
//                 if (addr.streetName) addressParts.push(addr.streetName);
//                 if (addr.city) addressParts.push(addr.city);

//                 formattedAddress = addressParts.join(', ');
//                 console.log("✅ Apartment address found:", formattedAddress);
//             } else {
//                 console.log("❌ No apartment address found for orderId:", orderId);
//             }
//         } else {
//             console.log("❌ Unknown building type:", buildingType);
//         }

//         console.log("Final formatted address:", `"${formattedAddress}"`);

//         // Get additional items
//         const additionalItemsSql = `
//             SELECT
//                 oai.qty,
//                 oai.productId,
//                 oai.unit,
//                 oai.price,
//                 oai.discount AS itemDiscount
//             FROM orderadditionalitems oai
//             WHERE oai.orderId = ?
//         `;

//         const [additionalItemsResults] = await connection.execute(additionalItemsSql, [orderId]);

//         // Filter out null/undefined items and create additional items array
//         const additionalItems = additionalItemsResults
//             .filter(item => item.productId !== null && item.productId !== undefined)
//             .map(item => ({
//                 productId: item.productId,
//                 qty: parseFloat(item.qty) || 0,
//                 unit: item.unit || '',
//                 price: parseFloat(item.price) || 0,
//                 discount: parseFloat(item.itemDiscount) || 0
//             }));

//         // Get ALL packages for this order
//         let allPackages = [];
//         const processOrderId = order.processOrderId;

//         if (order.isPackage === 1 && processOrderId) {
//             console.log("This is a package order, processOrderId:", processOrderId);

//             // Get all packages for this order
//             const packagesSql = `
//                 SELECT
//                     op.id AS orderPackageId,
//                     op.packageId,
//                     mpp.displayName AS packageDisplayName,
//                     mpp.productPrice AS packagePrice,
//                     mpp.packingFee AS packagePackingFee,
//                     mpp.serviceFee AS packageServiceFee,
//                     mpp.status AS packageStatus,
//                     op.packingStatus,
//                     op.isLock,
//                     op.createdAt AS packageCreatedAt
//                 FROM orderpackage op
//                 LEFT JOIN marketplacepackages mpp ON mpp.id = op.packageId
//                 WHERE op.orderId = ?
//                 ORDER BY op.id ASC
//             `;

//             const [packagesResults] = await connection.execute(packagesSql, [processOrderId]);
//             console.log("All packages query results:", packagesResults);

//             // For each package, get its items
//             for (const packageData of packagesResults) {
//                 console.log("Processing package:", packageData.orderPackageId);

//                 const packageItemsSql = `
//                     SELECT
//                         opi.id,
//                         opi.orderPackageId,
//                         opi.productType,
//                         opi.productId,
//                         opi.qty,
//                         opi.price,
//                         opi.isPacked,
//                         pt.typeName AS productTypeName,
//                         mi.displayName AS productDisplayName,
//                         mi.varietyId,
//                         mi.category,
//                         mi.normalPrice,
//                         mi.discountedPrice
//                     FROM orderpackageitems opi
//                     JOIN producttypes pt ON pt.id = opi.productType
//                     LEFT JOIN marketplaceitems mi ON mi.id = opi.productId
//                     WHERE opi.orderPackageId = ?
//                     ORDER BY opi.id ASC
//                 `;

//                 const [packageItemsResults] = await connection.execute(packageItemsSql, [packageData.orderPackageId]);
//                 console.log(`Package items for package ${packageData.orderPackageId}:`, packageItemsResults);

//                 const packageItems = packageItemsResults.map(item => ({
//                     id: item.id,
//                     orderPackageId: item.orderPackageId,
//                     productType: item.productType,
//                     productTypeName: item.productTypeName,
//                     productId: item.productId,
//                     productDisplayName: item.productDisplayName || 'N/A',
//                     varietyId: item.varietyId,
//                     category: item.category,
//                     normalPrice: item.normalPrice,
//                     discountedPrice: item.discountedPrice,
//                     qty: parseFloat(item.qty) || 0,
//                     price: parseFloat(item.price) || 0,
//                     isPacked: item.isPacked
//                 }));

//                 // Create package info object
//                 const packageInfo = {
//                     packageId: packageData.packageId,
//                     orderPackageId: packageData.orderPackageId,
//                     displayName: packageData.packageDisplayName,
//                     productPrice: parseFloat(packageData.packagePrice) || 0,
//                     packingFee: parseFloat(packageData.packagePackingFee) || 0,
//                     serviceFee: parseFloat(packageData.packageServiceFee) || 0,
//                     status: packageData.packageStatus,
//                     packingStatus: packageData.packingStatus,
//                     isLock: packageData.isLock,
//                     packageCreatedAt: packageData.packageCreatedAt,
//                     packageItems: packageItems
//                 };

//                 allPackages.push(packageInfo);
//             }
//         }

//         // Get product details for additional items if they exist
//         let enhancedAdditionalItems = [];
//         if (additionalItems.length > 0) {
//             const productIds = additionalItems.map(item => item.productId);
//             const placeholders = productIds.map(() => '?').join(',');

//             const productDetailsSql = `
//                 SELECT
//                     mi.id,
//                     mi.displayName,
//                     mi.varietyId,
//                     mi.category,
//                     mi.normalPrice,
//                     mi.discountedPrice
//                 FROM marketplaceitems mi
//                 WHERE mi.id IN (${placeholders})
//             `;

//             const [productResults] = await connection.execute(productDetailsSql, productIds);

//             // Map additional items with product details
//             enhancedAdditionalItems = additionalItems.map(item => {
//                 const productDetail = productResults.find(p => p.id === item.productId);
//                 return {
//                     ...item,
//                     displayName: productDetail ? productDetail.displayName : 'Unknown Product',
//                     varietyId: productDetail ? productDetail.varietyId : null,
//                     category: productDetail ? productDetail.category : null,
//                     normalPrice: productDetail ? productDetail.normalPrice : null,
//                     discountedPrice: productDetail ? productDetail.discountedPrice : null
//                 };
//             });
//         }

//         console.log("All packages:", allPackages);
//         console.log("Enhanced Additional Items:", enhancedAdditionalItems);
//         console.log("Order isPackage:", order.isPackage);

//         // Return order data
//         const result = {
//             orderId: order.orderId,
//             userId: order.userId,
//             scheduleType: order.sheduleType,
//             scheduleDate: order.sheduleDate,
//             scheduleTime: order.sheduleTime,
//             createdAt: order.createdAt,
//             total: parseFloat(order.total) || 0,
//             discount: parseFloat(order.discount) || 0,
//             fullTotal: parseFloat(order.fullTotal) || 0,
//             isPackage: order.isPackage,
//             customerInfo: {
//                 title: order.title,
//                 firstName: order.firstName,
//                 lastName: order.lastName,
//                 phoneNumber: order.phoneNumber,
//                 buildingType: buildingType, // Now using the correct variable
//                 email: order.email
//             },
//             fullAddress: formattedAddress,
//             orderStatus: {
//                 invoiceNumber: order.invoiceNumber,
//                 status: order.status,
//                 reportStatus: order.reportStatus
//             },
//             additionalItems: enhancedAdditionalItems,
//             packages: allPackages
//         };

//         return result;

//     } catch (err) {
//         console.error('Database error:', err);
//         throw err;
//     } finally {
//         // Always release the connection back to the pool
//         if (connection) {
//             connection.release();
//             console.log('Database connection released');
//         }
//     }
// };

// exports.getOrderById = async (orderId) => {
//     let connection;

//     try {
//         // Get connection from pool
//         connection = await db.marketPlace.promise().getConnection();
//         console.log('Database connection acquired');

//         // First, get the basic order information with orderApp
//         const orderSql = `
//             SELECT
//                 o.id AS orderId,
//                 o.userId,
//                 o.orderApp,
//                 o.sheduleType,
//                 o.sheduleDate,
//                 o.sheduleTime,
//                 o.createdAt,
//                 o.total,
//                 o.buildingType AS orderBuildingType,
//                 o.discount,
//                 o.fullTotal,
//                 o.isPackage AS orderIsPackage,
//                 o.isCoupon,
//                 o.couponValue,
//                 c.title,
//                 c.firstName,
//                 c.lastName,
//                 c.phoneNumber,
//                 c.buildingType AS userBuildingType,
//                 c.email
//             FROM orders o
//             JOIN marketplaceusers c ON o.userId = c.id
//             WHERE o.id = ?
//         `;

//         const [orderResults] = await connection.execute(orderSql, [orderId]);
//         console.log("Order results:", orderResults);

//         if (orderResults.length === 0) {
//             return { message: 'No order found with the given ID' };
//         }

//         const order = orderResults[0];

//         console.log("=== ORDER APP DEBUG ===");
//         console.log("Order App:", order.orderApp);
//         console.log("Order isPackage (from orders table):", order.orderIsPackage);
//         console.log("isCoupon:", order.isCoupon);
//         console.log("couponValue:", order.couponValue);
//         console.log("========================");

//         let finalIsPackage = 0;
//         let processOrderId = null;
//         let invoiceNumber = null;
//         let orderStatus = null;
//         let reportStatus = null;

//         // Handle logic based on orderApp
//         if (order.orderApp === 'Marketplace') {
//             console.log("✅ Processing MARKETPLACE order");

//             // For Marketplace orders, use the isPackage from orders table
//             finalIsPackage = order.orderIsPackage || 0;

//             // Get process order info for Marketplace orders
//             const processOrderSql = `
//                 SELECT 
//                     id AS processOrderId,
//                     invNo AS invoiceNumber,
//                     status,
//                     reportStatus
//                 FROM processorders 
//                 WHERE orderId = ?
//             `;

//             const [processOrderResults] = await connection.execute(processOrderSql, [orderId]);

//             if (processOrderResults.length > 0) {
//                 const processOrder = processOrderResults[0];
//                 processOrderId = processOrder.processOrderId;
//                 invoiceNumber = processOrder.invoiceNumber;
//                 orderStatus = processOrder.status;
//                 reportStatus = processOrder.reportStatus;
//             }

//         } else if (order.orderApp === 'Dash') {
//             console.log("✅ Processing DASH order");

//             // For Dash orders, first get processorder
//             const processOrderSql = `
//                 SELECT 
//                     id AS processOrderId,
//                     invNo AS invoiceNumber,
//                     status,
//                     reportStatus
//                 FROM processorders 
//                 WHERE orderId = ?
//             `;

//             const [processOrderResults] = await connection.execute(processOrderSql, [orderId]);

//             if (processOrderResults.length > 0) {
//                 const processOrder = processOrderResults[0];
//                 processOrderId = processOrder.processOrderId;
//                 invoiceNumber = processOrder.invoiceNumber;
//                 orderStatus = processOrder.status;
//                 reportStatus = processOrder.reportStatus;

//                 // Check if this processOrder has packages in orderpackage table
//                 const packageCheckSql = `
//                     SELECT COUNT(*) as packageCount
//                     FROM orderpackage 
//                     WHERE orderId = ?
//                 `;

//                 const [packageCheckResults] = await connection.execute(packageCheckSql, [processOrderId]);

//                 if (packageCheckResults[0].packageCount > 0) {
//                     finalIsPackage = 1;
//                     console.log("✅ Dash order has packages - setting isPackage = 1");
//                 } else {
//                     finalIsPackage = 0;
//                     console.log("✅ Dash order has no packages - setting isPackage = 0");
//                 }
//             }
//         }

//         console.log("Final isPackage value:", finalIsPackage);
//         console.log("Process Order ID:", processOrderId);

//         // Use the correct variable names from the SQL query
//         const buildingType = order.orderBuildingType || order.userBuildingType;

//         console.log("=== BUILDING TYPE DEBUG ===");
//         console.log("Order building type (from orders table):", order.orderBuildingType);
//         console.log("User building type (from users table):", order.userBuildingType);
//         console.log("Final building type being used:", buildingType);
//         console.log("========================");

//         let formattedAddress = '';

//         // Handle address based on building type using correct tables
//         if (buildingType === 'House') {
//             console.log("✅ Processing HOUSE building type for order", orderId);

//             const addressSql = `
//                 SELECT
//                     houseNo,
//                     streetName,
//                     city
//                 FROM orderhouse
//                 WHERE orderId = ?
//             `;

//             const [addressResults] = await connection.execute(addressSql, [orderId]);
//             console.log("House address results:", addressResults);

//             if (addressResults[0]) {
//                 const addr = addressResults[0];
//                 formattedAddress = `${addr.houseNo || ''}, ${addr.streetName || ''}, ${addr.city || ''}`.trim();
//                 // Clean up extra spaces and commas
//                 formattedAddress = formattedAddress.replace(/^,\s*/, '').replace(/,\s*$/, '').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
//                 console.log("✅ House address found:", formattedAddress);
//             } else {
//                 console.log("❌ No house address found for orderId:", orderId);
//             }

//         } else if (buildingType === 'Apartment') {
//             console.log("✅ Processing APARTMENT building type for order", orderId);

//             const addressSql = `
//                 SELECT
//                     buildingNo,
//                     buildingName,
//                     unitNo,
//                     floorNo,
//                     houseNo,
//                     streetName,
//                     city
//                 FROM orderapartment
//                 WHERE orderId = ?
//             `;

//             const [addressResults] = await connection.execute(addressSql, [orderId]);
//             console.log("Apartment address results:", addressResults);

//             if (addressResults[0]) {
//                 const addr = addressResults[0];
//                 // Build address parts array to handle empty values better
//                 const addressParts = [];

//                 if (addr.buildingName) addressParts.push(addr.buildingName);
//                 if (addr.buildingNo) addressParts.push(addr.buildingNo);
//                 if (addr.unitNo) addressParts.push(`Unit ${addr.unitNo}`);
//                 if (addr.floorNo) addressParts.push(`Floor ${addr.floorNo}`);
//                 if (addr.houseNo) addressParts.push(addr.houseNo);
//                 if (addr.streetName) addressParts.push(addr.streetName);
//                 if (addr.city) addressParts.push(addr.city);

//                 formattedAddress = addressParts.join(', ');
//                 console.log("✅ Apartment address found:", formattedAddress);
//             } else {
//                 console.log("❌ No apartment address found for orderId:", orderId);
//             }
//         } else {
//             console.log("❌ Unknown building type:", buildingType);
//         }

//         console.log("Final formatted address:", `"${formattedAddress}"`);

//         // Get additional items
//         const additionalItemsSql = `
//             SELECT
//                 oai.qty,
//                 oai.productId,
//                 oai.unit,
//                 oai.price,
//                 oai.discount AS itemDiscount
//             FROM orderadditionalitems oai
//             WHERE oai.orderId = ?
//         `;

//         const [additionalItemsResults] = await connection.execute(additionalItemsSql, [orderId]);

//         // Filter out null/undefined items and create additional items array
//         const additionalItems = additionalItemsResults
//             .filter(item => item.productId !== null && item.productId !== undefined)
//             .map(item => ({
//                 productId: item.productId,
//                 qty: parseFloat(item.qty) || 0,
//                 unit: item.unit || '',
//                 price: parseFloat(item.price) || 0,
//                 discount: parseFloat(item.itemDiscount) || 0
//             }));

//         // Get ALL packages for this order (only if finalIsPackage = 1 and processOrderId exists)
//         let allPackages = [];

//         if (finalIsPackage === 1 && processOrderId) {
//             console.log("This is a package order, processOrderId:", processOrderId);

//             // Get all packages for this order using processOrderId
//             const packagesSql = `
//                 SELECT
//                     op.id AS orderPackageId,
//                     op.packageId,
//                     mpp.displayName AS packageDisplayName,
//                     mpp.productPrice AS packagePrice,
//                     mpp.packingFee AS packagePackingFee,
//                     mpp.serviceFee AS packageServiceFee,
//                     mpp.status AS packageStatus,
//                     op.packingStatus,
//                     op.isLock,
//                     op.createdAt AS packageCreatedAt
//                 FROM orderpackage op
//                 LEFT JOIN marketplacepackages mpp ON mpp.id = op.packageId
//                 WHERE op.orderId = ?
//                 ORDER BY op.id ASC
//             `;

//             const [packagesResults] = await connection.execute(packagesSql, [processOrderId]);
//             console.log("All packages query results:", packagesResults);

//             // For each package, get its items
//             for (const packageData of packagesResults) {
//                 console.log("Processing package:", packageData.orderPackageId);

//                 const packageItemsSql = `
//                     SELECT
//                         opi.id,
//                         opi.orderPackageId,
//                         opi.productType,
//                         opi.productId,
//                         opi.qty,
//                         opi.price,
//                         opi.isPacked,
//                         pt.typeName AS productTypeName,
//                         mi.displayName AS productDisplayName,
//                         mi.varietyId,
//                         mi.category,
//                         mi.normalPrice,
//                         mi.discountedPrice
//                     FROM orderpackageitems opi
//                     JOIN producttypes pt ON pt.id = opi.productType
//                     LEFT JOIN marketplaceitems mi ON mi.id = opi.productId
//                     WHERE opi.orderPackageId = ?
//                     ORDER BY opi.id ASC
//                 `;

//                 const [packageItemsResults] = await connection.execute(packageItemsSql, [packageData.orderPackageId]);
//                 console.log(`Package items for package ${packageData.orderPackageId}:`, packageItemsResults);

//                 const packageItems = packageItemsResults.map(item => ({
//                     id: item.id,
//                     orderPackageId: item.orderPackageId,
//                     productType: item.productType,
//                     productTypeName: item.productTypeName,
//                     productId: item.productId,
//                     productDisplayName: item.productDisplayName || 'N/A',
//                     varietyId: item.varietyId,
//                     category: item.category,
//                     normalPrice: item.normalPrice,
//                     discountedPrice: item.discountedPrice,
//                     qty: parseFloat(item.qty) || 0,
//                     price: parseFloat(item.price) || 0,
//                     isPacked: item.isPacked
//                 }));

//                 // Create package info object
//                 const packageInfo = {
//                     packageId: packageData.packageId,
//                     orderPackageId: packageData.orderPackageId,
//                     displayName: packageData.packageDisplayName,
//                     productPrice: parseFloat(packageData.packagePrice) || 0,
//                     packingFee: parseFloat(packageData.packagePackingFee) || 0,
//                     serviceFee: parseFloat(packageData.packageServiceFee) || 0,
//                     status: packageData.packageStatus,
//                     packingStatus: packageData.packingStatus,
//                     isLock: packageData.isLock,
//                     packageCreatedAt: packageData.packageCreatedAt,
//                     packageItems: packageItems
//                 };

//                 allPackages.push(packageInfo);
//             }
//         }

//         // Get product details for additional items if they exist
//         let enhancedAdditionalItems = [];
//         if (additionalItems.length > 0) {
//             const productIds = additionalItems.map(item => item.productId);
//             const placeholders = productIds.map(() => '?').join(',');

//             const productDetailsSql = `
//                 SELECT
//                     mi.id,
//                     mi.displayName,
//                     mi.varietyId,
//                     mi.category,
//                     mi.normalPrice,
//                     mi.discountedPrice
//                 FROM marketplaceitems mi
//                 WHERE mi.id IN (${placeholders})
//             `;

//             const [productResults] = await connection.execute(productDetailsSql, productIds);

//             // Map additional items with product details
//             enhancedAdditionalItems = additionalItems.map(item => {
//                 const productDetail = productResults.find(p => p.id === item.productId);
//                 return {
//                     ...item,
//                     displayName: productDetail ? productDetail.displayName : 'Unknown Product',
//                     varietyId: productDetail ? productDetail.varietyId : null,
//                     category: productDetail ? productDetail.category : null,
//                     normalPrice: productDetail ? productDetail.normalPrice : null,
//                     discountedPrice: productDetail ? productDetail.discountedPrice : null
//                 };
//             });
//         }

//         console.log("All packages:", allPackages);
//         console.log("Enhanced Additional Items:", enhancedAdditionalItems);
//         console.log("Final isPackage:", finalIsPackage);

//         // Return order data
//         const result = {
//             orderId: order.orderId,
//             userId: order.userId,
//             orderApp: order.orderApp,
//             scheduleType: order.sheduleType,
//             scheduleDate: order.sheduleDate,
//             scheduleTime: order.sheduleTime,
//             createdAt: order.createdAt,
//             total: parseFloat(order.total) || 0,
//             discount: parseFloat(order.discount) || 0,
//             fullTotal: parseFloat(order.fullTotal) || 0,
//             isPackage: finalIsPackage,
//             isCoupon: order.isCoupon,
//             couponValue: order.orderApp === 'Marketplace' ? parseFloat(order.couponValue) || 0 : null,
//             customerInfo: {
//                 title: order.title,
//                 firstName: order.firstName,
//                 lastName: order.lastName,
//                 phoneNumber: order.phoneNumber,
//                 buildingType: buildingType,
//                 email: order.email
//             },
//             fullAddress: formattedAddress,
//             orderStatus: {
//                 processOrderId: processOrderId,
//                 invoiceNumber: invoiceNumber,
//                 status: orderStatus,
//                 reportStatus: reportStatus
//             },
//             additionalItems: enhancedAdditionalItems,
//             packages: allPackages
//         };

//         return result;

//     } catch (err) {
//         console.error('Database error:', err);
//         throw err;
//     } finally {
//         // Always release the connection back to the pool
//         if (connection) {
//             connection.release();
//             console.log('Database connection released');
//         }
//     }
// };

exports.getOrderById = async (orderId) => {
    let connection;

    try {
        // Get connection from pool
        connection = await db.marketPlace.promise().getConnection();
        console.log('Database connection acquired');

        // First, get the basic order information with orderApp
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
                c.title,
                c.firstName,
                c.lastName,
                c.phoneNumber,
                c.buildingType AS userBuildingType,
                c.email
            FROM orders o
            JOIN marketplaceusers c ON o.userId = c.id
            WHERE o.id = ?
        `;

        const [orderResults] = await connection.execute(orderSql, [orderId]);
        console.log("Order results:", orderResults);

        if (orderResults.length === 0) {
            return { message: 'No order found with the given ID' };
        }

        const order = orderResults[0];

        console.log("=== ORDER APP DEBUG ===");
        console.log("Order App:", order.orderApp);
        console.log("Order isPackage (from orders table):", order.orderIsPackage);
        console.log("isCoupon:", order.isCoupon);
        console.log("couponValue:", order.couponValue);
        console.log("========================");

        let finalIsPackage = 0;
        let processOrderId = null;
        let invoiceNumber = null;
        let orderStatus = null;
        let reportStatus = null;
        let paymentMethod = null; // FIX: Initialize paymentMethod variable

        // Handle logic based on orderApp
        if (order.orderApp === 'Marketplace') {
            console.log("✅ Processing MARKETPLACE order");

            // For Marketplace orders, use the isPackage from orders table
            finalIsPackage = order.orderIsPackage || 0;

            // Get process order info for Marketplace orders
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

            const [processOrderResults] = await connection.execute(processOrderSql, [orderId]);

            if (processOrderResults.length > 0) {
                const processOrder = processOrderResults[0];
                processOrderId = processOrder.processOrderId;
                invoiceNumber = processOrder.invoiceNumber;
                orderStatus = processOrder.status;
                paymentMethod = processOrder.paymentMethod; // FIX: Store paymentMethod
                reportStatus = processOrder.reportStatus;
            }

        } else if (order.orderApp === 'Dash') {
            console.log("✅ Processing DASH order");

            // For Dash orders, first get processorder
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

            const [processOrderResults] = await connection.execute(processOrderSql, [orderId]);

            if (processOrderResults.length > 0) {
                const processOrder = processOrderResults[0];
                processOrderId = processOrder.processOrderId;
                invoiceNumber = processOrder.invoiceNumber;
                orderStatus = processOrder.status;
                paymentMethod = processOrder.paymentMethod; // FIX: Store paymentMethod
                reportStatus = processOrder.reportStatus;

                // Check if this processOrder has packages in orderpackage table
                const packageCheckSql = `
                    SELECT COUNT(*) as packageCount
                    FROM orderpackage 
                    WHERE orderId = ?
                `;

                const [packageCheckResults] = await connection.execute(packageCheckSql, [processOrderId]);

                if (packageCheckResults[0].packageCount > 0) {
                    finalIsPackage = 1;
                    console.log("✅ Dash order has packages - setting isPackage = 1");
                } else {
                    finalIsPackage = 0;
                    console.log("✅ Dash order has no packages - setting isPackage = 0");
                }
            }
        }

        console.log("Final isPackage value:", finalIsPackage);
        console.log("Process Order ID:", processOrderId);

        // Use the correct variable names from the SQL query
        const buildingType = order.orderBuildingType || order.userBuildingType;

        console.log("=== BUILDING TYPE DEBUG ===");
        console.log("Order building type (from orders table):", order.orderBuildingType);
        console.log("User building type (from users table):", order.userBuildingType);
        console.log("Final building type being used:", buildingType);
        console.log("========================");

        let formattedAddress = '';

        // Handle address based on building type using correct tables
        if (buildingType === 'House') {
            console.log("✅ Processing HOUSE building type for order", orderId);

            const addressSql = `
                SELECT
                    houseNo,
                    streetName,
                    city
                FROM orderhouse
                WHERE orderId = ?
            `;

            const [addressResults] = await connection.execute(addressSql, [orderId]);
            console.log("House address results:", addressResults);

            if (addressResults[0]) {
                const addr = addressResults[0];
                formattedAddress = `${addr.houseNo || ''}, ${addr.streetName || ''}, ${addr.city || ''}`.trim();
                // Clean up extra spaces and commas
                formattedAddress = formattedAddress.replace(/^,\s*/, '').replace(/,\s*$/, '').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
                console.log("✅ House address found:", formattedAddress);
            } else {
                console.log("❌ No house address found for orderId:", orderId);
            }

        } else if (buildingType === 'Apartment') {
            console.log("✅ Processing APARTMENT building type for order", orderId);

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
            console.log("Apartment address results:", addressResults);

            if (addressResults[0]) {
                const addr = addressResults[0];
                // Build address parts array to handle empty values better
                const addressParts = [];

                if (addr.buildingName) addressParts.push(addr.buildingName);
                if (addr.buildingNo) addressParts.push(addr.buildingNo);
                if (addr.unitNo) addressParts.push(`Unit ${addr.unitNo}`);
                if (addr.floorNo) addressParts.push(`Floor ${addr.floorNo}`);
                if (addr.houseNo) addressParts.push(addr.houseNo);
                if (addr.streetName) addressParts.push(addr.streetName);
                if (addr.city) addressParts.push(addr.city);

                formattedAddress = addressParts.join(', ');
                console.log("✅ Apartment address found:", formattedAddress);
            } else {
                console.log("❌ No apartment address found for orderId:", orderId);
            }
        } else {
            console.log("❌ Unknown building type:", buildingType);
        }

        console.log("Final formatted address:", `"${formattedAddress}"`);

        // Get additional items
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

        const [additionalItemsResults] = await connection.execute(additionalItemsSql, [orderId]);

        // Filter out null/undefined items and create additional items array
        const additionalItems = additionalItemsResults
            .filter(item => item.productId !== null && item.productId !== undefined)
            .map(item => ({
                productId: item.productId,
                qty: parseFloat(item.qty) || 0,
                unit: item.unit || '',
                price: parseFloat(item.price) || 0,
                discount: parseFloat(item.itemDiscount) || 0
            }));

        // Get ALL packages for this order (only if finalIsPackage = 1 and processOrderId exists)
        let allPackages = [];

        if (finalIsPackage === 1 && processOrderId) {
            console.log("This is a package order, processOrderId:", processOrderId);

            // Get all packages for this order using processOrderId
            const packagesSql = `
                SELECT
                    op.id AS orderPackageId,
                    op.packageId,
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

            const [packagesResults] = await connection.execute(packagesSql, [processOrderId]);
            console.log("All packages query results:", packagesResults);

            // For each package, get its items
            for (const packageData of packagesResults) {
                console.log("Processing package:", packageData.orderPackageId);

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

                const [packageItemsResults] = await connection.execute(packageItemsSql, [packageData.orderPackageId]);
                console.log(`Package items for package ${packageData.orderPackageId}:`, packageItemsResults);

                const packageItems = packageItemsResults.map(item => ({
                    id: item.id,
                    orderPackageId: item.orderPackageId,
                    productType: item.productType,
                    productTypeName: item.productTypeName,
                    productId: item.productId,
                    productDisplayName: item.productDisplayName || 'N/A',
                    varietyId: item.varietyId,
                    category: item.category,
                    normalPrice: item.normalPrice,
                    discountedPrice: item.discountedPrice,
                    qty: parseFloat(item.qty) || 0,
                    price: parseFloat(item.price) || 0,
                    isPacked: item.isPacked
                }));

                // Create package info object
                const packageInfo = {
                    packageId: packageData.packageId,
                    orderPackageId: packageData.orderPackageId,
                    displayName: packageData.packageDisplayName,
                    productPrice: parseFloat(packageData.packagePrice) || 0,
                    packingFee: parseFloat(packageData.packagePackingFee) || 0,
                    serviceFee: parseFloat(packageData.packageServiceFee) || 0,
                    status: packageData.packageStatus,
                    packingStatus: packageData.packingStatus,
                    isLock: packageData.isLock,
                    packageCreatedAt: packageData.packageCreatedAt,
                    packageItems: packageItems
                };

                allPackages.push(packageInfo);
            }
        }

        // Get product details for additional items if they exist
        let enhancedAdditionalItems = [];
        if (additionalItems.length > 0) {
            const productIds = additionalItems.map(item => item.productId);
            const placeholders = productIds.map(() => '?').join(',');

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

            const [productResults] = await connection.execute(productDetailsSql, productIds);

            // Map additional items with product details
            enhancedAdditionalItems = additionalItems.map(item => {
                const productDetail = productResults.find(p => p.id === item.productId);
                return {
                    ...item,
                    displayName: productDetail ? productDetail.displayName : 'Unknown Product',
                    varietyId: productDetail ? productDetail.varietyId : null,
                    category: productDetail ? productDetail.category : null,
                    normalPrice: productDetail ? productDetail.normalPrice : null,
                    discountedPrice: productDetail ? productDetail.discountedPrice : null
                };
            });
        }

        console.log("All packages:", allPackages);
        console.log("Enhanced Additional Items:", enhancedAdditionalItems);
        console.log("Final isPackage:", finalIsPackage);

        // Return order data
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
            couponValue: order.orderApp === 'Marketplace' ? parseFloat(order.couponValue) || 0 : null,
            customerInfo: {
                title: order.title,
                firstName: order.firstName,
                lastName: order.lastName,
                phoneNumber: order.phoneNumber,
                buildingType: buildingType,
                email: order.email
            },
            fullAddress: formattedAddress,
            orderStatus: {
                processOrderId: processOrderId,
                invoiceNumber: invoiceNumber,
                status: orderStatus,
                paymentMethod: paymentMethod, // FIX: Now properly defined
                reportStatus: reportStatus
            },
            additionalItems: enhancedAdditionalItems,
            packages: allPackages
        };

        return result;

    } catch (err) {
        console.error('Database error:', err);
        throw err;
    } finally {
        // Always release the connection back to the pool
        if (connection) {
            connection.release();
            console.log('Database connection released');
        }
    }
};

exports.getDataCustomerId = async (customerId) => {
    let connection;

    try {
        // Get connection from pool
        connection = await db.marketPlace.promise().getConnection();
        console.log('Database connection acquired');

        // First query to get basic customer info including phoneCode and phoneNumber
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

        const [customerResults] = await connection.execute(customerSql, [customerId]);

        if (customerResults.length === 0) {
            return { message: 'No customer found with this ID' };
        }

        const customer = customerResults[0];

        // Combine phoneCode and phoneNumber into a single phoneNumber field
        if (customer.phoneCode && customer.phoneNumber) {
            customer.phoneNumber = `${customer.phoneCode}${customer.phoneNumber}`;
        } else if (customer.phoneNumber && !customer.phoneCode) {
            // If only phoneNumber exists, keep it as is
            customer.phoneNumber = customer.phoneNumber;
        } else if (customer.phoneCode && !customer.phoneNumber) {
            // If only phoneCode exists, set phoneNumber to just the code
            customer.phoneNumber = `${customer.phoneCode}`;
        } else {
            // If neither exists, set to empty string
            customer.phoneNumber = '';
        }

        // Remove the separate phoneCode field since we've combined it
        delete customer.phoneCode;

        const buildingType = customer.buildingType.toLowerCase();

        // Second query to get building details based on building type
        const buildingSql = `
            SELECT * FROM ${buildingType}
            WHERE customerId = ?
        `;

        const [buildingResults] = await connection.execute(buildingSql, [customerId]);

        // Combine customer info with building info
        const result = {
            ...customer,
            buildingDetails: buildingResults.length > 0 ? buildingResults[0] : null
        };

        return result;

    } catch (err) {
        console.error('Database error:', err);
        throw err;
    } finally {
        // Always release the connection back to the pool
        if (connection) {
            connection.release();
            console.log('Database connection released');
        }
    }
};


exports.getAllCity = async () => {
    console.log("hitpack")
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
        // Get connection from pool
        connection = await db.marketPlace.promise().getConnection();
        console.log('Database connection acquired');

        // First, get the basic order details
        const [orderRows] = await connection.execute(
            'SELECT * FROM orders WHERE id = ?',
            [orderId]
        );

        if (orderRows.length === 0) {
            return {
                error: true,
                message: 'Order not found'
            };
        }

        const order = orderRows[0];
        console.log('Order found:', order);

        // Initialize response object with basic order data
        let orderResponse = {
            ...order,
            couponValue: null,
            isPackage: 0
        };

        // Check orderApp type and handle accordingly
        if (order.orderApp === 'Marketplace') {
            // For Marketplace orders, get coupon value (already in orders table)
            orderResponse.couponValue = order.couponValue || null;
            console.log('Marketplace order - coupon value:', orderResponse.couponValue);

        } else if (order.orderApp === 'Dash') {
            // For Dash orders, check if it has packages
            console.log('Dash order - checking for packages...');

            // First, check if there's a process order for this order
            const [processOrderRows] = await connection.execute(
                'SELECT id FROM processorders WHERE orderId = ?',
                [orderId]
            );

            if (processOrderRows.length > 0) {
                const processOrderId = processOrderRows[0].id;
                console.log('Process order found with ID:', processOrderId);

                // Check if there are any packages for this process order
                const [packageRows] = await connection.execute(
                    'SELECT COUNT(*) as packageCount FROM orderpackage WHERE orderId = ?',
                    [processOrderId]
                );

                const packageCount = packageRows[0].packageCount;
                orderResponse.isPackage = packageCount > 0 ? 1 : 0;
                console.log('Package count:', packageCount, 'isPackage:', orderResponse.isPackage);
            } else {
                console.log('No process order found for this Dash order');
                orderResponse.isPackage = 0;
            }
        }

        console.log('Final order response:', orderResponse);
        return orderResponse;

    } catch (error) {
        console.error('Database error in getOrderMarketplaceOrdash:', error);
        throw error;
    } finally {
        // Always release the connection back to the pool
        if (connection) {
            connection.release();
            console.log('Database connection released');
        }
    }
};