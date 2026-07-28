const distributionDao = require("../dao/distribution-dao");
const asyncHandler = require("express-async-handler");
const {
    replaceOrderPackageSchema,
} = require("../validation/distribution-validation");
const emailService = require("../services/emailService");

exports.getOfficerTarget = async (req, res) => {
    try {
        const officerId = req.user.id;

        if (!officerId || isNaN(officerId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid officer ID provided",
            });
        }

        const targets = await distributionDao.getTargetForOfficerDao(officerId);

        res.status(200).json({
            success: true,
            message: "Officer targets retrieved successfully",
            data: targets,
        });
    } catch (error) {
        console.error("Error getting officer targets:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve officer targets",
            error: error.message,
        });
    }
};

exports.updateDistributedTarget = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { targetItemIds = [] } = req.body;
        const officerId = req.user.id;

        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid process order ID",
            });
        }

        const updateResults = await distributionDao.updateDistributedTargetItems(
            targetItemIds,
            orderId,
        );

        res.status(200).json({
            success: true,
            message: "Distributed target items updated successfully",
            updated: {
                targetItems: updateResults.updatedItems,
                targets: updateResults.updatedTargets,
            },
        });
    } catch (error) {
        console.error("Error updating distributed target items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update distributed target items",
            error: error.message,
        });
    }
};

exports.getDistributionTarget = async (req, res) => {
    try {
        const officerId = req.user.id;

        const targets = await distributionDao.getDistributionTargets(officerId);

        if (targets.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: "No targets found for this user",
            });
        }

        const formattedTargets = targets.map((target) => ({
            id: target.id,
            companyCenterId: target.companycenterId,
            userId: target.userId,
            target: target.target,
            completed: target.complete,
            completionPercentage:
                parseFloat(target.completionPercentage).toFixed(2) + "%",
            createdAt: target.createdAt,
        }));

        res.status(200).json({
            success: true,
            data: formattedTargets,
        });
    } catch (error) {
        console.error("Error getting distribution targets:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get distribution targets",
            error: error.message,
        });
    }
};

exports.updateoutForDelivery = async (req, res) => {
    try {
        const { orderIds } = req.body;
        const userId = req.user.id;

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or empty order IDs array",
            });
        }

        for (const orderId of orderIds) {
            if (!orderId || isNaN(orderId)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid order ID: ${orderId}`,
                });
            }
        }

        const results = [];
        let successCount = 0;
        let errorCount = 0;
        let emailSuccessCount = 0;
        let emailErrorCount = 0;

        for (const orderId of orderIds) {
            try {
                const updateResult = await distributionDao.updateoutForDelivery(
                    orderId,
                    userId,
                );

                results.push({
                    orderId: orderId,
                    success: true,
                    affectedRows: updateResult.orderUpdate.affectedRows,
                });
                successCount++;
            } catch (error) {
                console.error(`❌ Failed to update order ${orderId}:`, error);
                results.push({
                    orderId: orderId,
                    success: false,
                    error: error.message,
                });
                errorCount++;
            }
        }

        res.status(200).json({
            success: true,
            message: `Updated ${successCount} orders${errorCount > 0 ? `, ${errorCount} failed` : ""}. Invoices sent: ${emailSuccessCount}${emailErrorCount > 0 ? `, ${emailErrorCount} email failures` : ""}`,
            results: results,
            summary: {
                total: orderIds.length,
                successful: successCount,
                failed: errorCount,
                emailsSent: emailSuccessCount,
                emailsFailed: emailErrorCount,
            },
        });
    } catch (error) {
        console.error("❌ Error updating order status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update order status",
            error: error.message,
        });
    }
};
