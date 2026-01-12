const pickupDao = require('../dao/pickUp-dao');
const asyncHandler = require('express-async-handler');
const uploadFileToS3 = require('../Middlewares/s3upload');


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



exports.updatePickupDetails = async (req, res) => {
    try {
        const { orderId } = req.body;
        const officerId = req.user.id;
        const signatureFile = req.file; // From multer

        if (!orderId) {
            return res.status(400).json({
                status: 'error',
                message: 'Order ID is required'
            });
        }

        if (!signatureFile) {
            return res.status(400).json({
                status: 'error',
                message: 'Signature file is required'
            });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(signatureFile.mimetype)) {
            return res.status(400).json({
                status: 'error',
                message: 'Only JPEG, JPG, and PNG images are allowed'
            });
        }

        // Upload signature to S3/R2
        const signatureUrl = await uploadFileToS3(
            signatureFile.buffer,
            signatureFile.originalname,
            'pickup-signatures'
        );

        // Call the DAO to insert the pickupDetails into the database
        const pickupDetails = await pickupDao.updatePickupDetails(
            officerId,
            orderId,
            signatureUrl
        );

        console.log('Pickup details updated:', pickupDetails);

        return res.status(201).json({
            status: 'success',
            message: 'Pickup details registered successfully',
            data: {
                insertId: pickupDetails.insertId,
                processOrderId: pickupDetails.processOrderId,
                signatureUrl: pickupDetails.signatureUrl
            }
        });
    } catch (error) {
        console.error('Error inserting pickupDetails:', error);

        if (error.message === 'Order not found with the given invoice number') {
            return res.status(404).json({
                status: 'error',
                message: error.message
            });
        }

        if (error.message === 'Failed to upload file to R2') {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to upload signature file'
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Internal Server Error'
        });
    }
};



exports.getReceivedOrders = async (req, res) => {
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
        const pickup = await pickupDao.getReceivedOrders(officerId);

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