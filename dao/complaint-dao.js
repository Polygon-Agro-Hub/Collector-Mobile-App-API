const db = require("../startup/database");

exports.createComplaint = (
    complain,
    language,
    farmerId,
    category,
    status,
    officerId,
    referenceNumber,
) => {
    return new Promise((resolve, reject) => {
        const sql =
            "INSERT INTO farmercomplains (farmerId,  language, complain, complainCategory, status, coId, refNo , adminStatus) VALUES (?, ?, ?, ?, ?, ?, ?, 'Assigned')";

        const values = [
            farmerId,
            language,
            complain,
            category,
            status,
            officerId,
            referenceNumber,
        ];

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
            resolve(result[0]);
        });
    });
};

exports.createOfficerComplaint = (
    coId,
    setlanguage,
    complain,
    category,
    referenceNumber,
    officerRole,
) => {
    return new Promise((resolve, reject) => {
        let sql, values;

        if (
            officerRole === "Collection Centre Manager" ||
            officerRole === "Driver"
        ) {
            sql = `
                INSERT INTO officercomplains 
                (officerId, language, complain, complainCategory, CCMStatus, COOStatus, CCHStatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [
                coId,
                setlanguage,
                complain,
                category,
                "Opened",
                null,
                "Assigned",
                referenceNumber,
                "CCH",
            ];
        } else if (officerRole === "Collection Officer") {
            sql = `
                INSERT INTO officercomplains 
                (officerId, language, complain, complainCategory, CCMStatus, COOStatus, CCHStatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [
                coId,
                setlanguage,
                complain,
                category,
                "Assigned",
                "Opened",
                null,
                referenceNumber,
                "CCM",
            ];
        } else if (officerRole === "Distribution Centre Manager") {
            sql = `
                INSERT INTO distributedcomplains 
                (officerId, language, complain, complainCategory, DIOStatus, DCMStatus, DCHstatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [
                coId,
                setlanguage,
                complain,
                category,
                null,
                "Opened",
                "Assigned",
                referenceNumber,
                "DCH",
            ];
        } else if (officerRole === "Distribution Officer") {
            sql = `
                INSERT INTO distributedcomplains 
                (officerId, language, complain, complainCategory, DIOStatus, DCMStatus, DCHstatus, refNo, complainAssign)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            values = [
                coId,
                setlanguage,
                complain,
                category,
                "Opened",
                "Assigned",
                null,
                referenceNumber,
                "DCM",
            ];
        } else {
            return reject(new Error("Invalid officer role"));
        }

        db.collectionofficer.query(sql, values, (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result.insertId);
        });
    });
};

