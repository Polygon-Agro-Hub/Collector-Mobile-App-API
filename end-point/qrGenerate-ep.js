const qrGenerate = require("../dao/qrGenerate-dao");

exports.getUserData = async (req, res) => {
  const qrData = req.body.qrData;

  try {
    const userRows = await qrGenerate.getUserByPhoneNumber(qrData);

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRows[0];

    const bankDetailsRows = await qrGenerate.getBankDetailsByUserId(user.id);
    if (bankDetailsRows.length === 0) {
      return res.status(404).json({ message: "Bank details not found" });
    }

    const bankDetails = bankDetailsRows[0];

    const combinedUserData = {
      ...user,
      ...bankDetails,
    };

    res.status(200).json(combinedUserData);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ message: "Server error" });
  }
};
