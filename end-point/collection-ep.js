const collectionDao = require("../dao/collection-dao");
const asyncHandler = require("express-async-handler");

exports.getAllCollectionRequest = async (req, res) => {
    try {
        const userId = req.user.id;

        const status = req.query.status || "";
        const assignedStatus = req.query.assignedStatus || "";

        const collectionRequests = await collectionDao.getAllCollectionRequest(
            status,
            assignedStatus,
            userId,
        );

        if (!collectionRequests || collectionRequests.length === 0) {
            return res.status(404).json({
                message: "No collection requests found",
                params: { status, assignedStatus },
            });
        }

        res.status(200).json(collectionRequests);
    } catch (error) {
        console.error("Error fetching collection requests:", error);
        res.status(500).json({
            error: "Failed to retrieve collection requests",
            details: error.message,
        });
    }
};

exports.getViewDetailsById = async (req, res) => {
    try {
        const { requestId } = req.params;

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: "Request ID is required",
            });
        }

        const collectionRequest = await collectionDao.getViewDetailsById(requestId);

        if (!collectionRequest) {
            return res.status(404).json({
                success: false,
                message: "Collection request not found",
            });
        }

        res.status(200).json({
            success: true,
            data: collectionRequest,
        });
    } catch (error) {
        console.error("Error fetching collection request details:", error);
        res.status(500).json({
            success: false,
            error: "Failed to retrieve collection request details",
            details: error.message,
        });
    }
};

exports.cancellRequest = async (req, res) => {
    try {
        const { requestId, cancelReason } = req.body;

        if (!requestId || !cancelReason) {
            return res.status(400).json({
                success: false,
                message: "Request ID and cancellation reason are required",
            });
        }

        const userId = req.user.id;

        const result = await collectionDao.cancelRequest(
            requestId,
            cancelReason,
            userId,
        );

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in cancellRequest endpoint:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while cancelling the collection request",
            error: error.message,
        });
    }
};

exports.updateCollectionRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { scheduleDate } = req.body;

        if (!requestId || !scheduleDate) {
            return res.status(400).json({
                success: false,
                message: "Request ID and schedule date are required",
            });
        }

        const result = await collectionDao.updateCollectionRequest(
            requestId,
            scheduleDate,
        );

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error("Error in updateCollectionRequest endpoint:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while updating the collection request",
            error: error.message,
        });
    }
};
