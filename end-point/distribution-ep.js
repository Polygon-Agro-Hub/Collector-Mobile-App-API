const distributionDao = require('../dao/distribution-dao');
const asyncHandler = require('express-async-handler');
const { replaceOrderPackageSchema } = require('../Validations/distribution-validation');


exports.getOfficerTarget = async (req, res) => {
    console.log("getOfficerTarget called");
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

        // Get targets from DAO
        const targets = await distributionDao.getTargetForOfficerDao(officerId);

        // console.log("nwxsjklowcd", targets)

        res.status(200).json({
            success: true,
            message: 'Officer targets retrieved successfully',
            data: targets
        });
    } catch (error) {
        console.error('Error getting officer targets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve officer targets',
            error: error.message
        });
    }
};


// exports.getOrderData = async (req, res) => {
//     console.log("getOrderData called");
//     try {
//         const { orderId } = req.params;
//         const officerId = req.user.id; // For authorization check if needed

//         console.log("Order ID:", orderId);

//         // Validate orderId
//         if (!orderId || isNaN(orderId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid order ID provided'
//             });
//         }

//         // Get order data from DAO
//         const orderData = await distributionDao.getOrderDataDao(orderId);

//         console.log("///////////////////", orderData)

//         console.log("nlcdksja", orderData.items)

//         res.status(200).json({
//             success: true,
//             message: 'Order data retrieved successfully',
//             data: orderData
//         });
//     } catch (error) {
//         console.error('Error getting order data:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to retrieve order data',
//             error: error.message
//         });
//     }
// };
exports.getOrderData = async (req, res) => {
    console.log("getOrderData called");
    try {
        const { orderId } = req.params;
        const officerId = req.user.id; // For authorization check if needed

        console.log("Order ID:", orderId);

        // Validate orderId
        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID provided'
            });
        }

        // Get order data from DAO
        const orderData = await distributionDao.getOrderDataDao(orderId);

        console.log("Order Data:", JSON.stringify(orderData, null, 2));

        // Extract and display different item arrays
        const additionalItems = orderData.additionalItems || [];
        const packageItems = orderData.packageData?.items || [];

        console.log("Additional Items:", additionalItems);
        console.log("Package Items:", packageItems);

        // Combine all items if needed
        const allItems = [...additionalItems, ...packageItems];
        console.log("All Items Combined:", allItems);

        // You can also structure the response to include separate item arrays
        const responseData = {
            ...orderData,
            itemsSummary: {
                additionalItems: additionalItems,
                packageItems: packageItems,
                allItems: allItems,
                totalItemCount: allItems.length
            }
        };

        res.status(200).json({
            success: true,
            message: 'Order data retrieved successfully',
            data: responseData
        });
    } catch (error) {
        console.error('Error getting order data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve order data',
            error: error.message
        });
    }
};

// In your distribution endpoint file (distribution-ep.js)
// In your distribution endpoint file (distribution-ep.js)
// exports.updateOrderItems = async (req, res) => {
//     try {
//         const { orderId } = req.params;
//         const { packageItems = [], additionalItems = [] } = req.body;
//         const officerId = req.user.id;

//         // Validate input
//         if (!orderId || isNaN(orderId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid order ID'
//             });
//         }

//         // Update package items if any
//         if (packageItems.length > 0) {
//             await distributionDao.updatePackageItems(packageItems);
//             console.log(`Updated ${packageItems.length} package items for order ${orderId}`);
//         }

//         // Update additional items if any
//         if (additionalItems.length > 0) {
//             await distributionDao.updateAdditionalItems(additionalItems);
//             console.log(`Updated ${additionalItems.length} additional items for order ${orderId}`);
//         }

//         // Check if any updates were made
//         if (packageItems.length === 0 && additionalItems.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'No items provided for update'
//             });
//         }

//         res.status(200).json({
//             success: true,
//             message: 'Order items updated successfully',
//             updated: {
//                 packageItems: packageItems.length,
//                 additionalItems: additionalItems.length
//             }
//         });

//     } catch (error) {
//         console.error('Error updating order items:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to update order items',
//             error: error.message
//         });
//     }
// };

