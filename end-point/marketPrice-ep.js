const marketPriceDAO = require("../dao/marketPrice-dao");
const marketPriceRequestSchema = require("../Validations/marketPrice-validation");

exports.insertMarketPriceRequestBatch = async (req, res) => {
    try {
        const { error, value } = marketPriceRequestSchema.priceItemSchema.validate(
            req.body,
            { abortEarly: false },
        );

        if (error) {
            const validationErrors = error.details.map((detail) => detail.message);
            return res.status(400).json({
                message: "Validation failed",
                errors: validationErrors,
            });
        }

        const { prices } = req.body;

        if (!prices || prices.length === 0) {
            return res
                .status(400)
                .json({ message: "No prices provided for update." });
        }

        const userId = req.user.id;

        const status = "Pending";

        const empId =
            await marketPriceDAO.getEmpIdFromCollectionOfficerCompanyDetails(userId);
        if (!empId) {
            return res
                .status(404)
                .json({
                    message: "Employee not found in collectionofficercompanydetails.",
                });
        }

        const centerId =
            await marketPriceDAO.getCenterIdFromCollectionOfficer(empId);
        if (!centerId) {
            return res
                .status(404)
                .json({ message: "Employee not found in collectionofficer." });
        }

        const priceRequests = [];
        for (const price of prices) {
            const { varietyId, grade, requestPrice } = price;

            const originalPrice = await marketPriceDAO.getMarketPrice(
                varietyId,
                grade,
            );
            if (!originalPrice) {
                return res
                    .status(404)
                    .json({
                        message: `Market price for varietyId ${varietyId} and grade ${grade} not found.`,
                    });
            }

            if (parseFloat(originalPrice) !== parseFloat(requestPrice)) {
                const marketPriceId = await marketPriceDAO.getMarketPriceId(
                    varietyId,
                    grade,
                );
                if (!marketPriceId) {
                    return res
                        .status(404)
                        .json({
                            message: `Market price ID for varietyId ${varietyId} and grade ${grade} not found.`,
                        });
                }

                priceRequests.push([
                    marketPriceId,
                    centerId,
                    requestPrice,
                    status,
                    empId,
                ]);
            }
        }

        if (priceRequests.length > 0) {
            const insertResult =
                await marketPriceDAO.insertPriceRequests(priceRequests);

            return res.status(201).json({
                message: "Market price requests created successfully.",
                requestId: insertResult.insertId,
            });
        } else {
            return res
                .status(400)
                .json({ message: "No valid price data to insert (no price changes)." });
        }
    } catch (error) {
        console.error("Error inserting market price request:", error);
        return res
            .status(500)
            .json({ message: "An error occurred while processing your request." });
    }
};

exports.insertMarketPriceRequestBatchManager = async (req, res) => {
    try {
        const { error, value } = marketPriceRequestSchema.priceItemSchema.validate(
            req.body,
            { abortEarly: false },
        );

        if (error) {
            const validationErrors = error.details.map((detail) => detail.message);
            return res.status(400).json({
                message: "Validation failed",
                errors: validationErrors,
            });
        }

        const { prices } = req.body;

        if (!prices || prices.length === 0) {
            return res
                .status(400)
                .json({ message: "No prices provided for update." });
        }

        const userId = req.user.id;

        const status = "Approved";

        const empId =
            await marketPriceDAO.getEmpIdFromCollectionOfficerCompanyDetails(userId);
        if (!empId) {
            return res
                .status(404)
                .json({ message: "Employee not found in collectionofficer." });
        }

        const centerId =
            await marketPriceDAO.getCenterIdFromCollectionOfficer(empId);
        if (!centerId) {
            return res
                .status(404)
                .json({ message: "Center not found for employee." });
        }

        const companyCenterId =
            await marketPriceDAO.getCompanyCenterIdFromCompanyCenter(centerId);
        if (!companyCenterId) {
            return res
                .status(404)
                .json({ message: "Company center not found for this center." });
        }

        const marketPriceServeUpdates = [];
        const priceRequests = [];

        for (const price of prices) {
            const { varietyId, grade, requestPrice } = price;

            const originalPrice = await marketPriceDAO.getMarketPrice(
                varietyId,
                grade,
            );
            if (!originalPrice) {
                return res.status(404).json({
                    message: `Market price for varietyId ${varietyId} and grade ${grade} not found.`,
                });
            }

            if (parseFloat(originalPrice) !== parseFloat(requestPrice)) {
                const marketPriceId = await marketPriceDAO.getMarketPriceId(
                    varietyId,
                    grade,
                );
                if (!marketPriceId) {
                    return res.status(404).json({
                        message: `Market price ID for varietyId ${varietyId} and grade ${grade} not found.`,
                    });
                }

                const recordExists = await marketPriceDAO.checkMarketPriceServeExists(
                    marketPriceId,
                    companyCenterId,
                );

                if (recordExists) {
                    marketPriceServeUpdates.push({
                        marketPriceId,
                        companyCenterId,
                        updatedPrice: requestPrice,
                    });

                    priceRequests.push([
                        marketPriceId,
                        centerId,
                        requestPrice,
                        status,
                        empId,
                    ]);
                } else {
                    return res.status(404).json({
                        message: `Record not found in marketpriceserve for marketPriceId: ${marketPriceId}, companyCenterId: ${companyCenterId}`,
                    });
                }
            }
        }

        if (marketPriceServeUpdates.length > 0 && priceRequests.length > 0) {
            let serveUpdateCount = 0;

            for (const update of marketPriceServeUpdates) {
                const result = await marketPriceDAO.updateMarketPriceServe(
                    update.marketPriceId,
                    update.companyCenterId,
                    update.updatedPrice,
                );
                serveUpdateCount += result.affectedRows || 0;
            }

            const insertResult =
                await marketPriceDAO.insertPriceRequests(priceRequests);

            return res.status(201).json({
                message: "Market price updates processed and approved successfully.",
                serveUpdated: serveUpdateCount,
                requestsInserted: insertResult.affectedRows,
                requestId: insertResult.insertId,
                totalProcessed: marketPriceServeUpdates.length,
            });
        } else {
            return res.status(400).json({
                message: "No valid price data to update (no price changes).",
            });
        }
    } catch (error) {
        console.error("Error updating market price serve:", error);
        return res.status(500).json({
            message: "An error occurred while processing your request.",
            error: error.message,
        });
    }
};
