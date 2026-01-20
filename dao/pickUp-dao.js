const { collectionofficer, marketPlace } = require("../startup/database");
const db = require('../startup/database');

// exports.getPickupOrders = (officerId) => {
//     console.log("Getting pickup orders for officer ID:", officerId);

//     return new Promise((resolve, reject) => {
//         if (!officerId) {
//             return reject(new Error("Officer ID is missing or invalid"));
//         }

//         const sql = `
//             SELECT 
//                 o.id AS orderId,
//                 o.userId,
//                 o.orderApp,
//                 o.createdAt,
//                 o.delivaryMethod,
//                 o.fullTotal,
//                 o.total,
//                 o.buildingType,
//                 o.sheduleDate,
//                 o.sheduleTime,

//                 po.id AS processOrderId,
//                 po.invNo,
//                 po.transactionId,
//                 po.paymentMethod,
//                 po.isPaid,
//                 po.amount,
//                 po.status,

//                 u.cusId,
//                 u.title,
//                 u.firstName,
//                 u.lastName,
//                 u.phoneCode,
//                 u.phoneNumber,
//                 u.phoneCode2,
//                 u.phoneNumber2,
//                 u.email,
//                 u.buyerType,
//                 u.companyName,
//                 u.companyPhoneCode,
//                 u.companyPhone,

//                 COALESCE(oh.city, oa.city) AS customerCity,
//                 COALESCE(oh.houseNo, oa.houseNo) AS houseNo,
//                 COALESCE(oh.streetName, oa.streetName) AS streetName,

//                 dc.district AS distributionDistrict,
//                 dc.centerName,
//                 dc.regCode,

//                 co.firstNameEnglish AS officerFirstName,
//                 co.lastNameEnglish AS officerLastName

//             FROM collection_officer.collectionofficer co

//             INNER JOIN collection_officer.distributedcenter dc 
//                 ON co.distributedCenterId = dc.id

//             INNER JOIN market_place.orders o 
//                 ON o.buildingType IN ('house', 'apartment')

//             LEFT JOIN market_place.orderhouse oh 
//                 ON o.id = oh.orderId 
//                 AND o.buildingType = 'house'
//                 AND oh.city = dc.district

//             LEFT JOIN market_place.orderapartment oa 
//                 ON o.id = oa.orderId 
//                 AND o.buildingType = 'apartment'
//                 AND oa.city = dc.district

//             INNER JOIN market_place.processorders po 
//                 ON o.id = po.orderId
//                 AND po.status = 'Ready to Pickup'

//             INNER JOIN market_place.marketplaceusers u 
//                 ON o.userId = u.id

//             WHERE co.id = ?
//                 AND (oh.city IS NOT NULL OR oa.city IS NOT NULL)

//             ORDER BY o.createdAt DESC;
//         `;

//         // Use collectionofficer pool since the main table is from that database
//         // MySQL will handle the cross-database joins automatically
//         collectionofficer.query(sql, [officerId], (error, results) => {
//             if (error) {
//                 console.error("Database error:", error);
//                 return reject(error);
//             }

