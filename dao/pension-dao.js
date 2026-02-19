const db = require("../startup/database");

// Check Pension Request by NIC number
exports.checkPensionRequestByNIC = (nic) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
                pr.id, 
                pr.reqStatus, 
                pr.defaultPension,
                pr.createdAt as requestCreatedAt,
                u.created_at as userCreatedAt,
                u.id as userId,
                u.firstName,
                u.lastName,
                u.NICnumber
            FROM pensionrequest pr
            INNER JOIN users u ON pr.userId = u.id
            WHERE u.NICnumber = ? 
            LIMIT 1
        `;

    db.plantcare.query(sql, [nic], (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        reject(err);
      } else {
        if (results.length === 0) {
          resolve(null);
        } else {
          resolve(results[0]);
        }
      }
    });
  });
};

// Get User by NIC (NEW FUNCTION)
exports.getUserByNIC = (nic) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT id, firstName, lastName, phoneNumber, NICnumber 
            FROM users 
            WHERE NICnumber = ? 
            LIMIT 1
        `;

    db.plantcare.query(sql, [nic], (err, results) => {
      if (err) {
        console.error("Error getting user by NIC:", err);
        reject(err);
      } else {
        if (results.length === 0) {
          resolve(null);
        } else {
          resolve(results[0]);
        }
      }
    });
  });
};

// Submit Pension Request
exports.submitPensionRequestDAO = (pensionData) => {
  return new Promise((resolve, reject) => {
    const query = `
            INSERT INTO pensionrequest (
                userId, officerId, fullName, nic, nicFront, nicBack, dob,
                sucFullName, sucType, sucNic, sucNicFront, sucNicBack, 
                birthCrtFront, birthCrtBack, sucdob,
                reqStatus, isFirstTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'To Review', 1)
        `;

    db.plantcare.query(
      query,
      [
        pensionData.userId,
        pensionData.officerId, 
        pensionData.fullName,
        pensionData.nic,
        pensionData.nicFront,
        pensionData.nicBack,
        pensionData.dob,
        pensionData.sucFullName,
        pensionData.sucType,
        pensionData.sucNic || null,
        pensionData.sucNicFront || null,
        pensionData.sucNicBack || null,
        pensionData.birthCrtFront || null,
        pensionData.birthCrtBack || null,
        pensionData.sucdob,
      ],
      (err, result) => {
        if (err) {
          console.error("Error creating pension request:", err);
          reject(err);
        } else {
          resolve(result.insertId);
        }
      },
    );
  });
};

// Check Pension Request by User ID
exports.checkPensionRequestByUserId = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
                pr.id, 
                pr.reqStatus, 
                pr.defaultPension,
                pr.createdAt as requestCreatedAt,
                u.created_at as userCreatedAt
            FROM pensionrequest pr
            INNER JOIN users u ON pr.userId = u.id
            WHERE pr.userId = ? 
            LIMIT 1
        `;

    db.plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        reject(err);
      } else {
        if (results.length === 0) {
          resolve(null);
        } else {
          resolve(results[0]);
        }
      }
    });
  });
};

// Get User by ID
exports.getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT id, firstName, lastName, phoneNumber, NICnumber 
            FROM users 
            WHERE id = ? 
            LIMIT 1
        `;

    db.plantcare.query(sql, [userId], (err, results) => {
      if (err) {
        console.error("Error getting user by ID:", err);
        reject(err);
      } else {
        if (results.length === 0) {
          resolve(null);
        } else {
          resolve(results[0]);
        }
      }
    });
  });
};
