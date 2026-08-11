const db = require("../../startup/database");



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