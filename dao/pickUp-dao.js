const { collectionofficer, marketPlace } = require("../startup/database");
const db = require("../startup/database");

exports.getPickupOrders = (officerId) => {
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
                o.title,
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
                po.outDlvrDate,
                
                u.cusId,
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
            }
        });
    });
};

exports.updatePickupDetails = async (
    officerId,
    orderId,
    signatureUrl,
    role,
) => {
    const connection = await db.marketPlace.promise().getConnection();

    try {
        await connection.beginTransaction();

        const getProcessOrderQuery = `
            SELECT id, paymentMethod, orderId, amount, isPaid
            FROM market_place.processorders 
            WHERE invNo = ?
        `;

        const [processOrderResult] = await connection.query(getProcessOrderQuery, [
            orderId,
        ]);

        if (!processOrderResult || processOrderResult.length === 0) {
            throw new Error("Order not found with the given invoice number");
        }

        const processOrder = processOrderResult[0];
        const processOrderId = processOrder.id;
        const paymentMethod = processOrder.paymentMethod;

        if (paymentMethod === "Cash") {
            const getOrderAmountQuery = `
                SELECT fullTotal 
                FROM market_place.orders 
                WHERE id = ?
            `;

            const [orderResult] = await connection.query(getOrderAmountQuery, [
                processOrder.orderId,
            ]);

            if (!orderResult || orderResult.length === 0) {
                throw new Error("Order details not found");
            }

            const paymentAmount = orderResult[0].fullTotal;

            const updateProcessOrderQuery = `
                UPDATE market_place.processorders 
                SET status = ?,
                    amount = ?,
                    isPaid = ?,
                    deliveredTime = NOW()
                WHERE id = ?
            `;

            const [updateResult] = await connection.query(updateProcessOrderQuery, [
                "Picked up",
                paymentAmount,
                1,
                processOrderId,
            ]);
        } else {
            const updateStatusQuery = `
                UPDATE market_place.processorders 
                SET status = 'Picked up',
                    deliveredTime = NOW()
                WHERE id = ?
            `;

            await connection.query(updateStatusQuery, [processOrderId]);
        }

        let insertQuery;
        let insertParams;

        if (role === "Distribution Centre Manager") {
            if (paymentMethod === "Cash") {
                const getOrderAmountQuery = `
                    SELECT fullTotal 
                    FROM market_place.orders 
                    WHERE id = ?
                `;
                const [orderResult] = await connection.query(getOrderAmountQuery, [
                    processOrder.orderId,
                ]);
                const handOverPrice = orderResult[0]?.fullTotal || 0;

                insertQuery = `
                    INSERT INTO collection_officer.pickuporders 
                    (orderId, orderIssuedOfficer, signature, handOverPrice, handOverTime, createdAt) 
                    VALUES (?, ?, ?, ?, NOW(), NOW())
                `;
                insertParams = [processOrderId, officerId, signatureUrl, handOverPrice];
            } else {
                insertQuery = `
                    INSERT INTO collection_officer.pickuporders 
                    (orderId, orderIssuedOfficer, signature, createdAt) 
                    VALUES (?, ?, ?, NOW())
                `;
                insertParams = [processOrderId, officerId, signatureUrl];
            }
        } else if (role === "Distribution Officer") {
            insertQuery = `
                INSERT INTO collection_officer.pickuporders 
                (orderId, orderIssuedOfficer, signature, createdAt) 
                VALUES (?, ?, ?, NOW())
            `;
            insertParams = [processOrderId, officerId, signatureUrl];
        } else {
            throw new Error("Invalid role for pickup details update");
        }

        const [result] = await connection.query(insertQuery, insertParams);

        await connection.commit();

        return {
            success: true,
            insertId: result.insertId,
            processOrderId: processOrderId,
            signatureUrl: signatureUrl,
            paymentMethod: paymentMethod,
            message: "Pickup details updated successfully",
        };
    } catch (error) {
        await connection.rollback();
        console.error("Error in updatePickupDetails DAO:", error);
        throw error;
    } finally {
        connection.release();
    }
};

exports.getReceivedOrders = (officerId) => {
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
            WHERE (po.orderIssuedOfficer = ? OR po.handOverOfficer = ?)
                AND pr.paymentMethod = 'Cash'
            
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
                AND pr.paymentMethod = 'Cash'
            
            ORDER BY orderCreatedAt DESC
        `;

        db.collectionofficer.query(
            query,
            [officerId, officerId, officerId],
            (error, results) => {
                if (error) {
                    console.error("Database error:", error);
                    return reject(error);
                }

                resolve(results);
            },
        );
    });
};

exports.getReceivedOrderOfficer = (officerId) => {
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
                AND pr.paymentMethod = 'Cash'
            
            ORDER BY po.createdAt DESC
        `;

        db.collectionofficer.query(query, [officerId], (error, results) => {
            if (error) {
                console.error("Database error:", error);
                return reject(error);
            }

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

exports.updateCashReceived = (transactions, officerId, totalAmount) => {
    return new Promise((resolve, reject) => {
        if (!transactions || transactions.length === 0) {
            return reject(new Error("No valid transactions provided"));
        }

        db.collectionofficer.getConnection((err, connection) => {
            if (err) {
                console.error("Error getting connection:", err);
                return reject(err);
            }

            connection.beginTransaction((err) => {
                if (err) {
                    connection.release();
                    return reject(err);
                }

                let completed = 0;
                let failed = false;
                const results = [];

                transactions.forEach((transaction, index) => {
                    if (failed) return;

                    const checkQuery = `
                        SELECT id, handOverOfficer 
                        FROM collection_officer.pickuporders 
                        WHERE id = ?
                    `;

                    connection.query(
                        checkQuery,
                        [transaction.transactionId],
                        (err, checkResults) => {
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

                            if (!checkResults || checkResults.length === 0) {
                                failed = true;
                                connection.rollback(() => {
                                    connection.release();
                                    reject(
                                        new Error(
                                            `Transaction ${transaction.transactionId} not found`,
                                        ),
                                    );
                                });
                                return;
                            }

                            if (checkResults[0].handOverOfficer !== null) {
                                failed = true;
                                connection.rollback(() => {
                                    connection.release();
                                    reject(
                                        new Error(
                                            `Transaction ${transaction.transactionId} has already been handed over`,
                                        ),
                                    );
                                });
                                return;
                            }

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
                                transaction.transactionId,
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
                                        reject(
                                            new Error(
                                                `Failed to update transaction ${transaction.transactionId}`,
                                            ),
                                        );
                                    });
                                    return;
                                }

                                results.push({
                                    transactionId: transaction.transactionId,
                                    updated: true,
                                });

                                completed++;

                                if (completed === transactions.length) {
                                    connection.commit((err) => {
                                        if (err) {
                                            connection.rollback(() => {
                                                connection.release();
                                                reject(err);
                                            });
                                        } else {
                                            connection.release();
                                            resolve({
                                                affectedRows: completed,
                                                results: results,
                                            });
                                        }
                                    });
                                }
                            });
                        },
                    );
                });
            });
        });
    });
};

exports.getOfficerByEmpId = (empId) => {
    return new Promise((resolve, reject) => {
        db.collectionofficer.getConnection((err, connection) => {
            if (err) {
                return reject(err);
            }

            const query = `
                SELECT id, empId, distributedCenterId, status
                FROM collection_officer.collectionofficer
                WHERE empId = ?
                LIMIT 1
            `;

            connection.query(query, [empId], (err, results) => {
                connection.release();
                if (err) {
                    return reject(err);
                }
                resolve(results[0] || null);
            });
        });
    });
};
