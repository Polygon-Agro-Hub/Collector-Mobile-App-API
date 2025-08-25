const jwt = require("jsonwebtoken");
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

                -- Additional item counts (ensure numeric types)
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

                -- Package item counts (ensure numeric types and include isLock info)
                CAST(COALESCE(package_item_counts.total_items, 0) AS UNSIGNED) AS totalPackageItems,
                CAST(COALESCE(package_item_counts.packed_items, 0) AS UNSIGNED) AS packedPackageItems,
                CAST(COALESCE(package_item_counts.pending_items, 0) AS UNSIGNED) AS pendingPackageItems,
                CAST(COALESCE(package_item_counts.total_packages, 0) AS UNSIGNED) AS totalPackages,
                CAST(COALESCE(package_item_counts.locked_packages, 0) AS UNSIGNED) AS lockedPackages,

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
                -- Package items subquery - FIXED: Aggregate ALL packages for each processorder + include isLock
                SELECT 
                    op.orderId,  -- This references processorders.id
                    COUNT(DISTINCT op.id) as total_packages,  -- Count total packages
                    SUM(CASE WHEN op.isLock = 1 THEN 1 ELSE 0 END) as locked_packages,  -- Count locked packages
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
                        createdDate: row.targetCreatedAt,
                        processOrderId: row.processOrderId,
                        orderId: row.orderId,
                        isPackage: row.isPackage,
                        packageData: {
                            totalPackages: row.totalPackages,
                            lockedPackages: row.lockedPackages, // Now included
                            items: {
                                total: row.totalPackageItems,      // Now properly numeric
                                packed: row.packedPackageItems,    // Now properly numeric
                                pending: row.pendingPackageItems,  // Now properly numeric
                                status: row.packageItemStatus
                            }
                        },
                        additionalItems: {
                            total: row.totalAdditionalItems,      // Now properly numeric
                            packed: row.packedAdditionalItems,    // Now properly numeric
                            pending: row.pendingAdditionalItems,  // Now properly numeric
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

                // Package lock summary
                const lockCounts = results.reduce((acc, row) => {
                    if (row.isPackage === 1) {
                        const lockStatus = `${row.lockedPackages}/${row.totalPackages} locked`;
                        acc[lockStatus] = (acc[lockStatus] || 0) + 1;
                    }
                    return acc;
                }, {});
                console.log("Package Lock Distribution:", lockCounts);

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



exports.getViewDetailsById = (requestId) => {
    return new Promise((resolve, reject) => {
        db.plantcare.getConnection((connErr, connection) => {
            if (connErr) {
                console.error('Connection Error:', connErr);
                return reject(connErr);
            }

            const query = ` 
                SELECT  
                    cr.id,  
                    cr.farmerId,  
                    f.firstName AS firstName, 
                    f.NICnumber AS NICnumber, 
                    f.route AS farmerRoute, 
                    f.city AS city, 
                    f.streetName AS streetName, 
                    f.houseNo AS houseNo, 
                    cr.centerId,  
                    cr.companyId,  
                    cr.scheduleDate, 
                    cr.createdAt,  
                    cr.requestStatus,  
                    cr.assignedStatus,
                    cr.requestId AS reqId
                FROM collection_officer.collectionrequest cr 
                LEFT JOIN plant_care.users f ON cr.farmerId = f.id 
                WHERE cr.id = ? 
            `;

            connection.query(query, [requestId], (error, results) => {
                if (error) {
                    connection.release();
                    console.error('Database Query Error:', error);
                    return reject(error);
                }

                if (!results || results.length === 0) {
                    connection.release();
                    return resolve(null);
                }

                const itemsQuery = ` 
                    SELECT 
                        ri.id, 
                        ri.cropId, 
                        ri.varietyId, 
                        ri.loadWeight, 
                        cg.cropNameEnglish, 
                        cg.cropNameSinhala,
                        cg.cropNameTamil,
                        cv.varietyNameTamil,
                        cv.varietyNameSinhala,
                        cv.varietyNameEnglish 
                    FROM collection_officer.collectionrequestitems ri
                    LEFT JOIN plant_care.cropgroup cg ON ri.cropId = cg.id
                    LEFT JOIN plant_care.cropvariety cv ON ri.varietyId = cv.id
                    WHERE ri.requestId = ? 
                `;

                connection.query(itemsQuery, [requestId], (itemsError, itemsResults) => {
                    connection.release(); // Always release after the last query

                    if (itemsError) {
                        console.error('Database Items Query Error:', itemsError);
                        return reject(itemsError);
                    }

                    const requestDetails = results[0];
                    const formattedResponse = {
                        id: requestDetails.id,
                        name: requestDetails.firstName || `Farmer ${requestDetails.farmerId}`,
                        route: requestDetails.farmerRoute || `Route ${requestDetails.farmerId}`,
                        nic: requestDetails.NICnumber || `NIC ${requestDetails.farmerId}`,
                        farmerId: requestDetails.farmerId,
                        scheduleDate: requestDetails.scheduleDate,
                        requestStatus: requestDetails.requestStatus,
                        assignedStatus: requestDetails.assignedStatus,
                        city: requestDetails.city,
                        streetName: requestDetails.streetName,
                        houseNo: requestDetails.houseNo,
                        requestID: requestDetails.reqId,
                        items: (itemsResults || []).map(item => ({
                            itemId: item.id,
                            cropId: item.cropId,
                            cropName: item.cropNameEnglish,
                            cropNameSinhala: item.cropNameSinhala,
                            cropNameTamil: item.cropNameTamil,
                            varietyNameTamil: item.varietyNameTamil,
                            varietyNameSinhala: item.varietyNameSinhala,
                            varietyId: item.varietyId,
                            varietyName: item.varietyNameEnglish,
                            loadWeight: item.loadWeight
                        }))
                    };

                    console.log('Formatted Response:', formattedResponse);
                    resolve(formattedResponse);
                });
            });
        });
    });
};


exports.updateCollectionRequest = async (requestId, scheduleDate) => {
    return new Promise((resolve, reject) => {
        const updateQuery = `
        UPDATE collectionrequest 
        SET scheduleDate = ? 
        WHERE id = ?
      `;

        db.collectionofficer.query(updateQuery, [scheduleDate, requestId], (err, results) => {
            if (err) {
                console.error('Error updating schedule date:', err);
                reject(new Error('Database query failed'));
                return;
            }

            // Check if any rows were actually updated
            // if (results.changedRows === 0) {
            //   resolve({ success: false, message: 'Schedule date is already up-to-date.' });
            //   return;
            // }

            resolve({ success: true, message: 'Schedule date updated successfully.' });
        });
    });
};



exports.cancelRequest = async (requestId, cancelReason, userId) => {
    console.log('Cancel Request Function Hit', cancelReason, userId, requestId);

    return new Promise((resolve, reject) => {
        const updateQuery = `
            UPDATE collectionrequest 
            SET cancelReason = ?, 
                cancelStatus = 1, 
                assignedStatus = 'Cancelled',
                cancelBy = ?
            WHERE id = ?
        `;

        db.collectionofficer.query(updateQuery, [cancelReason, userId, requestId], (err, result) => {
            if (err) {
                console.error('Query Error:', err);
                return reject({ success: false, message: 'Database error', error: err });
            }
            resolve({ success: true, message: 'Request cancelled successfully.' });
        });
    });
};
