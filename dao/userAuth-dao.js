const db = require("../startup/database");

// DAO for fetching officer details by empId
// exports.getOfficerByEmpId = (empId) => {
//   return new Promise((resolve, reject) => {
//     const sql =
//       "SELECT id, jobRole ,empId FROM collectionofficer WHERE empId = ?";
//     db.collectionofficer.query(sql, [empId], (err, results) => {
//       if (err) {
//         return reject(new Error("Database error"));
//       }
//       if (results.length === 0) {
//         return reject(new Error("Invalid Employee ID"));
//       }
//       resolve(results);
//       console.log("Results:", results);
//     });
//   });
// };
exports.getOfficerByEmpId = (empId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT id, jobRole, empId FROM collectionofficer WHERE empId = ?";

    db.collectionofficer.query(sql, [empId], (err, results) => {
      if (err) {
        console.error("Database Query Error:", err.message);
        return reject(new Error("Database query failed. Please try again."));
      }

      if (results.length === 0) {
        console.warn(`No officer found for Employee ID: ${empId}`);
        return resolve(null);  // Return null instead of rejecting
      }

      console.log("Results:", results);
      resolve(results);
    });
  });
};


// DAO for fetching officer details by ID
// exports.getOfficerPasswordById = (id) => {
//   return new Promise((resolve, reject) => {
//     const sql = "SELECT * FROM collectionofficer WHERE id = ?";
//     db.collectionofficer.query(sql, [id], (err, results) => {
//       if (err) {
//         return reject(new Error("Database error"));
//       }
//       if (results.length === 0) {
//         return reject(new Error("Invalid email or password"));
//       }
//       resolve(results);
//       console.log("Results:", results);
//     });
//   });
// };
// exports.getOfficerPasswordById = (id,jobRole) => {
//   return new Promise((resolve, reject) => {
//     const sql = `SELECT co.*, cod.companyNameEnglish AS companyNameEnglish, cod.companyNameSinhala AS companyNameSinhala, cod.companyNameTamil AS companyNameTamil,  ccen.id AS companycenterId
//      FROM 
//         collectionofficer co
//       JOIN 
//         company cod ON co.companyId = cod.id
//       JOIN
//         companycenter ccen ON co.centerId = ccen.centerId 
//      WHERE co.id = ?`;
//     db.collectionofficer.query(sql, [id], (err, results) => {
//       if (err) {
//         return reject(new Error("Database error"));
//       }
//       if (results.length === 0) {
//         return reject(new Error("Invalid email or password"));
//       }
//       resolve(results);
//       console.log("Results:", results);
//     });
//   });
// };

// exports.getOfficerPasswordById = (id, jobRole) => {
//   return new Promise((resolve, reject) => {
//     let sql;

//     // Determine which center table to join based on job role
//     if (jobRole === "Collection Officer" || jobRole === "Collection Center Manager") {
//       // For Collection roles, join with collectioncenter table using centerId
//       sql = `SELECT co.*, 
//                     cod.companyNameEnglish AS companyNameEnglish, 
//                     cod.companyNameSinhala AS companyNameSinhala, 
//                     cod.companyNameTamil AS companyNameTamil,  
//                     ccen.id AS companycenterId

//              FROM 
//                 collectionofficer co
//              JOIN 
//                 company cod ON co.companyId = cod.id
//              JOIN
//                 companycenter ccen ON co.centerId = ccen.centerId 
//              LEFT JOIN
//                 collectioncenter cc ON co.centerId = cc.id
//              WHERE co.id = ?`;
//     } else if (jobRole === "Distribution Center Manager" || jobRole === "Distribution Officer") {
//       // For Distribution roles, join with distributedcenter table using distributedCenterId
//       sql = `SELECT co.*, 
//                     cod.companyNameEnglish AS companyNameEnglish, 
//                     cod.companyNameSinhala AS companyNameSinhala, 
//                     cod.companyNameTamil AS companyNameTamil,  
//                     ccen.id AS companycenterId

