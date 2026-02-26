const pickupDao = require("../dao/pickUp-dao");
const asyncHandler = require("express-async-handler");
const uploadFileToS3 = require("../Middlewares/s3upload");

exports.getPickupOrders = async (req, res) => {
    try {
        const officerId = req.user.id;

        if (!officerId || isNaN(officerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid officer ID provided",
            });
        }

        const pickup = await pickupDao.getPickupOrders(officerId);

        res.status(200).json({
            success: true,
            message: "Officer pickup retrieved successfully",
            data: pickup,
        });
    } catch (error) {
        console.error("Error getting officer pickup:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve officer pickup",
            error: error.message,
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
        const role = req.user.role;
        const signatureFile = req.file;

        if (!orderId) {
            return res.status(400).json({
                status: "error",
                message: "Order ID is required",
            });
        }

        if (!signatureFile) {
            return res.status(400).json({
                status: "error",
                message: "Signature file is required",
            });
        }

        const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
        if (!allowedTypes.includes(signatureFile.mimetype)) {
            return res.status(400).json({
                status: "error",
                message: "Only JPEG, JPG, and PNG images are allowed",
            });
        }

        const signatureUrl = await uploadFileToS3(
            signatureFile.buffer,
            signatureFile.originalname,
            "pickup-signatures",
        );

        const pickupDetails = await pickupDao.updatePickupDetails(
            officerId,
            orderId,
            signatureUrl,
            role,
        );

        return res.status(201).json({
            status: "success",
            message: "Pickup details registered successfully",
            data: {
                insertId: pickupDetails.insertId,
                processOrderId: pickupDetails.processOrderId,
                signatureUrl: pickupDetails.signatureUrl,
            },
        });
    } catch (error) {
        console.error("Error inserting pickupDetails:", error);

        if (error.message === "Order not found with the given invoice number") {
            return res.status(404).json({
                status: "error",
                message: error.message,
            });
        }

        if (error.message === "Failed to upload file to R2") {
            return res.status(500).json({
                status: "error",
                message: "Failed to upload signature file",
            });
        }

        return res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
};

exports.getReceivedOrders = async (req, res) => {
    try {
        const officerId = req.user.id;

        if (!officerId || isNaN(officerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid officer ID provided",
            });
        }

        const pickup = await pickupDao.getReceivedOrders(officerId);

        res.status(200).json({
            success: true,
            message: "Officer pickup retrieved successfully",
            data: pickup,
        });
    } catch (error) {
        console.error("Error getting officer pickup:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve officer pickup",
            error: error.message,
        });
    }
};

exports.getReceivedOrderOfficer = async (req, res) => {
    try {
        const officerId = req.user.id;

        if (!officerId || isNaN(officerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid officer ID provided",
            });
        }

        const pickup = await pickupDao.getReceivedOrderOfficer(officerId);

        res.status(200).json({
            success: true,
            message: "Officer pickup retrieved successfully",
            data: pickup,
        });
    } catch (error) {
        console.error("Error getting officer pickup:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve officer pickup",
            error: error.message,
        });
    }
};

exports.updateCashReceived = asyncHandler(async (req, res) => {
    const { transactions, officerCode, totalAmount } = req.body;
    const centerId = req.user.centerId;

    if (
        !transactions ||
        !Array.isArray(transactions) ||
        transactions.length === 0
    ) {
        return res.status(400).json({
            status: "error",
            message: "Transactions array is required",
        });
    }

    if (!officerCode) {
        return res.status(400).json({
            status: "error",
            message: "Officer code is required",
        });
    }

    try {
        const officer = await pickupDao.getOfficerByEmpId(officerCode);

        if (!officer) {
            return res.status(404).json({
                status: "error",
                message: "Cash officer not found",
            });
        }

        if (officer.distributedCenterId !== centerId) {
            return res.status(403).json({
                status: "error",
                message: "This DCM officer is not in the same centre",
            });
        }

        if (officer.status !== "Approved") {
            return res.status(403).json({
                status: "error",
                message: "This Manager's ID is not acceptable.",
            });
        }

        const updateResults = await pickupDao.updateCashReceived(
            transactions,
            officer.id,
            totalAmount,
        );

        res.status(200).json({
            status: "success",
            message: "Cash successfully handed over",
            data: {
                officerCode: officerCode,
                officerId: officer.id,
                totalAmount: totalAmount,
                transactionsUpdated: updateResults.affectedRows,
                handoverTime: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Error in updateCashReceived:", error);

        if (error.message.includes("already handed over")) {
            return res.status(409).json({
                status: "error",
                message: error.message,
            });
        }

        res.status(500).json({
            status: "error",
            message: "Failed to update cash handover",
            error: error.message,
        });
    }
});
