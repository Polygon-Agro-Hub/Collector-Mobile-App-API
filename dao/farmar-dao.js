const db = require("../startup/database");

exports.checkUserExistsPhoneNumber = (phoneNumber) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT id FROM users WHERE phoneNumber = ?
        `;
        db.plantcare.query(sql, [phoneNumber], (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};

exports.checkUserExistsNIC = (NICnumber) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT id FROM users WHERE NICnumber = ?
        `;
        db.plantcare.query(sql, [NICnumber], (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};

// Function to insert user data into the database
exports.createUser = (
    firstName,
    lastName,
    NICnumber,
    formattedPhoneNumber,
    district,
    PreferdLanguage,
) => {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO users (firstName, lastName, NICnumber, phoneNumber, district, language)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.plantcare.query(
            sql,
            [
                firstName,
                lastName,
                NICnumber,
                formattedPhoneNumber,
                district,
                PreferdLanguage,
            ],
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            },
        );
    });
};

// Function to insert payment details into the database
exports.createPaymentDetails = (
    userId,
    accNumber,
    accHolderName,
    bankName,
    branchName,
) => {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO userbankdetails (userId, accNumber, accHolderName, bankName, branchName)
            VALUES (?, ?, ?, ?, ?)
        `;
        db.plantcare.query(
            sql,
            [userId, accNumber, accHolderName, bankName, branchName],
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            },
        );
    });
};

// Function to update the QR code file path in the users table
exports.updateQrCodePath = (userId, qrUrl) => {
    return new Promise((resolve, reject) => {
        const sql = `
            UPDATE users SET farmerQr = ? WHERE id = ?
        `;
        db.plantcare.query(sql, [qrUrl, userId], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

exports.getFarmerDetailsById = async (userId) => {
    const userSql = `
        SELECT firstName, lastName, NICnumber, farmerQr, phoneNumber, language
        FROM users 
        WHERE id = ?
    `;

    return new Promise((resolve, reject) => {
        db.plantcare.query(userSql, [userId], (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};

exports.getUserWithBankDetailsById = async (userId, centerId, companyId) => {
    const query = `
        SELECT
            u.id AS userId,
            u.firstName,
            u.lastName,
            u.phoneNumber,
            u.NICnumber,
            u.profileImage,
            u.farmerQr,
            b.accNumber,
            b.accHolderName,
            b.bankName,
            b.branchName,
            c.companyNameEnglish,
            cc.centerName,
            b.createdAt
        FROM users u
        LEFT JOIN userbankdetails b ON u.id = b.userId
        LEFT JOIN collection_officer.company c ON c.id = ?
        LEFT JOIN collection_officer.collectioncenter cc ON cc.id = ?
        WHERE u.id = ?;
    `;

    return new Promise((resolve, reject) => {
        db.plantcare.query(query, [companyId, centerId, userId], (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};

exports.checkSignupDetails = (phoneNumber, NICnumber) => {
    return new Promise((resolve, reject) => {
        let conditions = [];
        let params = [];

        if (phoneNumber) {
            const formattedPhoneNumber = `+${String(phoneNumber).replace(/^\+/, "")}`;
            conditions.push("phoneNumber = ?");
            params.push(formattedPhoneNumber);
        }

        if (NICnumber) {
            conditions.push("NICnumber = ?");
            params.push(NICnumber);
        }

        const checkQuery = `SELECT * FROM users WHERE ${conditions.join(" OR ")}`;

        db.plantcare.query(checkQuery, params, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
};

exports.createFarmer = (
    firstName,
    lastName,
    NICnumber,
    formattedPhoneNumber,
    district,
) => {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO users (firstName, lastName, NICnumber, phoneNumber, district)
            VALUES (?, ?, ?, ?, ?)
        `;
        db.plantcare.query(
            sql,
            [firstName, lastName, NICnumber, formattedPhoneNumber, district],
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            },
        );
    });
};

exports.getFarmersForSms = () => {
    return new Promise((resolve, reject) => {
        const query = `
        SELECT pu.phoneNumber, pu.language
        FROM collection_officer.collectionrequest cr
        JOIN plant_care.users pu ON cr.farmerId = pu.id
        WHERE cr.cancelStatus = 0
          AND DATE(cr.scheduleDate) = DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY);
      `;

        db.plantcare.query(query, (err, result) => {
            if (err) {
                console.error("Error fetching farmers for SMS:", err);
                return reject(err);
            }

            resolve(result);
        });
    });
};