exports.getAllComplaintsByUserId = async (userId, officerRole) => {
    return new Promise((resolve, reject) => {
        let query, statusColumn;

        if (officerRole === "Collection Officer") {
            statusColumn = "COOStatus";
            query = `
                SELECT 
                    oc.id,
                    oc.complain,
                    oc.${statusColumn} AS status,
                    oc.createdAt,
                    oc.complainCategory,
                    oc.reply,
                    oc.refNo,
                    oc.complainAssign,
                    oc.replyTime,
                    co.firstNameEnglish AS replyByFirstNameEnglish,
                    co.firstNameSinhala AS replyByFirstNameSinhala,
                    co.firstNameTamil AS replyByFirstNameTamil,
                    co.lastNameEnglish AS replyByLastNameEnglish,
                    co.lastNameSinhala AS replyByLastNameSinhala,
                    co.lastNameTamil AS replyByLastNameTamil,
                    comp.companyNameEnglish,
                    comp.companyNameSinhala,
                    comp.companyNameTamil,
                    cc.centerName AS replierCenterName,
                    cc.regCode AS replierCenterRegCode
                FROM officercomplains oc
                LEFT JOIN collectionofficer co ON oc.replyBy = co.id
                LEFT JOIN company comp ON co.companyId = comp.id
                LEFT JOIN collectioncenter cc ON co.centerId = cc.id
                WHERE oc.officerId = ?
                ORDER BY oc.createdAt DESC
            `;
        } else if (
            officerRole === "Collection Centre Manager" ||
            officerRole === "Driver"
        ) {
            statusColumn = "CCMStatus";
            query = `
                SELECT 
                    oc.id,
                    oc.complain,
                    oc.${statusColumn} AS status,
                    oc.createdAt,
                    oc.complainCategory,
                    oc.reply,
                    oc.refNo,
                    oc.complainAssign,
                    oc.replyTime,
                    co.firstNameEnglish AS replyByFirstNameEnglish,
                    co.firstNameSinhala AS replyByFirstNameSinhala,
                    co.firstNameTamil AS replyByFirstNameTamil,
                    co.lastNameEnglish AS replyByLastNameEnglish,
                    co.lastNameSinhala AS replyByLastNameSinhala,
                    co.lastNameTamil AS replyByLastNameTamil,
                    comp.companyNameEnglish,
                    comp.companyNameSinhala,
                    comp.companyNameTamil,
                    cc.centerName AS replierCenterName,
                    cc.regCode AS replierCenterRegCode
                FROM officercomplains oc
                LEFT JOIN collectionofficer co ON oc.replyBy = co.id
                LEFT JOIN company comp ON co.companyId = comp.id
                LEFT JOIN collectioncenter cc ON co.centerId = cc.id
                WHERE oc.officerId = ?
                ORDER BY oc.createdAt DESC
            `;
        } else if (officerRole === "Distribution Centre Manager") {
            statusColumn = "DCMStatus";
            query = `
                SELECT 
                    dc.id,
                    dc.complain,
                    dc.${statusColumn} AS status,
                    dc.createdAt,
                    dc.complainCategory,
                    dc.reply,
                    dc.refNo,
                    dc.complainAssign,
                    dc.replyTime,
                    co.firstNameEnglish AS replyByFirstNameEnglish,
                    co.firstNameSinhala AS replyByFirstNameSinhala,
                    co.firstNameTamil AS replyByFirstNameTamil,
                    co.lastNameEnglish AS replyByLastNameEnglish,
                    co.lastNameSinhala AS replyByLastNameSinhala,
                    co.lastNameTamil AS replyByLastNameTamil,
                    comp.companyNameEnglish,
                    comp.companyNameSinhala,
                    comp.companyNameTamil,
                    dc_center.centerName AS replierCenterName,
                    dc_center.regCode AS replierCenterRegCode
                FROM distributedcomplains dc
                LEFT JOIN collectionofficer co ON dc.replyBy = co.id
                LEFT JOIN company comp ON co.companyId = comp.id
                LEFT JOIN distributedcenter dc_center ON co.distributedCenterId = dc_center.id
                WHERE dc.officerId = ?
                ORDER BY dc.createdAt DESC
            `;
        } else if (officerRole === "Distribution Officer") {
            statusColumn = "DIOStatus";
            query = `
                SELECT 
                    dc.id,
                    dc.complain,
                    dc.${statusColumn} AS status,
                    dc.createdAt,
                    dc.complainCategory,
                    dc.reply,
                    dc.refNo,
                    dc.complainAssign,
                    dc.replyTime,
                    co.firstNameEnglish AS replyByFirstNameEnglish,
                    co.firstNameSinhala AS replyByFirstNameSinhala,
                    co.firstNameTamil AS replyByFirstNameTamil,
                    co.lastNameEnglish AS replyByLastNameEnglish,
                    co.lastNameSinhala AS replyByLastNameSinhala,
                    co.lastNameTamil AS replyByLastNameTamil,
                    comp.companyNameEnglish,
                    comp.companyNameSinhala,
                    comp.companyNameTamil,
                    dc_center.centerName AS replierCenterName,
                    dc_center.regCode AS replierCenterRegCode
                FROM distributedcomplains dc
                LEFT JOIN collectionofficer co ON dc.replyBy = co.id
                LEFT JOIN company comp ON co.companyId = comp.id
                LEFT JOIN distributedcenter dc_center ON co.distributedCenterId = dc_center.id
                WHERE dc.officerId = ?
                ORDER BY dc.createdAt DESC
            `;
        } else {
            return reject(new Error("Invalid officer role"));
        }

        db.collectionofficer.query(query, [userId], (error, results) => {
            if (error) {
                console.error("Error fetching complaints:", error);
                reject(error);
            } else {
                const transformedResults = results.map((complaint) => {
                    let replyByOfficerName = null;

                    if (complaint.replyByFirstNameEnglish) {
                        replyByOfficerName =
                            `${complaint.replyByFirstNameEnglish || ""} ${complaint.replyByLastNameEnglish || ""}`.trim();
                    }

                    let companyName = complaint.companyNameEnglish || null;

                    return {
                        id: complaint.id,
                        complain: complaint.complain,
                        status: complaint.status,
                        createdAt: complaint.createdAt,
                        complainCategory: complaint.complainCategory,
                        reply: complaint.reply,
                        refNo: complaint.refNo,
                        complainAssign: complaint.complainAssign,
                        replyTime: complaint.replyTime,
                        replyByOfficerName: replyByOfficerName,
                        companyName: companyName,

                        replyByFirstNameEnglish: complaint.replyByFirstNameEnglish,
                        replyByFirstNameSinhala: complaint.replyByFirstNameSinhala,
                        replyByFirstNameTamil: complaint.replyByFirstNameTamil,
                        replyByLastNameEnglish: complaint.replyByLastNameEnglish,
                        replyByLastNameSinhala: complaint.replyByLastNameSinhala,
                        replyByLastNameTamil: complaint.replyByLastNameTamil,
                        companyNameEnglish: complaint.companyNameEnglish,
                        companyNameSinhala: complaint.companyNameSinhala,
                        companyNameTamil: complaint.companyNameTamil,

                        replierCenterName: complaint.replierCenterName,
                        replierCenterRegCode: complaint.replierCenterRegCode,
                    };
                });

                resolve(transformedResults);
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
            }
        });
    });
};

