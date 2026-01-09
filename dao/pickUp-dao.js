const { collectionofficer, marketPlace } = require("../startup/database");

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