//             console.log(`Found ${results.length} pickup orders for officer ${officerId}`);
//             resolve(results);
//         });
//     });
// };
exports.getPickupOrders = (officerId) => {
    console.log("Getting pickup orders for officer ID:", officerId);

    return new Promise((resolve, reject) => {
        if (!officerId) {
            return reject(new Error("Officer ID is missing or invalid"));
        }

        const sql = `
            SELECT 
                o.id AS orderId,
                o.userId,
                o.orderApp,
                o.createdAt,
                o.delivaryMethod,
                o.fullTotal,
                o.total,
                o.buildingType,
                o.sheduleDate,
                o.sheduleTime,
                o.fullName,
                o.phonecode1 As phoneCode,
                o.phone1 As phoneNumber ,
                o.phonecode2 As phoneCode2,
                o.phone2 As phoneNumber2,
                
                po.id AS processOrderId,
                po.invNo,
                po.transactionId,
                po.paymentMethod,
                po.isPaid,
                po.amount,
                po.status,
                
                u.cusId,
                u.title,
                u.firstName,
                u.lastName,
                u.email,
                u.buyerType,
                u.companyName,
                u.companyPhoneCode,
                u.companyPhone,
                
                dc.district AS distributionDistrict,
                dc.centerName,
                dc.regCode,
                
                co.firstNameEnglish AS officerFirstName,
                co.lastNameEnglish AS officerLastName
                
            FROM collection_officer.collectionofficer co
            
            INNER JOIN collection_officer.distributedcenter dc 
                ON co.distributedCenterId = dc.id
            
            INNER JOIN market_place.orders o 
                ON o.centerId = dc.id
            
            INNER JOIN market_place.processorders po 
                ON po.orderId = o.id
                AND po.status = 'Ready to Pickup'
            
            INNER JOIN market_place.marketplaceusers u 
                ON o.userId = u.id
            
            WHERE co.id = ?
            
            ORDER BY o.createdAt DESC;
        `;

        collectionofficer.query(sql, [officerId], (error, results) => {
            if (error) {
                console.error("Database error:", error);
                return reject(error);
            }

            console.log(`Found ${results.length} pickup orders for officer ${officerId}`);
            resolve(results);
        });
    });
};



exports.checkCustome = async () => {
    return new Promise((resolve, reject) => {
        const query = `
                   SELECT  id,cusId,title,firstName,lastName,phoneCode,phoneCode2,phoneNumber,phoneNumber2
                FROM marketplaceusers 
              
      `;
        marketPlace.query(query, (error, results) => {
            if (error) {
                console.error("Error fetching customers:", error);
                reject(error);
            } else {
                resolve(results);
                console.log(results)
            }
        });
    });
};

//Update Pickup orders

exports.updatePickupDetails = async (officerId, orderId, signatureUrl) => {
    try {
        // First, get the processorder id using the invoice number
        const getProcessOrderQuery = `
            SELECT id 
            FROM market_place.processorders 
            WHERE invNo = ?
        `;

        const [processOrderResult] = await db.marketPlace.promise().query(getProcessOrderQuery, [orderId]);

        if (!processOrderResult || processOrderResult.length === 0) {
            throw new Error('Order not found with the given invoice number');
        }

        const processOrderId = processOrderResult[0].id;

        // Update the status to "Picked up" in processorders table
        const updateStatusQuery = `
            UPDATE market_place.processorders 
            SET status = 'Picked up' 
            WHERE id = ?
        `;

        await db.marketPlace.promise().query(updateStatusQuery, [processOrderId]);

        // Insert into collection_officer.pickuporders
        const insertQuery = `
            INSERT INTO collection_officer.pickuporders 
            (orderId, orderIssuedOfficer, signature, createdAt) 
            VALUES (?, ?, ?, NOW())
        `;

        const [result] = await db.collectionofficer.promise().query(insertQuery, [
            processOrderId,
            officerId,
            signatureUrl
        ]);

        return {
            success: true,
            insertId: result.insertId,
            processOrderId: processOrderId,
            signatureUrl: signatureUrl,
            message: 'Pickup details updated successfully'
        };
    } catch (error) {
        console.error('Error in updatePickupDetails DAO:', error);
        throw error;
    }
};