exports.updateOrderItems = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { packageItems = [], additionalItems = [], isComplete } = req.body;
        const officerId = req.user.id;

        console.log("iscomplete======================", isComplete);
        console.log("packageItems received:", JSON.stringify(packageItems, null, 2));
        console.log("additionalItems received:", JSON.stringify(additionalItems, null, 2));

        // Validate input
        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        // **FIX: Flatten package items structure**
        let flattenedPackageItems = [];
        if (packageItems.length > 0) {
            // Check if packageItems is nested (has packageId and items) or flat
            if (packageItems[0] && packageItems[0].packageId && packageItems[0].items) {
                // Nested structure - flatten it
                flattenedPackageItems = packageItems.reduce((acc, packageGroup) => {
                    return acc.concat(packageGroup.items);
                }, []);
            } else {
                // Already flat structure
                flattenedPackageItems = packageItems;
            }

            console.log("Flattened package items:", JSON.stringify(flattenedPackageItems, null, 2));

            await distributionDao.updatePackageItems(flattenedPackageItems);
            console.log(`Updated ${flattenedPackageItems.length} package items for order ${orderId}`);
        }

        // Update additional items if any
        if (additionalItems.length > 0) {
            await distributionDao.updateAdditionalItems(additionalItems);
            console.log(`Updated ${additionalItems.length} additional items for order ${orderId}`);
        }

        // Check if any updates were made
        if (flattenedPackageItems.length === 0 && additionalItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No items provided for update'
            });
        }

        // Handle isComplete = 1 case
        if (isComplete === 1) {
            try {
                await distributionDao.updateDistributedTargetComplete(orderId, officerId);
                console.log(`Updated distributedtargetitems for completed order ${orderId}`);
            } catch (error) {
                console.error('Error updating distributed target items:', error);
                // Don't fail the entire request, but log the error
            }
        }

        res.status(200).json({
            success: true,
            message: 'Order items updated successfully',
            updated: {
                packageItems: flattenedPackageItems.length,
                additionalItems: additionalItems.length,
                isComplete: isComplete
            }
        });

    } catch (error) {
        console.error('Error updating order items:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order items',
            error: error.message
        });
    }
};

exports.getAllRetailItems = asyncHandler(async (req, res) => {
    console.log("Fetching Retail Items...");
    try {
        const { orderId } = req.params;
        if (!orderId) {
            return res.status(400).json({ message: "Order ID is required" });
        }

        const items = await distributionDao.getAllRetailItems(orderId);

        if (!items || items.length === 0) {
            return res.status(404).json({ message: "No Retail Items found" });
        }

        // Additional filter to ensure only Retail items (double-check)
        const retailItems = items.filter(item => item.category === 'Retail');

        res.status(200).json(retailItems);
        console.log("Retail Items fetched successfully:", retailItems.length, "items");
        console.log("Filtered retail items:", retailItems);
    } catch (error) {
        console.error("Error fetching Retail Items:", error);
        res.status(500).json({ message: "Failed to fetch Retail Items" });
    }
});
/////////////////replace modal data update 

// exports.replaceOrderPackage = async (req, res) => {
//     console.log("replaceOrderPackage called");
//     try {
//         const { orderPackageId, productType, productId, qty, price, status } = req.body;
//         const officerId = req.user.id; // From auth middleware

//         console.log("Replace request data:", { orderPackageId, productType, productId, qty, price, status });

//         // Validate required fields
//         if (!orderPackageId || !productType || !productId || !qty || !price) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Missing required fields: orderPackageId, productType, productId, qty, price'
//             });
//         }

//         // Validate numeric fields
//         if (isNaN(orderPackageId) || isNaN(productId) || isNaN(qty) || isNaN(price)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid numeric values provided'
//             });
//         }

//         // Call DAO to handle the replacement request
//         const result = await distributionDao.createReplaceRequestDao({
//             orderPackageId: parseInt(orderPackageId),
//             productType,
//             productId: parseInt(productId),
//             qty: parseInt(qty),
//             price: parseFloat(price),
//             status: status || 'Pending',
//             requestedBy: officerId
//         });

//         res.status(200).json({
//             success: true,
//             message: 'Replacement request created successfully',
//             data: result
//         });

//     } catch (error) {
//         console.error('Error creating replacement request:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to create replacement request',
//             error: error.message
//         });
//     }
// };

// exports.replaceOrderPackage = async (req, res) => {
//     console.log("replaceOrderPackage called");
//     try {
//         const { orderPackageId, productType, replaceId, productId, qty, price, status } = req.body;
//         const officerId = req.user.id; // From auth middleware
//         console.log("Replace request data:", { orderPackageId, replaceId, productType, productId, qty, price, status });

//         // Validate required fields (productId can be null for some product types)
//         if (!orderPackageId || !productType || qty === undefined || price === undefined) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Missing required fields: orderPackageId, productType, qty, price'
//             });
//         }

//         // Validate numeric fields (allow null for productId)
//         if (isNaN(orderPackageId) ||
//             (productId !== null && isNaN(productId)) ||
//             isNaN(qty) ||
//             isNaN(price)) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid numeric values provided'
//             });
//         }