//              FROM 
//                 collectionofficer co
//              JOIN 
//                 company cod ON co.companyId = cod.id
//              JOIN
//                 companycenter ccen ON co.distributedCenterId = ccen.centerId 
//              LEFT JOIN
//                 distributedcenter dc ON co.distributedCenterId = dc.id
//              WHERE co.id = ?`;
//     } else {
//       // For other roles or unknown roles, use the original query
//       sql = `SELECT co.*, 
//                     cod.companyNameEnglish AS companyNameEnglish, 
//                     cod.companyNameSinhala AS companyNameSinhala, 
//                     cod.companyNameTamil AS companyNameTamil,  
//                     ccen.id AS companycenterId
//              FROM 
//                 collectionofficer co
//              JOIN 
//                 company cod ON co.companyId = cod.id
//              JOIN
//                 companycenter ccen ON co.centerId = ccen.centerId 
//              WHERE co.id = ?`;
//     }

//     db.collectionofficer.query(sql, [id], (err, results) => {
//       if (err) {
//         console.error("Database query error:", err);
//         return reject(new Error("Database error"));
//       }
//       if (results.length === 0) {
//         return reject(new Error("Officer not found"));
//       }

//       console.log("Results:", results);
//       resolve(results);
//     });
//   });
// };

exports.getOfficerPasswordById = (id, jobRole) => {
  return new Promise((resolve, reject) => {
    let sql;

    // Determine which center table to join based on job role
    if (jobRole === "Collection Officer" || jobRole === "Collection Center Manager") {
      // For Collection roles, join with collectioncenter table using centerId
      sql = `SELECT co.*, 
                    cod.companyNameEnglish AS companyNameEnglish, 
                    cod.companyNameSinhala AS companyNameSinhala, 
                    cod.companyNameTamil AS companyNameTamil,  
                    ccen.id AS companycenterId
             FROM 
                collectionofficer co
             JOIN 
                company cod ON co.companyId = cod.id
             JOIN
                companycenter ccen ON co.centerId = ccen.centerId 
             LEFT JOIN
                collectioncenter cc ON co.centerId = cc.id
             WHERE co.id = ?`;
    } else if (jobRole === "Distribution Center Manager" || jobRole === "Distribution Officer") {
      // For Distribution roles, join with distributedcenter table using distributedCenterId
      sql = `SELECT co.*, 
                    cod.companyNameEnglish AS companyNameEnglish, 
                    cod.companyNameSinhala AS companyNameSinhala, 
                    cod.companyNameTamil AS companyNameTamil,  
                    ccen.id AS companycenterId
             FROM 
                collectionofficer co
             JOIN 
                company cod ON co.companyId = cod.id
             JOIN
                companycenter ccen ON co.distributedCenterId = ccen.centerId 
             LEFT JOIN
                distributedcenter dc ON co.distributedCenterId = dc.id
             WHERE co.id = ?`;
    } else {
      // For other roles or when jobRole is undefined/null, use a simpler query
      // that should work for most cases
      sql = `SELECT co.*, 
                    cod.companyNameEnglish AS companyNameEnglish, 
                    cod.companyNameSinhala AS companyNameSinhala, 
                    cod.companyNameTamil AS companyNameTamil
             FROM 
                collectionofficer co
             JOIN 
                company cod ON co.companyId = cod.id
             WHERE co.id = ?`;
    }

    console.log("Executing SQL for officer ID:", id, "with job role:", jobRole);

    db.collectionofficer.query(sql, [id], (err, results) => {
      if (err) {
        console.error("Database query error:", err);
        return reject(new Error("Database error"));
      }
      if (results.length === 0) {
        console.warn(`No officer found with ID: ${id} and job role: ${jobRole}`);
        return reject(new Error("Officer not found"));
      }

      console.log("Officer found:", results[0]);
      resolve(results);
    });
  });
};