exports.getReceivedOrders = (officerId) => {
    console.log("Getting pickup and driver orders for officer ID:", officerId);
    return new Promise((resolve, reject) => {
        if (!officerId) {
            return reject(new Error("Officer ID is missing or invalid"));
        }
        const query = `
            SELECT 
                'pickup' AS orderType,
                po.id AS pickupOrderId,
                po.orderId AS pickupOrderOrderId,
                po.orderIssuedOfficer,
                po.handOverOfficer,
                po.signature,
                po.handOverPrice,
                po.handOverTime,
                po.createdAt AS pickupCreatedAt,
                CASE 
                    WHEN po.handOverOfficer IS NOT NULL THEN po.createdAt 
                    ELSE NULL 
                END AS handOverReceivedTime,
                NULL AS driverId,
                NULL AS drvStatus,
                NULL AS isHandOver,
                NULL AS receivedTime,
                NULL AS startTime,
                
                -- Process orders data
                pr.id AS processOrderId,
                pr.orderId AS processOrderOrderId,
                pr.invNo,
                pr.transactionId,
                pr.paymentMethod,
                pr.isPaid,
                pr.amount,
                pr.status AS processStatus,
                
                -- Orders data
                o.id AS orderId,
                o.userId,
                o.orderApp,
                o.delivaryMethod,
                o.fullTotal,
                o.createdAt AS orderCreatedAt
                
            FROM collection_officer.pickuporders po
            INNER JOIN market_place.processorders pr 
                ON po.orderId = pr.id
            INNER JOIN market_place.orders o 
                ON pr.orderId = o.id
            WHERE po.orderIssuedOfficer = ? OR po.handOverOfficer = ?
            
            UNION ALL
            
            SELECT 
                'driver' AS orderType,
                NULL AS pickupOrderId,
                do.orderId AS pickupOrderOrderId,
                NULL AS orderIssuedOfficer,
                do.handOverOfficer,
                do.signature,
                do.handOverPrice,
                do.handOverTime,
                do.createdAt AS pickupCreatedAt,
                CASE 
                    WHEN do.handOverOfficer IS NOT NULL THEN do.createdAt 
                    ELSE NULL 
                END AS handOverReceivedTime,
                do.driverId,
                do.drvStatus,
                do.isHandOver,
                do.receivedTime,
                do.startTime,
                
                -- Process orders data
                pr.id AS processOrderId,
                pr.orderId AS processOrderOrderId,
                pr.invNo,
                pr.transactionId,
                pr.paymentMethod,
                pr.isPaid,
                pr.amount,
                pr.status AS processStatus,
                
                -- Orders data
                o.id AS orderId,
                o.userId,
                o.orderApp,
                o.delivaryMethod,
                o.fullTotal,
                o.createdAt AS orderCreatedAt
                
            FROM collection_officer.driverorders do
            INNER JOIN market_place.processorders pr 
                ON do.orderId = pr.id
            INNER JOIN market_place.orders o 
                ON pr.orderId = o.id
            WHERE do.handOverOfficer = ?
            
            ORDER BY orderCreatedAt DESC
        `;

        db.collectionofficer.query(query, [officerId, officerId, officerId], (error, results) => {
            if (error) {
                console.error("Database error:", error);
                return reject(error);
            }
            console.log(`Found ${results.length} orders (pickup + driver) for officer ${officerId}`);
            resolve(results);
        });
    });
};

exports.getReceivedOrderOfficer = (officerId) => {
    console.log("Getting pickup orders for officer ID:", officerId);
    return new Promise((resolve, reject) => {
        if (!officerId) {
            return reject(new Error("Officer ID is missing or invalid"));
        }

        const query = `
            SELECT 
                po.id AS pickupOrderId,
                po.orderId AS pickupOrderOrderId,
                po.orderIssuedOfficer,
                po.handOverOfficer,
                po.signature,
                po.handOverPrice,
                po.handOverTime,
                po.createdAt AS pickupCreatedAt,
                
                -- Process orders data
                pr.id AS processOrderId,
                pr.orderId AS processOrderOrderId,
                pr.invNo,
                pr.transactionId,
                pr.paymentMethod,
                pr.isPaid,
                pr.amount,
                pr.status AS processStatus,
                
                -- Orders data
                o.id AS orderId,
                o.userId,
                o.orderApp,
                o.delivaryMethod,
                o.fullTotal,
                o.createdAt AS orderCreatedAt
                
            FROM collection_officer.pickuporders po
            
            -- Join with processorders using orderId from pickuporders
            INNER JOIN market_place.processorders pr 
                ON po.orderId = pr.id
            
            -- Join with orders using orderId from processorders
            INNER JOIN market_place.orders o 
                ON pr.orderId = o.id
            
            WHERE po.orderIssuedOfficer = ?
            
            ORDER BY po.createdAt DESC
        `;

        db.collectionofficer.query(query, [officerId], (error, results) => {
            if (error) {
                console.error("Database error:", error);
                return reject(error);
            }

            console.log(`Found ${results.length} pickup orders for officer ${officerId}`);
            resolve(results);
        });
    });
};


