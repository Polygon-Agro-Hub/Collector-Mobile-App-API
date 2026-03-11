const db = require("../startup/database");

exports.getAllUsers = () => {
    return new Promise((resolve, reject) => {
        const sql =
            "SELECT id, firstName, lastName, phoneNumber, NICnumber, created_at FROM users";
        db.plantcare.query(sql, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

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
