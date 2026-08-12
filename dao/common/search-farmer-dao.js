const db = require("../../startup/database");


exports.getUsers = (nic) => {
    return new Promise((resolve, reject) => {
        const sql =
            "SELECT id, firstName, lastName, phoneNumber, NICnumber, farmerQr, language,route,streetName, city,houseNo, created_at FROM users WHERE NICnumber = ?";
        db.plantcare.query(sql, [nic], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};
