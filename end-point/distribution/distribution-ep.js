const distributionDao = require("../../dao/distribution/distribution-dao");
const asyncHandler = require("express-async-handler");
const {
    replaceOrderPackageSchema,
} = require("../../validation/distribution-validation");
const emailService = require("../../services/emailService");



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


