const db = require('../startup/database');

exports.createComplaint = (complain, language, farmerId, category, status, officerId, referenceNumber) => {
    return new Promise((resolve, reject) => {
        const sql =
            "INSERT INTO farmercomplains (farmerId,  language, complain, complainCategory, status, coId, refNo , adminStatus) VALUES (?, ?, ?, ?, ?, ?, ?, 'Assigned')";

        const values = [farmerId, language, complain, category, status, officerId, referenceNumber];

        db.collectionofficer.query(sql, values, (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result);
        });
    });
};

exports.checkIfUserExists = (userId) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT id FROM users WHERE id = ?";
        db.plantcare.query(sql, [userId], (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result[0]); // Returns true if user exists, false otherwise
        });
    });
};

// exports.createOfficerComplaint = (coId, setlanguage, complain, category, status, referenceNumber, officerRole) => {
//     console.log("complain hitttt")
//     return new Promise((resolve, reject) => {
//         const sql =
//             "INSERT INTO officercomplains (officerId,  language, complain, complainCategory, CCMStatus, refNo) VALUES (?, ?, ?, ?, ?, ?)";

//         const values = [coId, setlanguage, complain, category, status, referenceNumber, assignedStatus];

//         db.collectionofficer.query(sql, values, (err, result) => {
//             if (err) {
//                 return reject(err);
//             }
//             resolve(result);
//         });
//     });
// };