exports.updateLoginStatus = (collectionOfficerId, status) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE collectionofficer SET OnlineStatus = ? WHERE id = ?";
    db.collectionofficer.query(sql, [status, collectionOfficerId], (err, results) => {
      if (err) {
        return reject(new Error("Database error"));
      }
      resolve(results);
      console.log(results)
    })
  })
}


exports.updatePasswordInDatabase = (collectionOfficerId, hashedPassword) => {
  return new Promise((resolve, reject) => {
    const updatePasswordSql = `
            UPDATE collectionofficer
            SET password = ? , passwordUpdated = 1
            WHERE id = ?
        `;
    db.collectionofficer.query(
      updatePasswordSql,
      [hashedPassword, collectionOfficerId],
      (err, result) => {
        if (err) {
          return reject("Database error while updating password");
        }
        resolve(); // Password updated successfully
      }
    );
  });
};

exports.getProfileById = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
                firstNameEnglish, firstNameSinhala, firstNameTamil,
                lastNameEnglish, lastNameSinhala, lastNameTamil,
                phoneNumber01, phoneNumber02, image, nic, email, 
                houseNumber, streetName, city, district, province, 
                country, languages
            FROM collectionofficer
            WHERE id = ?
        `;

    db.collectionofficer.query(sql, [userId], (err, results) => {
      if (err) {
        return reject(new Error('Database error: ' + err));
      }

      if (results.length === 0) {
        return reject(new Error('User not found'));
      }

      resolve(results[0]);
    });
  });
};


exports.getUserDetailsById = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `
            SELECT 
              co.firstNameEnglish AS firstName,
              co.lastNameEnglish AS lastName,
              co.phoneNumber01 AS phoneNumber,
              co.nic AS nicNumber,
              CONCAT(co.houseNumber, ', ', co.streetName, ', ', co.city) AS address,
              cod.empid,
              cod.companyNameEnglish AS companyName,
              cod.jobRole AS jobRole,
              cod.assignedDistrict AS regcode
            FROM collectionofficer AS co
            JOIN collectionofficercompanydetails AS cod 
              ON cod.collectionOfficerId = co.id
            WHERE co.id = ?
        `;

    db.collectionofficer.query(sql, [userId], (err, results) => {
      if (err) {
        return reject(new Error('Database error: ' + err));
      }
      if (results.length === 0) {
        return reject(new Error('User not found'));
      }
      resolve(results[0]);
    });
  });
};


exports.updatePhoneNumberById = (userId, phoneNumber, phoneNumber02) => {
  console.log("DAO: updatePhoneNumberById", phoneNumber02);
  return new Promise((resolve, reject) => {
    const query = 'UPDATE collectionofficer SET phoneNumber01 = ?, phoneNumber02 =? WHERE id = ?';
    db.collectionofficer.query(query, [phoneNumber, phoneNumber02, userId], (error, results) => {
      if (error) {
        return reject(new Error('Database error: ' + error));
      }
      resolve(results);
      console.log("DAO: updatePhoneNumberById", results);
    });
  });
};


exports.getQRCodeByOfficerId = (officerId) => {
  return new Promise((resolve, reject) => {
    const query = `
            SELECT QRcode 
            FROM collectionofficer
            WHERE id = ?
        `;

    db.collectionofficer.query(query, [officerId], (error, results) => {
      if (error) {
        console.error('Error fetching officer QR code from DB:', error);
        return reject(new Error('Database query failed'));
      }
      resolve(results);
    });
  });
};


// ------------created below codes after the collection officer update ------------- 

exports.getOfficerDetailsById = (officerId, jobRole) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        co.*, 
        co.empId,
        cc.regCode,
        cc.centerName AS collectionCenterName,
        cc.contact01 AS centerContact01,
        cc.contact02 AS centerContact02,
        cc.buildingNumber AS centerBuildingNumber,
        cc.street AS centerStreet,
        cc.district AS centerDistrict,
        cc.province AS centerProvince,
        com.companyNameEnglish AS companyNameEnglish,
        com.companyNameSinhala AS companyNameSinhala,
        com.companyNameTamil AS companyNameTamil,
        com.email AS companyEmail,
        com.oicName AS companyOICName,
        com.oicEmail AS companyOICEmail
      FROM 
        collectionofficer co
      JOIN 
        collectioncenter cc ON co.centerId = cc.id
      JOIN 
        company com ON co.companyId = com.id
      WHERE 
        co.id = ?;
    `;
    if (jobRole === "Distribution Center Manager" || jobRole === "Distribution Officer") {
      sql = `
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
      `
    }

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



