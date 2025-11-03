const targetDDao = require('../dao/distributionManager-dao');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const distributionofficerDao = require('../dao/distributionManager-dao')
const asyncHandler = require('express-async-handler');



exports.getDCenterTarget = async (req, res) => {
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
    const targets = await targetDDao.getDCenterTarget(officerId);

    //  console.log("nwxsjklowcd", targets)

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



exports.getProfile = async (req, res) => {
  try {
    const officerId = req.user.id; // Assuming req.user.id is set after authentication
    console.log("Fetching details for Officer ID:", officerId);

    if (!officerId) {
      return res.status(400).json({ status: "error", message: "Officer ID is required" });
    }

    const officerDetails = await distributionofficerDao.getOfficerDetailsById(officerId);

    res.status(200).json({
      status: "success",
      data: officerDetails,
    });

  } catch (error) {
    console.error("Error fetching officer details:", error.message);

    if (error.message === "Officer not found") {
      return res.status(404).json({ status: "error", message: "Officer not found" });
    }

    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching officer details",
    });
  }
};


// In your controller file (e.g., replaceRequestController.js)
exports.getAllReplaceRequests = async (req, res) => {
  console.log("getAllReplaceRequests called");
  try {
    // Get all replace requests from DAO

    const managerId = req.user.id

    console.log("endpointt manager idd", managerId)

    const replaceRequests = await targetDDao.getAllReplaceRequests(managerId);

    console.log("Replace requests data:", replaceRequests);

    res.status(200).json({
      success: true,
      message: 'All replace requests retrieved successfully',
      data: replaceRequests
    });
  } catch (error) {
    console.error('Error getting replace requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve replace requests',
      error: error.message
    });
  }
};


exports.getRetailItemWithOutEclist = async (req, res) => {
  console.log("getRetailItemWithOutEclist called");
  try {
    const { ordreId } = req.params;
    console.log("Order ID:", ordreId);

    if (!ordreId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Get retail items excluding user's excluded items
    const retailItems = await targetDDao.getRetailItemsExcludingUserExclusions(ordreId);
    console.log("Retail items data:", retailItems);

    res.status(200).json({
      success: true,
      message: 'Retail items retrieved successfully',
      data: retailItems
    });
  } catch (error) {
    console.error('Error getting retail items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve retail items',
      error: error.message
    });
  }
};



// Controller Function
exports.getOrdreReplace = async (req, res) => {
  console.log("getOrdreReplace called");
  try {
    const { id } = req.params;
    console.log("Order Package ID:", id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Order Package ID is required'
      });
    }

    // Get replace request data for the order package
    const replaceRequests = await targetDDao.getOrdreReplace(id);
    console.log("Replace request data:", replaceRequests);

    res.status(200).json({
      success: true,
      message: 'Replace request data retrieved successfully',
      data: replaceRequests,
      count: replaceRequests.length
    });
  } catch (error) {
    console.error('Error getting replace request data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve replace request data',
      error: error.message
    });
  }
};

exports.getReplaceReuset = async (req, res) => {
  console.log("getOrdreReplace called");
  try {
    const { id } = req.params;
    console.log("Order Package ID:", id);


    // Get replace request data for the order package
    const replaceRequests = await targetDDao.getReplaceReuset();
    console.log("Replace request data:", replaceRequests);

    res.status(200).json({
      success: true,
      message: 'Replace request data retrieved successfully',
      data: replaceRequests,
      count: replaceRequests.length
    });
  } catch (error) {
    console.error('Error getting replace request data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve replace request data',
      error: error.message
    });
  }
};


exports.approveReplaceRequest = async (req, res) => {
  console.log("approveReplaceRequest called");

  try {
    const {
      replaceRequestId,
      newProductId,
      quantity,
      price,
      orderId,
      newProduct
    } = req.body;

    console.log("Request body:", req.body);

    // Validate required fields
    if (!replaceRequestId || !newProductId || !quantity || !price) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: replaceRequestId, newProductId, quantity, price'
      });
    }


    // Update the replace request with new product details
    const updateResult = await targetDDao.approveReplaceRequest({
      replaceRequestId,
      newProductId,
      quantity: parseFloat(quantity),
      price: parseFloat(price)
    });

    console.log("Update result:", updateResult);

    if (updateResult.success) {
      res.status(200).json({
        success: true,
        message: 'Replace request approved successfully',
        data: updateResult.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: updateResult.message || 'Failed to approve replace request'
      });
    }

  } catch (error) {
    console.error('Error approving replace request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve replace request',
      error: error.message
    });
  }
};

