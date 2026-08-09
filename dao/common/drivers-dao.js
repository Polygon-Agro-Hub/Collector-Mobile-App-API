const db = require("../../startup/database"); 

exports.createDriverWithVehicle = (officerData, centerId, companyId, irmId) => {
  return new Promise((resolve, reject) => {
    // Get a connection from the pool
    db.collectionofficer.getConnection((connectionErr, connection) => {
      if (connectionErr) {
        return reject(new Error('Failed to get database connection: ' + connectionErr.message));
      }

      // Start a transaction
      connection.beginTransaction((transactionErr) => {
        if (transactionErr) {
          connection.release(); // Release the connection on error
          return reject(new Error('Failed to begin transaction: ' + transactionErr.message));
        }

        // SQL query for inserting the officer data
        const officerSql = `
          INSERT INTO collectionofficer (
            centerId, companyId, irmId, firstNameEnglish, firstNameSinhala, firstNameTamil, lastNameEnglish,
            lastNameSinhala, lastNameTamil, jobRole, empId, empType, phoneCode01, phoneNumber01, phoneCode02, phoneNumber02,
            nic, email, houseNumber, streetName, city, district, province, country,
            languages, accHolderName, accNumber, bankName, branchName, image, status, passwordUpdated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Approved', 0)
        `;

        connection.query(
          officerSql,
          [
            centerId,
            companyId,
            irmId,
            officerData.firstNameEnglish,
            officerData.firstNameSinhala || null,
            officerData.firstNameTamil || null,
            officerData.lastNameEnglish,
            officerData.lastNameSinhala || null,
            officerData.lastNameTamil || null,
            'Driver', 
            officerData.empId,
            officerData.empType,
            officerData.phoneCode01,
            officerData.phoneNumber01,
            officerData.phoneCode02 || null,
            officerData.phoneNumber02 || null,
            officerData.nic,
            officerData.email,
            officerData.houseNumber,
            officerData.streetName,
            officerData.city,
            officerData.district,
            officerData.province,
            officerData.country,
            officerData.languages,
            officerData.accHolderName || null,
            officerData.accNumber || null,
            officerData.bankName || null,
            officerData.branchName || null,
            officerData.profileImageUrl || null,
          ],
          (officerErr, officerResults) => {
            if (officerErr) {
              return connection.rollback(() => {
                connection.release(); // Release the connection on error
                reject(new Error('Failed to insert driver: ' + officerErr.message));
              });
            }

            // Get the inserted driver's ID
            const driverId = officerResults.insertId;

            // SQL query for inserting vehicle registration
            const vehicleSql = `
              INSERT INTO vehicleregistration (
                coId, licNo, insNo, insExpDate, vType, vCapacity, vRegNo, 
                licFrontImg, licBackImg, insFrontImg, insBackImg, 
                vehFrontImg, vehBackImg, vehSideImgA, vehSideImgB
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            connection.query(
              vehicleSql,
              [
                driverId,
                officerData.licNo || null,
                officerData.insNo || null,
                officerData.insExpDate || null,
                officerData.vType || null,
                officerData.vCapacity || null,
                officerData.vRegNo || null,
                officerData.licFrontImg || null,
                officerData.licBackImg || null,
                officerData.insFrontImg || null,
                officerData.insBackImg || null,
                officerData.vehFrontImg || null,
                officerData.vehBackImg || null,
                officerData.vehSideImgA || null,
                officerData.vehSideImgB || null
              ],
              (vehicleErr, vehicleResults) => {
                if (vehicleErr) {
                  return connection.rollback(() => {
                    connection.release(); // Release the connection on error
                    reject(new Error('Failed to insert vehicle registration: ' + vehicleErr.message));
                  });
                }

                // Commit the transaction
                connection.commit((commitErr) => {
                  if (commitErr) {
                    return connection.rollback(() => {
                      connection.release(); // Release the connection on error
                      reject(new Error('Failed to commit transaction: ' + commitErr.message));
                    });
                  }

                  // Release the connection back to the pool
                  connection.release();

                  // Resolve with both driver and vehicle details
                  resolve({
                    driverId: driverId,
                    vehicleId: vehicleResults.insertId
                  });
                });
              }
            );
          }
        );
      });
    });
  });
};

// Additional helper methods
exports.checkDriverExists = (nic, email) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id FROM collectionofficer WHERE nic = ? OR email = ?';

    db.collectionofficer.query(sql, [nic, email], (err, results) => {
      if (err) {
        console.error("Error checking driver existence:", err);
        return reject(err);
      }
      resolve(results.length > 0);
    });
  });
};

exports.checkPhoneExists = (phoneNumber) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id FROM collectionofficer WHERE CONCAT(phoneCode01, phoneNumber01) = ? OR CONCAT(phoneCode02, phoneNumber02) = ?';

    db.collectionofficer.query(sql, [phoneNumber, phoneNumber], (err, results) => {
      if (err) {
        console.error("Error checking phone existence:", err);
        return reject(err);
      }
      resolve(results.length > 0);
    });
  });
};



exports.checkNICExists = (nicNumber) => {
  return new Promise((resolve, reject) => {
    // Simple direct comparison is better here
    const sql = 'SELECT id FROM collectionofficer WHERE nic = ?';

    db.collectionofficer.query(sql, [nicNumber], (err, results) => {
      if (err) {
        console.error("Error checking NIC existence:", err);
        return reject(err);
      }
      resolve(results.length > 0);
    });
  });
};


exports.checkemailExists = (email) => {
  return new Promise((resolve, reject) => {
    // Simple direct comparison is better here
    const sql = 'SELECT id FROM collectionofficer WHERE email = ?';

    db.collectionofficer.query(sql, [email], (err, results) => {
      if (err) {
        console.error("Error checking Email existence:", err);
        return reject(err);
      }
      resolve(results.length > 0);
    });
  });
};