exports.getOfficerByEmpId = (empId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT id, empId 
            FROM collection_officer.collectionofficer 
            WHERE empId = ? 
            LIMIT 1
        `;

        db.collectionofficer.query(query, [empId], (err, results) => {
            if (err) {
                console.error("Error fetching officer:", err);
                return reject(err);
            }

            if (results && results.length > 0) {
                resolve(results[0]);
            } else {
                resolve(null);
            }
        });
    });
};

// Simple version - updates transactions one by one
exports.updateCashReceived = (transactions, officerId, totalAmount) => {
    return new Promise((resolve, reject) => {
        // Validate input
        if (!transactions || transactions.length === 0) {
            return reject(new Error("No valid transactions provided"));
        }

        // Get connection and start transaction
        db.collectionofficer.getConnection((err, connection) => {
            if (err) {
                console.error("Error getting connection:", err);
                return reject(err);
            }

            // Start database transaction
            connection.beginTransaction(err => {
                if (err) {
                    connection.release();
                    return reject(err);
                }

                let completed = 0;
                let failed = false;
                const results = [];

                // Process each transaction
                transactions.forEach((transaction, index) => {
                    if (failed) return;

                    // First check if already handed over
                    const checkQuery = `
                        SELECT id, handOverOfficer 
                        FROM collection_officer.pickuporders 
                        WHERE id = ?
                    `;

                    connection.query(checkQuery, [transaction.transactionId], (err, checkResults) => {
                        if (err || failed) {
                            if (!failed) {
                                failed = true;
                                connection.rollback(() => {
                                    connection.release();
                                    reject(err);
                                });
                            }
                            return;
                        }

                        // Check if transaction exists
                        if (!checkResults || checkResults.length === 0) {
                            failed = true;
                            connection.rollback(() => {
                                connection.release();
                                reject(new Error(`Transaction ${transaction.transactionId} not found`));
                            });
                            return;
                        }

                        // Check if already handed over
                        if (checkResults[0].handOverOfficer !== null) {
                            failed = true;
                            connection.rollback(() => {
                                connection.release();
                                reject(new Error(
                                    `Transaction ${transaction.transactionId} has already been handed over`
                                ));
                            });
                            return;
                        }

                        // Update the transaction
                        const updateQuery = `
                            UPDATE collection_officer.pickuporders
                            SET 
                                handOverOfficer = ?,
                                handOverPrice = ?,
                                handOverTime = NOW()
                            WHERE id = ?
                            AND handOverOfficer IS NULL
                        `;

                        const params = [
                            officerId,
                            transaction.amount,
                            transaction.transactionId
                        ];

                        connection.query(updateQuery, params, (err, updateResult) => {
                            if (err || failed) {
                                if (!failed) {
                                    failed = true;
                                    connection.rollback(() => {
                                        connection.release();
                                        reject(err);
                                    });
                                }
                                return;
                            }

                            if (updateResult.affectedRows === 0) {
                                failed = true;
                                connection.rollback(() => {
                                    connection.release();
                                    reject(new Error(
                                        `Failed to update transaction ${transaction.transactionId}`
                                    ));
                                });
                                return;
                            }

                            results.push({
                                transactionId: transaction.transactionId,
                                updated: true
                            });

                            completed++;

                            // If all transactions processed, commit
                            if (completed === transactions.length) {
                                connection.commit(err => {
                                    if (err) {
                                        connection.rollback(() => {
                                            connection.release();
                                            reject(err);
                                        });
                                    } else {
                                        connection.release();
                                        resolve({
                                            affectedRows: completed,
                                            results: results
                                        });
                                    }
                                });
                            }
                        });
                    });
                });
            });
        });
    });
};