exports.countComplaintsByDate = async (date) => {
    const formattedDate = date.toISOString().split("T")[0];

    return new Promise((resolve, reject) => {
        const query = `SELECT COUNT(*) AS count FROM farmercomplains WHERE DATE(createdAt) = ?`;
        db.collectionofficer.query(query, [formattedDate], (error, results) => {
            if (error) {
                console.error("Error fetching complaints:", error);
                reject(error);
            } else {
                resolve(results[0].count);
            }
        });
    });
};

exports.countOfiicerComplaintsByDate = async (date, officerRole) => {
    const formattedDate = date.toISOString().split("T")[0];
    return new Promise((resolve, reject) => {
        let query;

        if (
            officerRole === "Distribution Centre Manager" ||
            officerRole === "Distribution Officer"
        ) {
            query = `SELECT COUNT(*) AS count FROM distributedcomplains WHERE DATE(createdAt) = ?`;
        } else {
            query = `SELECT COUNT(*) AS count FROM officercomplains WHERE DATE(createdAt) = ?`;
        }

        db.collectionofficer.query(query, [formattedDate], (error, results) => {
            if (error) {
                console.error("Error fetching complaints:", error);
                reject(error);
            } else {
                resolve(results[0].count);
            }
        });
    });
};

exports.countOfficerComplaintsByDateAndOfficer = async (date, officerId) => {
    const formattedDate = date.toISOString().split("T")[0];

    return new Promise((resolve, reject) => {
        const query = `
            SELECT COUNT(*) AS count 
            FROM officercomplains 
            WHERE DATE(createdAt) = ? AND officerId = ?
        `;

        db.collectionofficer.query(
            query,
            [formattedDate, officerId],
            (error, results) => {
                if (error) {
                    console.error("Error fetching officer complaints:", error);
                    reject(error);
                } else {
                    resolve(results[0].count);
                }
            },
        );
    });
};

exports.countDistributedComplaintsByDateAndOfficer = async (
    date,
    officerId,
) => {
    const formattedDate = date.toISOString().split("T")[0];

    return new Promise((resolve, reject) => {
        const query = `
            SELECT COUNT(*) AS count 
            FROM distributedcomplains 
            WHERE DATE(createdAt) = ? AND officerId = ?
        `;

        db.collectionofficer.query(
            query,
            [formattedDate, officerId],
            (error, results) => {
                if (error) {
                    console.error("Error fetching distributed complaints:", error);
                    reject(error);
                } else {
                    resolve(results[0].count);
                }
            },
        );
    });
};
