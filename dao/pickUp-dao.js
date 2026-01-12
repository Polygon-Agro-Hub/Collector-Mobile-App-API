const { collectionofficer, marketPlace } = require("../startup/database");
const db = require('../startup/database');

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
                u.phoneCode,
                u.phoneNumber,
                u.phoneCode2,
                u.phoneNumber2,
                u.email,
                u.buyerType,
                u.companyName,
                u.companyPhoneCode,
                u.companyPhone,
                
                COALESCE(oh.city, oa.city) AS customerCity,
                COALESCE(oh.houseNo, oa.houseNo) AS houseNo,
                COALESCE(oh.streetName, oa.streetName) AS streetName,
                
                dc.district AS distributionDistrict,
                dc.centerName,
                dc.regCode,
                
                co.firstNameEnglish AS officerFirstName,
                co.lastNameEnglish AS officerLastName
                
            FROM collection_officer.collectionofficer co
            
            INNER JOIN collection_officer.distributedcenter dc 
                ON co.distributedCenterId = dc.id
            
            INNER JOIN market_place.orders o 
                ON o.buildingType IN ('house', 'apartment')
            
            LEFT JOIN market_place.orderhouse oh 
                ON o.id = oh.orderId 
                AND o.buildingType = 'house'
                AND oh.city = dc.district
            
            LEFT JOIN market_place.orderapartment oa 
                ON o.id = oa.orderId 
                AND o.buildingType = 'apartment'
                AND oa.city = dc.district
            
            INNER JOIN market_place.processorders po 
                ON o.id = po.orderId
                AND po.status = 'Ready to Pickup'
            
            INNER JOIN market_place.marketplaceusers u 
                ON o.userId = u.id
            
            WHERE co.id = ?
                AND (oh.city IS NOT NULL OR oa.city IS NOT NULL)
            
            ORDER BY o.createdAt DESC;
        `;

        // Use collectionofficer pool since the main table is from that database
        // MySQL will handle the cross-database joins automatically
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

// exports.updatePickupDetails = async (officerId, orderId, signatureUrl) => {
//     try {
//         // Add .promise() before .query()
//         const getProcessOrderQuery = `
//             SELECT id 
//             FROM market_place.processorders 
//             WHERE invNo = ?
//         `;

//         const [processOrderResult] = await db.marketPlace.promise().query(getProcessOrderQuery, [orderId]);

//         if (!processOrderResult || processOrderResult.length === 0) {
//             throw new Error('Order not found with the given invoice number');
//         }

//         const processOrderId = processOrderResult[0].id;

//         const insertQuery = `
//             INSERT INTO collection_officer.pickuporders 
//             (orderId, orderIssuedOfficer, signature, createdAt) 
//             VALUES (?, ?, ?, NOW())
//         `;

//         const [result] = await db.collectionofficer.promise().query(insertQuery, [
//             processOrderId,
//             officerId,
//             signatureUrl
//         ]);

//         return {
//             success: true,
//             insertId: result.insertId,
//             processOrderId: processOrderId,
//             signatureUrl: signatureUrl,
//             message: 'Pickup details updated successfully'
//         };
//     } catch (error) {
//         console.error('Error in updatePickupDetails DAO:', error);
//         throw error;
//     }
// };


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