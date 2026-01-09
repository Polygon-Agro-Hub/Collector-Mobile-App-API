const pickupDao = require('../dao/pickUp-dao');
const asyncHandler = require('express-async-handler');


exports.getPickupOrders = async (req, res) => {
    console.log("pickup oreders called");
    try {
        // Get officerId from the decoded token (set by auth middleware)
        const officerId = req.user.id; // Assuming your auth middleware sets req.user

        console.log("Officer ID from token:", officerId);

        // Validate officerId
        if (!officerId || isNaN(officerId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid officer ID provided'
            });
        }

        // Get pickup from DAO
        const pickup = await pickupDao.getPickupOrders(officerId);

        console.log("pickup----------", pickup)


        res.status(200).json({
            success: true,
            message: 'Officer pickup retrieved successfully',
            data: pickup
        });
    } catch (error) {
        console.error('Error getting officer pickup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve officer pickup',
            error: error.message
        });
    }
};


exports.checkCustomer = asyncHandler(async (req, res) => {
    try {

        const customer = await pickupDao.checkCustome();

        if (!customer || customer.length === 0) {
            return res.status(404).json({ message: "No customer found" });
        }

        res.status(200).json({ status: "success", data: customer });
    } catch (error) {
        console.error("Error fetching customer:", error);
        res.status(500).json({ message: "Failed to fetch customer" });
    }
});