//         // Call DAO to handle the replacement request
//         const result = await distributionDao.createReplaceRequestDao({
//             orderPackageId: parseInt(orderPackageId),
//             productType,
//             replaceId,
//             productId: productId !== null ? parseInt(productId) : null,
//             qty: parseInt(qty),
//             price: parseFloat(price * 1000),
//             status: status || 'Pending',
//             requestedBy: officerId
//         });

//         console.log("Database insertion result:", result); // Add this for debugging

//         res.status(200).json({
//             success: true,
//             message: 'Replacement request created successfully',
//             data: result
//         });

//     } catch (error) {
//         console.error('Error creating replacement request:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to create replacement request',
//             error: error.message
//         });
//     }
// };

// exports.replaceOrderPackage = async (req, res) => {
//     console.log("kanjf,lvmgnla", req.data)
//     console.log("replaceOrderPackage called");
//     try {
//         // Validate request body using the schema directly
//         const { error, value } = replaceOrderPackageSchema.validate(req.body, { abortEarly: false });

//         if (error) {
//             const errorMessages = error.details.map(detail => detail.message);
//             return res.status(400).json({
//                 success: false,
//                 message: 'Validation failed',
//                 errors: errorMessages
//             });
//         }

//         const { orderPackageId, productType, replaceId, productId, qty, price, status } = value;
//         const officerId = req.user.id; // From auth middleware

//         console.log("Validated replace request data:", {
//             orderPackageId,
//             replaceId,
//             productType,
//             productId,
//             qty,
//             price,
//             status
//         });

//         // Call DAO to handle the replacement request
//         const result = await distributionDao.createReplaceRequestDao({
//             orderPackageId,
//             productType,
//             replaceId,
//             productId: productId !== null ? productId : null,
//             qty,
//             price: parseFloat(price), // Your existing conversion
//             status: status || 'Pending',
//             requestedBy: officerId
//         });

//         console.log("Database insertion result:", result);

//         res.status(200).json({
//             success: true,
//             message: 'Replacement request created successfully',
//             data: result
//         });
//     } catch (error) {
//         console.error('Error creating replacement request:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to create replacement request',
//             error: error.message
//         });
//     }
// };



exports.replaceOrderPackage = async (req, res) => {
    console.log("Replace order package request data:", req.body);
    console.log("User info:", req.user);

    try {
        // Get user information
        const userId = req.user.id;
        const empId = req.user.empId;
        const userRole = req.user.role;

        console.log("Debug user permissions:", {
            userId,
            empId,
            userRole,
            empIdExists: !!empId,
            empIdType: typeof empId
        });

        // Enhanced role validation
        let isDIO = false;
        let isDCM = false;

        // Check empId format
        if (empId && typeof empId === 'string') {
            isDIO = empId.toUpperCase().startsWith('DIO');
            isDCM = empId.toUpperCase().startsWith('DCM');
        }

        // Alternative: Check by userRole if empId format doesn't match
        if (!isDIO && !isDCM && userRole) {
            const roleUpper = userRole.toUpperCase();
            isDIO = roleUpper.includes('DIO') || roleUpper === 'DISTRICT_OFFICER';
            isDCM = roleUpper.includes('DCM') || roleUpper === 'DIVISIONAL_MANAGER';
        }

        // More flexible validation - you can customize this based on your needs
        const hasPermission = isDIO || isDCM;

        if (!hasPermission) {
            console.error("Access denied for user:", {
                userId,
                empId,
                userRole,
                isDIO,
                isDCM
            });

            return res.status(403).json({
                success: false,
                message: `Unauthorized: User role '${userRole}' with empId '${empId}' does not have permission to create replacement requests`,
                debug: process.env.NODE_ENV === 'development' ? {
                    empId,
                    userRole,
                    isDIO,
                    isDCM
                } : undefined
            });
        }

        // ... rest of your existing code remains the same

        // Validate request body using the schema
        const { error, value } = replaceOrderPackageSchema.validate(req.body, { abortEarly: false });

        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errorMessages
            });
        }

        const { orderPackageId, productType, replaceId, productId, qty, price, status } = value;

        console.log("Validated replace request data:", {
            orderPackageId,
            replaceId,
            productType,
            productId,
            qty,
            price,
            status,
            requestedBy: userId,
            userRole: userRole,
            permissions: isDIO ? 'DIO - Full access' : 'DCM - Limited access'
        });

        // Call DAO to handle the replacement request with role information
        const result = await distributionDao.createReplaceRequestDao({
            orderPackageId,
            productType,
            replaceId,
            productId: productId !== null ? productId : null,
            qty,
            price: parseFloat(price),
            status: 'Not Approved',
            requestedBy: userId,
            userId: userId,
            empId: empId,
            isDIO: isDIO,
            isDCM: isDCM
        });

        console.log("Database insertion result:", result);

        res.status(200).json({
            success: true,
            message: 'Replacement request created successfully',
            data: result,
            requestedBy: {
                userId: userId,
                empId: empId,
                role: userRole,
                permissions: isDIO ? 'DIO - Full access' : 'DCM - Limited access'
            }
        });
    } catch (error) {
        console.error('Error creating replacement request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create replacement request',
            error: error.message
        });
    }
};