exports.getDistributionOfficerTarget = async (req, res) => {
  console.log("getOfficerTarget called");
  try {
    // Get officerId from the route parameter (named 'id' in the route)
    const { id: officerId } = req.params; // Extract 'id' and rename it to 'officerId'
    // OR simply use: const officerId = req.params.id;

    console.log("Officer ID from params:", officerId);

    // Validate officerId
    if (!officerId || isNaN(officerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid officer ID provided'
      });
    }

    // Get targets from DAO
    const targets = await targetDDao.getDistributionOfficerTarget(officerId);

    console.log("nwxsjklowcd", targets)

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


exports.getAllDistributionOfficer = async (req, res) => {
  console.log("getAllDistributionOfficer called");
  try {
    // Get manager ID from query parameter if provided, otherwise use authenticated user's ID
    const managerId = req.query.managerId || req.user.id;
    console.log("Manager ID:", managerId);

    // Get both distribution officers and manager details as single array
    const allData = await targetDDao.getAllDistributionOfficer(managerId);
    console.log("All data:", allData);

    res.status(200).json({
      success: true,
      message: 'Distribution officers and manager details retrieved successfully',
      data: allData
    });
  } catch (error) {
    console.error('Error getting distribution officers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve distribution officers and manager details',
      error: error.message
    });
  }
};




exports.targetPass = async (req, res) => {
  console.log("targetPass called");

  try {
    const { assigneeOfficerId, targetItems, invoiceNumbers, processOrderId } = req.body;
    const { officerId } = req.params; // Get officerId from URL parameters

    console.log("Request body:", req.body);
    console.log("Route params:", req.params);

    // Validate required fields
    if (!assigneeOfficerId || !invoiceNumbers || !targetItems || !officerId || !processOrderId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: assigneeOfficerId, invoiceNumbers, targetItems, officerId, processOrderId'
      });
    }

    // Validate that invoiceNumbers is an array
    if (!Array.isArray(invoiceNumbers) || invoiceNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'invoiceNumbers must be a non-empty array'
      });
    }

    // Validate that targetItems is an array
    if (!Array.isArray(targetItems) || targetItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'targetItems must be a non-empty array'
      });
    }

    // Validate that processOrderId is an array
    if (!Array.isArray(processOrderId) || processOrderId.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'processOrderId must be a non-empty array'
      });
    }

    // Call the DAO function - NOW INCLUDING processOrderId
    const result = await targetDDao.targetPass({
      assigneeOfficerId,
      targetItems,
      invoiceNumbers,
      processOrderId, // <-- This was missing!
      officerId
    });

    console.log("DAO result:", result);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message || 'Target passed successfully',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Failed to pass target',
        errors: result.errors || []
      });
    }

  } catch (error) {
    console.error('Error in targetPass endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pass target',
      error: error.message
    });
  }
};



exports.getOfficerDetailsForReport = async (req, res) => {
  const { empId } = req.params;

  console.log("nkdjzvi")

  if (!empId) {
    return res.status(400).json({
      status: 'error',
      message: 'Employee ID is required.',
    });
  }

  try {
    const [rows] = await targetDDao.getOfficerDetails(empId);

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No employee found with the provided empId.',
      });
    }

    res.status(200).json({
      status: 'success',
      data: rows[0],
    });
  } catch (error) {
    console.error('Error fetching employee details:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching employee details.',
    });
  }
};




exports.getDistributionPaymentsSummary = async (req, res) => {
  const schema = Joi.object({
    collectionOfficerId: Joi.number().integer().required(),
    fromDate: Joi.date().iso().required(),
    toDate: Joi.date().iso().required().min(Joi.ref('fromDate')).messages({
      'date.min': '"toDate" must be the same as or after "fromDate".',
    }),
  });

  try {
    const { collectionOfficerId, fromDate, toDate } = req.query;
    const { error } = schema.validate({ collectionOfficerId, fromDate, toDate });

    if (error) {
      return res.status(400).json({
        status: 'error',
        message: error.details[0].message,
      });
    }

    const [rows] = await targetDDao.getDistributionPaymentsSummary({
      collectionOfficerId,
      fromDate,
      toDate,
    });

    console.log("//////////////", rows)

    const reportData = rows.map(row => {
      // Format sheduleTime to remove "Within" text
      const formattedSheduleTime = row.sheduleTime ?
        row.sheduleTime.replace('Within ', '') :
        row.sheduleTime;

      return {
        date: new Date(row.date).toLocaleDateString('en-US', { timeZone: 'Asia/Colombo' }),
        completedOrders: row.completedOrders,
        totalAmount: row.totalAmount ? parseFloat(row.totalAmount) : 0,
        orderDetails: row.orderDetails || [],
        invNo: row.invNo,
        orderId: row.orderId,
        sheduleDate: new Date(row.sheduleDate).toLocaleDateString('en-US', { timeZone: 'Asia/Colombo' }),
        sheduleTime: formattedSheduleTime
      };
    });

    console.log('Distribution Officer Payment Summary:', reportData);

    res.status(200).json({
      status: 'success',
      data: reportData,
    });
  } catch (error) {
    console.error('Error fetching distribution officer payment summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching the report.',
    });
  }
};



