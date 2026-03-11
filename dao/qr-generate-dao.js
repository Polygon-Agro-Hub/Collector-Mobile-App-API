const db = require("../startup/database");

exports.getUserByPhoneNumber = (phoneNumber) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT id, firstName, lastName, phoneNumber, NICnumber FROM users WHERE phoneNumber = ?";
    db.plantcare.query(sql, [phoneNumber], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.getBankDetailsByUserId = (userId) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT address, accNumber, accHolderName, bankName, branchName FROM userbankdetails WHERE userId = ?";
    db.plantcare.query(sql, [userId], (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};
