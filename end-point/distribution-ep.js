const distributionDao = require("../dao/distribution-dao");
const asyncHandler = require("express-async-handler");
const {
    replaceOrderPackageSchema,
} = require("../Validations/distribution-validation");
const emailService = require("../services/emailService");
const pdfService = require("../services/pdfService");

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

exports.getOrderData = async (req, res) => {
    try {
        const { orderId } = req.params;
        const officerId = req.user.id;

        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID provided",
            });
        }

        const orderData = await distributionDao.getOrderDataDao(orderId);

        const additionalItems = orderData.additionalItems || [];
        const packageItems = orderData.packageData?.items || [];

        const allItems = [...additionalItems, ...packageItems];

        const responseData = {
            ...orderData,
            itemsSummary: {
                additionalItems: additionalItems,
                packageItems: packageItems,
                allItems: allItems,
                totalItemCount: allItems.length,
            },
        };

        res.status(200).json({
            success: true,
            message: "Order data retrieved successfully",
            data: responseData,
        });
    } catch (error) {
        console.error("Error getting order data:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve order data",
            error: error.message,
        });
    }
};

exports.updateOrderItems = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { packageItems = [], additionalItems = [], isComplete } = req.body;
        const officerId = req.user.id;

        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID",
            });
        }

        let flattenedPackageItems = [];
        if (packageItems.length > 0) {
            if (
                packageItems[0] &&
                packageItems[0].packageId &&
                packageItems[0].items
            ) {
                flattenedPackageItems = packageItems.reduce((acc, packageGroup) => {
                    return acc.concat(packageGroup.items);
                }, []);
            } else {
                flattenedPackageItems = packageItems;
            }

            await distributionDao.updatePackageItems(flattenedPackageItems);
        }

        if (additionalItems.length > 0) {
            await distributionDao.updateAdditionalItems(additionalItems);
        }

        if (flattenedPackageItems.length === 0 && additionalItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No items provided for update",
            });
        }

        if (isComplete === 1) {
            try {
                await distributionDao.updateDistributedTargetComplete(
                    orderId,
                    officerId,
                );
            } catch (error) {
                console.error("Error updating distributed target items:", error);
            }
        }

        res.status(200).json({
            success: true,
            message: "Order items updated successfully",
            updated: {
                packageItems: flattenedPackageItems.length,
                additionalItems: additionalItems.length,
                isComplete: isComplete,
            },
        });
    } catch (error) {
        console.error("Error updating order items:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update order items",
            error: error.message,
        });
    }
};

exports.getAllRetailItems = asyncHandler(async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!orderId) {
            return res.status(400).json({ message: "Order ID is required" });
        }

        const items = await distributionDao.getAllRetailItems(orderId);

        if (!items || items.length === 0) {
            return res.status(404).json({ message: "No Retail Items found" });
        }

        const retailItems = items.filter((item) => item.category === "Retail");

        res.status(200).json(retailItems);
    } catch (error) {
        console.error("Error fetching Retail Items:", error);
        res.status(500).json({ message: "Failed to fetch Retail Items" });
    }
});

exports.replaceOrderPackage = async (req, res) => {
    try {
        const userId = req.user.id;
        const empId = req.user.empId;
        const userRole = req.user.role;

        let isDIO = false;
        let isDCM = false;

        if (empId && typeof empId === "string") {
            isDIO = empId.toUpperCase().startsWith("DIO");
            isDCM = empId.toUpperCase().startsWith("DCM");
        }

        if (!isDIO && !isDCM && userRole) {
            const roleUpper = userRole.toUpperCase();
            isDIO = roleUpper.includes("DIO") || roleUpper === "DISTRICT_OFFICER";
            isDCM = roleUpper.includes("DCM") || roleUpper === "DIVISIONAL_MANAGER";
        }

        const hasPermission = isDIO || isDCM;

        if (!hasPermission) {
            console.error("Access denied for user:", {
                userId,
                empId,
                userRole,
                isDIO,
                isDCM,
            });

            return res.status(403).json({
                success: false,
                message: `Unauthorized: User role '${userRole}' with empId '${empId}' does not have permission to create replacement requests`,
                debug:
                    process.env.NODE_ENV === "development"
                        ? {
                            empId,
                            userRole,
                            isDIO,
                            isDCM,
                        }
                        : undefined,
            });
        }

        const { error, value } = replaceOrderPackageSchema.validate(req.body, {
            abortEarly: false,
        });

        if (error) {
            const errorMessages = error.details.map((detail) => detail.message);
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: errorMessages,
            });
        }

        const {
            orderPackageId,
            productType,
            replaceId,
            productId,
            qty,
            price,
            status,
        } = value;

        const result = await distributionDao.createReplaceRequestDao({
            orderPackageId,
            productType,
            replaceId,
            productId: productId !== null ? productId : null,
            qty,
            price: parseFloat(price),
            status: "Not Approved",
            requestedBy: userId,
            userId: userId,
            empId: empId,
            isDIO: isDIO,
            isDCM: isDCM,
        });

        res.status(200).json({
            success: true,
            message: "Replacement request created successfully",
            data: result,
            requestedBy: {
                userId: userId,
                empId: empId,
                role: userRole,
                permissions: isDIO ? "DIO - Full access" : "DCM - Limited access",
            },
        });
    } catch (error) {
        console.error("Error creating replacement request:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create replacement request",
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

                if (updateResult.orderInfo && updateResult.orderInfo.customerEmail) {
                    try {
                        const invoiceData = {
                            invoiceNumber: updateResult.orderInfo.invNo,
                            totalAmount: updateResult.orderInfo.totalAmount,
                            order: {
                                customerInfo: {
                                    title: updateResult.orderInfo.title,
                                    firstName: updateResult.orderInfo.firstName,
                                    lastName: updateResult.orderInfo.lastName,
                                    phoneNumber: updateResult.orderInfo.phoneNumber,
                                    buildingType: updateResult.orderInfo.buildingType,
                                },
                                paymentMethod: updateResult.orderInfo.paymentMethod,
                                createdAt: updateResult.orderInfo.createdAt,
                                scheduleDate: updateResult.orderInfo.scheduleDate,
                            },
                            customerData: {
                                email: updateResult.orderInfo.customerEmail,
                                buildingDetails: {
                                    houseNo: updateResult.orderInfo.houseNo,
                                    floorNo: updateResult.orderInfo.floorNo,
                                    buildingNo: updateResult.orderInfo.buildingNo,
                                    buildingName: updateResult.orderInfo.buildingName,
                                    unitNo: updateResult.orderInfo.unitNo,
                                    streetName: updateResult.orderInfo.streetName,
                                    city: updateResult.orderInfo.city,
                                },
                            },
                        };

                        const pdfBuffer = await pdfService.generateInvoicePDF(invoiceData);

                        await emailService.sendEmail(
                            updateResult.orderInfo.customerEmail,
                            `Order ${updateResult.orderInfo.invNo} - ${updateResult.status}`,
                            "welcom",
                            invoiceData,
                            [
                                {
                                    filename: `Invoice_${updateResult.orderInfo.invNo}.pdf`,
                                    content: pdfBuffer,
                                    contentType: "application/pdf",
                                },
                            ],
                        );

                        emailSuccessCount++;
                    } catch (emailError) {
                        emailErrorCount++;
                        console.error(
                            `❌ Failed to send email for order ${orderId}:`,
                            emailError,
                        );
                    }
                }
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