//claim status
// exports.getClaimStatusByUserId = (userId) => {
//   return new Promise((resolve, reject) => {
//     const sql = `SELECT claimStatus FROM collectionofficer WHERE id = ?`;
//     db.collectionofficer.query(sql, [userId], (err, results) => {
//       if (err) {
//         console.error('Error fetching claim status:', err);
//         reject(new Error('Database query failed'));
//         return;
//       }

//       if (results.length > 0) {
//         resolve(results[0].claimStatus);
//       } else {
//         resolve(null);
//       }
//     });
//   });
// };
exports.getClaimStatusByUserId = (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT claimStatus FROM collectionofficer WHERE id = ?`;

    db.collectionofficer.query(sql, [userId], (err, results) => {
      if (err) {
        console.error('Error fetching claim status:', err);
        reject(new Error('Database query failed'));
        return;
      }

      if (results.length > 0) {
        resolve(results[0].claimStatus);
      } else {
        resolve(null);  // No result found
      }
    });
  });
};


exports.updateOnlineStatusWithSocket = async (empId, status) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE collectionofficer SET onlineStatus = ? WHERE empId = ?`;
    db.collectionofficer.query(sql, [status, empId], (err, results) => {
      if (err) {
        console.error('Error updating online status:', err);
        reject(new Error('Database query failed'));
        return;
      }
      resolve(null);
    });
  });
}


// exports.updateOnlineStatusWithSocket = async (empId, status) => {
//   try {
//     await collectionofficer.promise().query(
//       "UPDATE collectionofficer SET onlineStatus = ? WHERE empId = ?",
//       [status, empId]
//     );
//   } catch (error) {
//     console.error(`Error updating online status for ${empId}:`, error);
//     throw new Error("Failed to update status");
//   }
// };

exports.getUserProfileImage = async (userId) => {
  return new Promise((resolve, reject) => {
    const sql = "SELECT image FROM collectionofficer WHERE id = ?";
    db.collectionofficer.query(sql, [userId], (err, results) => {
      if (err) {
        reject(err);
      } else if (results.length > 0) {
        resolve(results[0].profileImage);
      } else {
        resolve(null);
      }
    });
  });
};

exports.updateUserProfileImage = async (userId, profileImageUrl) => {
  return new Promise((resolve, reject) => {
    const sql = "UPDATE collectionofficer SET image = ? WHERE id = ?";
    db.collectionofficer.query(sql, [profileImageUrl, userId], (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
        console.log(result);
      }
    });
  });
};



exports.getPassword = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `       
      SELECT 
        id,         
       
        empId,          
       passwordUpdated,
        createdAt
      FROM salesagent        
      WHERE id = ?     
    `;

    db.marketPlace.query(sql, [id], (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return reject(new Error('Database error'));
      }

      if (results.length === 0) {
        return reject(new Error('User not found'));
      }


      console.log("Raw DB result:", JSON.stringify(results[0]).substring(0, 200) + "...");
      console.log("Image exists:", results[0].image ? "Yes" : "No");


      resolve(results[0]);
    });
  });
};