exports.createOfficerComplaint = (
    coId,
    setlanguage,
    complain,
    category,
    referenceNumber,
    officerRole
) => {
    console.log("hit 4")
    return new Promise((resolve, reject) => {
        let sql, values;

        if (officerRole === 'Collection Center Manager' || officerRole === 'Driver') {
            sql = `
                INSERT INTO officercomplains 
                (officerId, language, complain, complainCategory, CCMStatus, COOStatus, CCHStatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [coId, setlanguage, complain, category, 'Opened', null, 'Assigned', referenceNumber, 'CCH'];

        } else if (officerRole === 'Collection Officer') {
            sql = `
                INSERT INTO officercomplains 
                (officerId, language, complain, complainCategory, CCMStatus, COOStatus, CCHStatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [coId, setlanguage, complain, category, 'Assigned', 'Opened', null, referenceNumber, 'CCM'];

        } else if (officerRole === 'Distribution Center Manager') {
            sql = `
                INSERT INTO distributedcomplains 
                (officerId, language, complain, complainCategory, DIOStatus, DCMStatus, DCHstatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [coId, setlanguage, complain, category, null, 'Opened', 'Assigned', referenceNumber, 'DCH'];

        } else if (officerRole === 'Distribution Officer') {
            sql = `
                INSERT INTO distributedcomplains 
                (officerId, language, complain, complainCategory, DIOStatus, DCMStatus, DCHstatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [coId, setlanguage, complain, category, 'Opened', 'Assigned', null, referenceNumber, 'DCM'];

        } else {
            return reject(new Error('Invalid officer role'));
        }

        db.collectionofficer.query(sql, values, (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result.insertId); // Return the inserted ID
        });
    });
};


// exports.getAllComplaintsByUserId = async (userId, officerRole) => {
//     return new Promise((resolve, reject) => {
//         // Choose status column based on role
//         let statusColumn;
//         if (officerRole === 'Collection Officer') {
//             statusColumn = 'COOStatus';
//         } else if (officerRole === 'Collection Center Manager' || officerRole === 'Driver') {
//             statusColumn = 'CCMStatus';
//         } else {
//             return reject(new Error('Invalid officer role'));
//         }

//         const query = `
//             SELECT 
//                 id, 
//                 language, 
//                 complain, 
//                 ${statusColumn} AS status, 
//                 createdAt, 
//                 complainCategory, 
//                 reply, 
//                 refNo
//             FROM officercomplains 
//             WHERE officerId = ?
//             ORDER BY createdAt DESC
//         `;

//         db.collectionofficer.query(query, [userId], (error, results) => {
//             if (error) {
//                 console.error("Error fetching complaints:", error);
//                 reject(error);
//             } else {
//                 resolve(results);
//             }
//         });
//     });
// };


exports.createOfficerComplaint = (
    coId,
    setlanguage,
    complain,
    category,
    referenceNumber,
    officerRole
) => {
    console.log("hit 4")
    return new Promise((resolve, reject) => {
        let sql, values;

        if (officerRole === 'Collection Center Manager' || officerRole === 'Driver') {
            sql = `
                INSERT INTO officercomplains 
                (officerId, language, complain, complainCategory, CCMStatus, COOStatus, CCHStatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [coId, setlanguage, complain, category, 'Opened', null, 'Assigned', referenceNumber, 'CCH'];

        } else if (officerRole === 'Collection Officer') {
            sql = `
                INSERT INTO officercomplains 
                (officerId, language, complain, complainCategory, CCMStatus, COOStatus, CCHStatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [coId, setlanguage, complain, category, 'Assigned', 'Opened', null, referenceNumber, 'CCM'];

        } else if (officerRole === 'Distribution Center Manager') {
            sql = `
                INSERT INTO distributedcomplains 
                (officerId, language, complain, complainCategory, DIOStatus, DCMStatus, DCHstatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [coId, setlanguage, complain, category, null, 'Opened', 'Assigned', referenceNumber, 'DCH'];

        } else if (officerRole === 'Distribution Officer') {
            sql = `
                INSERT INTO distributedcomplains 
                (officerId, language, complain, complainCategory, DIOStatus, DCMStatus, DCHstatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [coId, setlanguage, complain, category, 'Opened', 'Assigned', null, referenceNumber, 'DCM'];

        } else {
            return reject(new Error('Invalid officer role'));
        }

        db.collectionofficer.query(sql, values, (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result.insertId); // Return the inserted ID
        });
    });
};

exports.getAllComplaintsByUserId = async (userId, officerRole) => {
    return new Promise((resolve, reject) => {
        let query, statusColumn;

        if (officerRole === 'Collection Officer') {
            statusColumn = 'COOStatus';
            query = `
                SELECT 
                    id,
                    language,
                    complain,
                    ${statusColumn} AS status,
                    createdAt,
                    complainCategory,
                    reply,
                    refNo
                FROM officercomplains 
                WHERE officerId = ?
                ORDER BY createdAt DESC
            `;
        } else if (officerRole === 'Collection Center Manager' || officerRole === 'Driver') {
            statusColumn = 'CCMStatus';
            query = `
                SELECT 
                    id,
                    language,
                    complain,
                    ${statusColumn} AS status,
                    createdAt,
                    complainCategory,
                    reply,
                    refNo
                FROM officercomplains 
                WHERE officerId = ?
                ORDER BY createdAt DESC
            `;
        } else if (officerRole === 'Distribution Center Manager') {
            statusColumn = 'DCMStatus';
            query = `
                SELECT 
                    id,
                    language,
                    complain,
                    ${statusColumn} AS status,
                    createdAt,
                    complainCategory,
                    reply,
                    refNo
                FROM distributedcomplains 
                WHERE officerId = ?
                ORDER BY createdAt DESC
            `;
        } else if (officerRole === 'Distribution Officer') {
            statusColumn = 'DIOStatus';
            query = `
                SELECT 
                    id,
                    language,
                    complain,
                    ${statusColumn} AS status,
                    createdAt,
                    complainCategory,
                    reply,
                    refNo
                FROM distributedcomplains 
                WHERE officerId = ?
                ORDER BY createdAt DESC
            `;
        } else {
            return reject(new Error('Invalid officer role'));
        }

        db.collectionofficer.query(query, [userId], (error, results) => {
            if (error) {
                console.error("Error fetching complaints:", error);
                reject(error);
            } else {
                resolve(results);
            }
        });
    });
};


exports.getComplainCategories = async (appName) => {
    return new Promise((resolve, reject) => {
        const query = `
                   SELECT cc.id, cc.roleId, cc.appId, cc.categoryEnglish, cc.categorySinhala, cc.categoryTamil, ssa.appName
                FROM complaincategory cc
                JOIN systemapplications ssa ON cc.appId = ssa.id
                WHERE ssa.appName = ?
      `;
        db.admin.query(query, [appName], (error, results) => {
            if (error) {
                console.error("Error fetching complaints:", error);
                reject(error);
            } else {
                resolve(results);
                console.log(results)
            }
        });
    });
};

exports.countComplaintsByDate = async (date) => {
    const formattedDate = date.toISOString().split('T')[0]; // Convert date to YYYY-MM-DD

    // Return a promise that resolves the count
    return new Promise((resolve, reject) => {
        const query = `SELECT COUNT(*) AS count FROM farmercomplains WHERE DATE(createdAt) = ?`;
        db.collectionofficer.query(query, [formattedDate], (error, results) => {
            if (error) {
                console.error("Error fetching complaints:", error);
                reject(error);  // Reject the promise on error
            } else {
                resolve(results[0].count);  // Resolve the promise with the count
            }
        });
    });
};

exports.countOfiicerComplaintsByDate = async (date) => {
    const formattedDate = date.toISOString().split('T')[0]; // Convert date to YYYY-MM-DD
    return new Promise((resolve, reject) => {
        const query = `SELECT COUNT(*) AS count FROM officercomplains WHERE DATE(createdAt) = ?`;
        db.collectionofficer.query(query, [formattedDate], (error, results) => {
            if (error) {
                console.error("Error fetching complaints:", error);
                reject(error);  // Reject the promise on error
            } else {
                resolve(results[0].count);  // Resolve the promise with the count
            }
        });
    });
};