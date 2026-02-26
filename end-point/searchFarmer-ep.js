const jwt = require("jsonwebtoken");
const searchFarmerDao = require("../dao/searchFarmer-dao");

exports.getAllUsers = async (req, res) => {
    try {
        const users = await searchFarmerDao.getAllUsers();
        res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "An error occurred while fetching users" });
    }
};

exports.getUsers = async (req, res) => {
    const nic = req.params.NICnumber;

    try {
        const users = await searchFarmerDao.getUsers(nic);

        if (users.length === 0) {
            return res
                .status(404)
                .json({ error: "No existing user found with the provided NIC number" });
        }

        res.status(200).json(users[0]);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "An error occurred while fetching users" });
    }
};