exports.getOfficerTaskSummaryManagerView = async (req, res) => {
  try {
    const { collectionOfficerId } = req.params;

    console.log('Fetching task summary for Officer ID:', collectionOfficerId);

    // Validate officer ID
    if (!collectionOfficerId || isNaN(collectionOfficerId)) {
      return res.status(400).json({
        success: false,
        error: "Valid Officer ID is required"
      });
    }

    // Fetch summary data from DAO
    const taskSummary = await targetDDao.getOfficerSummaryDaoManager(collectionOfficerId);

    // Check if any tasks exist
    if (!taskSummary || taskSummary.totalTasks === 0) {
      return res.status(200).json({
        success: true,
        collectionOfficerId: parseInt(collectionOfficerId),
        totalTasks: 0,
        completedTasks: 0,
        completionPercentage: 0,
        message: "No tasks found for this officer."
      });
    }

    const { totalTasks, completedTasks, totalComplete, totalTarget } = taskSummary;

    // Calculate completion percentage
    const completionPercentage = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    // Calculate overall progress percentage
    const overallProgressPercentage = totalTarget > 0
      ? Math.round((totalComplete / totalTarget) * 100)
      : 0;

    res.status(200).json({
      success: true,
      collectionOfficerId: parseInt(collectionOfficerId),
      totalTasks,
      completedTasks,
      completionPercentage,
      overallProgressPercentage,
      totalComplete,
      totalTarget,
      summary: {
        tasksCompleted: `${completedTasks}/${totalTasks}`,
        overallProgress: `${totalComplete}/${totalTarget}`,
        completionRate: `${completionPercentage}%`,
        progressRate: `${overallProgressPercentage}%`
      }
    });

  } catch (error) {
    console.error("Error fetching task summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch task summary",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


exports.getOrderById = async (req, res) => {

  console.log(",,,,,")
  try {
    const orderId = req.params.orderId;

    // Validate orderId
    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    const order = await targetDDao.getOrderById(orderId);

    console.log("data order hhhhhhhhhhhh", order)

    if (order.message) {
      return res.status(404).json({
        success: false,
        message: order.message
      });
    }


    res.status(200).json({
      success: true,
      data: order

    });
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
};

exports.getCustomerDetailsCustomerId = async (req, res) => {
  try {
    const customerId = req.params.id;

    // Validate customerId
    if (!customerId || isNaN(parseInt(customerId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID'
      });
    }

    // Make sure to import orderDao correctly
    const customerData = await targetDDao.getDataCustomerId(customerId);

    console.log("customerDataaaaaaaaaaaaaaaa", customerData)

    if (customerData.message) {
      return res.status(404).json({
        success: false,
        message: customerData.message
      });
    }

    res.status(200).json({
      success: true,
      data: customerData
    });
  } catch (error) {
    console.error('Error fetching customer details by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer details',
      error: error.message
    });
  }
};


exports.getAllPCity = asyncHandler(async (req, res) => {
  console.log("hitt")
  try {
    const packages = await targetDDao.getAllCity();

    if (!packages || packages.length === 0) {
      return res.status(404).json({ message: "No City found" });
    }

    res.status(200).json({ message: "City fetched successfully", data: packages });
  } catch (error) {
    console.error("Error fetching city:", error);
    res.status(500).json({ message: "Failed to fetch city" });
  }
});


exports.getOrderMarketplaceOrdash = async (req, res) => {
  console.log("Getting order details...");
  try {
    const orderId = req.params.orderId;

    // Validate orderId
    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    const orderData = await targetDDao.getOrderMarketplaceOrdash(orderId);

    if (orderData.error) {
      return res.status(404).json({
        success: false,
        message: orderData.message
      });
    }

    res.status(200).json({
      success: true,
      data: orderData
    });

  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
};