exports.updateDistributedTarget = async (req, res) => {
    try {
        const { orderId } = req.params; // Changed from orderId to orderId
        const { targetItemIds = [] } = req.body;
        const officerId = req.user.id;

        // Validate input
        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid process order ID'
            });
        }

        // Call DAO to update distributed target items
        const updateResults = await distributionDao.updateDistributedTargetItems(targetItemIds, orderId);

        res.status(200).json({
            success: true,
            message: 'Distributed target items updated successfully',
            updated: {
                targetItems: updateResults.updatedItems,
                targets: updateResults.updatedTargets
            }
        });

    } catch (error) {
        console.error('Error updating distributed target items:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update distributed target items',
            error: error.message
        });
    }
};

////////////
// distributionEp.js
// exports.getDistributionTarget = async (req, res) => {
//     try {
//         const officerId = req.user.id;

//         // Get distribution targets with completion percentage
//         const targets = await distributionDao.getDistributionTargets(officerId);

//         console.log("distribution target", targets)

//         // Format the response
//         const formattedTargets = targets.map(target => ({
//             id: target.id,
//             companyCenterId: target.companycenterId,
//             userId: target.userId,
//             target: target.target,
//             completed: target.complete,
//             completionPercentage: parseFloat(target.completionPercentage).toFixed(2) + '%',
//             createdAt: target.createdAt,
//             updatedAt: target.updatedAt
//         }));

//         res.status(200).json({
//             success: true,
//             data: formattedTargets
//         });

//     } catch (error) {
//         console.error('Error getting distribution targets:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to get distribution targets',
//             error: error.message
//         });
//     }
// };

exports.getDistributionTarget = async (req, res) => {
    try {
        const officerId = req.user.id;
        console.log("Officer ID from token:", officerId);

        const targets = await distributionDao.getDistributionTargets(officerId);
        console.log("Distribution targets found:", targets.length);

        if (targets.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No targets found for this user'
            });
        }

        const formattedTargets = targets.map(target => ({
            id: target.id,
            companyCenterId: target.companycenterId,
            userId: target.userId,
            target: target.target,
            completed: target.complete,
            completionPercentage: parseFloat(target.completionPercentage).toFixed(2) + '%',
            createdAt: target.createdAt
        }));

        res.status(200).json({
            success: true,
            data: formattedTargets
        });
    } catch (error) {
        console.error('Error getting distribution targets:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get distribution targets',
            error: error.message
        });
    }
};


// Updated controller to handle orderIds array from frontend
exports.updateoutForDelivery = async (req, res) => {
    try {
        const { orderIds } = req.body; // Get orderIds from request body
        const userId = req.user.id;

        console.log("orderIds======================", orderIds);
        console.log("userId======================", userId);

        // Validate input
        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or empty order IDs array'
            });
        }

        // Validate each orderId
        for (const orderId of orderIds) {
            if (!orderId || isNaN(orderId)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid order ID: ${orderId}`
                });
            }
        }

        // Update each order
        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const orderId of orderIds) {
            try {
                const updateResult = await distributionDao.updateoutForDelivery(orderId, userId);
                results.push({
                    orderId: orderId,
                    success: true,
                    affectedRows: updateResult.affectedRows
                });
                successCount++;
                console.log(`Successfully updated order ${orderId} to Out For Delivery by user ${userId}`);
            } catch (error) {
                console.error(`Failed to update order ${orderId}:`, error);
                results.push({
                    orderId: orderId,
                    success: false,
                    error: error.message
                });
                errorCount++;
            }
        }

        // Send response
        res.status(200).json({
            success: true,
            message: `Successfully updated ${successCount} orders to Out For Delivery${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
            results: results,
            summary: {
                total: orderIds.length,
                successful: successCount,
                failed: errorCount
            }
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order status',
            error: error.message
        });
    }
};