const targetDDao = require("../dao/distributionManager-dao");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const distributionofficerDao = require("../dao/distributionManager-dao");
const asyncHandler = require("express-async-handler");

exports.getDCenterTarget = async (req, res) => {
  try {
    const officerId = req.user.id;

    if (!officerId || isNaN(officerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid officer ID provided",
      });
    }

    const targets = await targetDDao.getDCenterTarget(officerId);

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

exports.getProfile = async (req, res) => {
  try {
    const officerId = req.user.id;

    if (!officerId) {
      return res
        .status(400)
        .json({ status: "error", message: "Officer ID is required" });
    }

    const officerDetails =
      await distributionofficerDao.getOfficerDetailsById(officerId);

    res.status(200).json({
      status: "success",
      data: officerDetails,
    });
  } catch (error) {
    console.error("Error fetching officer details:", error.message);

    if (error.message === "Officer not found") {
      return res
        .status(404)
        .json({ status: "error", message: "Officer not found" });
    }

    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching officer details",
    });
  }
};

exports.getAllReplaceRequests = async (req, res) => {
  try {
    const managerId = req.user.id;

    const replaceRequests = await targetDDao.getAllReplaceRequests(managerId);

    res.status(200).json({
      success: true,
      message: "All replace requests retrieved successfully",
      data: replaceRequests,
    });
  } catch (error) {
    console.error("Error getting replace requests:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve replace requests",
      error: error.message,
    });
  }
};

exports.getRetailItemWithOutEclist = async (req, res) => {
  try {
    const { ordreId } = req.params;

    if (!ordreId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const retailItems =
      await targetDDao.getRetailItemsExcludingUserExclusions(ordreId);

    res.status(200).json({
      success: true,
      message: "Retail items retrieved successfully",
      data: retailItems,
    });
  } catch (error) {
    console.error("Error getting retail items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve retail items",
      error: error.message,
    });
  }
};

exports.getOrdreReplace = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Order Package ID is required",
      });
    }

    const replaceRequests = await targetDDao.getOrdreReplace(id);

    res.status(200).json({
      success: true,
      message: "Replace request data retrieved successfully",
      data: replaceRequests,
      count: replaceRequests.length,
    });
  } catch (error) {
    console.error("Error getting replace request data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve replace request data",
      error: error.message,
    });
  }
};

exports.getReplaceReuset = async (req, res) => {
  try {
    const { id } = req.params;

    const replaceRequests = await targetDDao.getReplaceReuset();

    res.status(200).json({
      success: true,
      message: "Replace request data retrieved successfully",
      data: replaceRequests,
      count: replaceRequests.length,
    });
  } catch (error) {
    console.error("Error getting replace request data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve replace request data",
      error: error.message,
    });
  }
};

exports.approveReplaceRequest = async (req, res) => {
  try {
    const {
      replaceRequestId,
      newProductId,
      quantity,
      price,
      orderId,
      newProduct,
    } = req.body;

    if (!replaceRequestId || !newProductId || !quantity || !price) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: replaceRequestId, newProductId, quantity, price",
      });
    }

    const updateResult = await targetDDao.approveReplaceRequest({
      replaceRequestId,
      newProductId,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
    });

    if (updateResult.success) {
      res.status(200).json({
        success: true,
        message: "Replace request approved successfully",
        data: updateResult.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: updateResult.message || "Failed to approve replace request",
      });
    }
  } catch (error) {
    console.error("Error approving replace request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve replace request",
      error: error.message,
    });
  }
};

exports.getDistributionOfficerTarget = async (req, res) => {
  try {
    const { id: officerId } = req.params;

    if (!officerId || isNaN(officerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid officer ID provided",
      });
    }

    const targets = await targetDDao.getDistributionOfficerTarget(officerId);

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

exports.getAllDistributionOfficer = async (req, res) => {
  try {
    const managerId = req.query.managerId || req.user.id;

    const allData = await targetDDao.getAllDistributionOfficer(managerId);

    res.status(200).json({
      success: true,
      message:
        "Distribution officers and manager details retrieved successfully",
      data: allData,
    });
  } catch (error) {
    console.error("Error getting distribution officers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve distribution officers and manager details",
      error: error.message,
    });
  }
};

exports.targetPass = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message:
          "Request body is empty. Make sure Content-Type is application/json",
      });
    }

    const { assigneeOfficerId, targetItems, invoiceNumbers, processOrderId } =
      req.body;
    const { officerId } = req.params;

    if (!officerId) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: officerId (should be in URL path)",
      });
    }

    if (!assigneeOfficerId) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: assigneeOfficerId",
      });
    }

    if (!invoiceNumbers) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: invoiceNumbers",
      });
    }

    if (!targetItems) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: targetItems",
      });
    }

    if (!processOrderId) {
      return res.status(400).json({
        success: false,
        message: "Missing required field: processOrderId",
      });
    }

    if (!Array.isArray(invoiceNumbers) || invoiceNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "invoiceNumbers must be a non-empty array",
      });
    }

    if (!Array.isArray(targetItems) || targetItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "targetItems must be a non-empty array",
      });
    }

    if (!Array.isArray(processOrderId) || processOrderId.length === 0) {
      return res.status(400).json({
        success: false,
        message: "processOrderId must be a non-empty array",
      });
    }

    const result = await targetDDao.targetPass({
      assigneeOfficerId,
      targetItems,
      invoiceNumbers,
      processOrderId,
      officerId,
    });

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message || "Target passed successfully",
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || "Failed to pass target",
        errors: result.errors || [],
      });
    }
  } catch (error) {
    console.error("Error in targetPass endpoint:", error);
    res.status(500).json({
      success: false,
      message: "Failed to pass target",
      error: error.message,
    });
  }
};

exports.getOfficerDetailsForReport = async (req, res) => {
  const { empId } = req.params;

  if (!empId) {
    return res.status(400).json({
      status: "error",
      message: "Employee ID is required.",
    });
  }

  try {
    const [rows] = await targetDDao.getOfficerDetails(empId);

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "No employee found with the provided empId.",
      });
    }

    res.status(200).json({
      status: "success",
      data: rows[0],
    });
  } catch (error) {
    console.error("Error fetching employee details:", error);
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching employee details.",
    });
  }
};

exports.getDistributionPaymentsSummary = async (req, res) => {
  const schema = Joi.object({
    collectionOfficerId: Joi.number().integer().required(),
    fromDate: Joi.date().iso().required(),
    toDate: Joi.date().iso().required().min(Joi.ref("fromDate")).messages({
      "date.min": '"toDate" must be the same as or after "fromDate".',
    }),
  });

  try {
    const { collectionOfficerId, fromDate, toDate } = req.query;
    const { error } = schema.validate({
      collectionOfficerId,
      fromDate,
      toDate,
    });

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.details[0].message,
      });
    }

    const [rows] = await targetDDao.getDistributionPaymentsSummary({
      collectionOfficerId,
      fromDate,
      toDate,
    });

    const reportData = rows.map((row) => {
      const formattedSheduleTime = row.sheduleTime
        ? row.sheduleTime.replace("Within ", "")
        : row.sheduleTime;

      return {
        date: new Date(row.date).toLocaleDateString("en-US", {
          timeZone: "Asia/Colombo",
        }),
        completedOrders: row.completedOrders,
        totalAmount: row.totalAmount ? parseFloat(row.totalAmount) : 0,
        orderDetails: row.orderDetails || [],
        invNo: row.invNo,
        orderId: row.orderId,
        sheduleDate: new Date(row.sheduleDate).toLocaleDateString("en-US", {
          timeZone: "Asia/Colombo",
        }),
        sheduleTime: formattedSheduleTime,
      };
    });

    res.status(200).json({
      status: "success",
      data: reportData,
    });
  } catch (error) {
    console.error(
      "Error fetching distribution officer payment summary:",
      error,
    );
    res.status(500).json({
      status: "error",
      message: "An error occurred while fetching the report.",
    });
  }
};

exports.getOfficerTaskSummaryManagerView = async (req, res) => {
  try {
    const { collectionOfficerId } = req.params;

    if (!collectionOfficerId || isNaN(collectionOfficerId)) {
      return res.status(400).json({
        success: false,
        error: "Valid Officer ID is required",
      });
    }

    const taskSummary =
      await targetDDao.getOfficerSummaryDaoManager(collectionOfficerId);

    if (!taskSummary || taskSummary.totalTasks === 0) {
      return res.status(200).json({
        success: true,
        collectionOfficerId: parseInt(collectionOfficerId),
        totalTasks: 0,
        completedTasks: 0,
        completionPercentage: 0,
        message: "No tasks found for this officer.",
      });
    }

    const { totalTasks, completedTasks, totalComplete, totalTarget } =
      taskSummary;

    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const overallProgressPercentage =
      totalTarget > 0 ? Math.round((totalComplete / totalTarget) * 100) : 0;

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
        progressRate: `${overallProgressPercentage}%`,
      },
    });
  } catch (error) {
    console.error("Error fetching task summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch task summary",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await targetDDao.getOrderById(orderId);

    if (order.message) {
      return res.status(404).json({
        success: false,
        message: order.message,
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error fetching order by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: error.message,
    });
  }
};

exports.getCustomerDetailsCustomerId = async (req, res) => {
  try {
    const customerId = req.params.id;

    if (!customerId || isNaN(parseInt(customerId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const customerData = await targetDDao.getDataCustomerId(customerId);

    if (customerData.message) {
      return res.status(404).json({
        success: false,
        message: customerData.message,
      });
    }

    res.status(200).json({
      success: true,
      data: customerData,
    });
  } catch (error) {
    console.error("Error fetching customer details by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer details",
      error: error.message,
    });
  }
};

exports.getAllPCity = asyncHandler(async (req, res) => {
  try {
    const packages = await targetDDao.getAllCity();

    if (!packages || packages.length === 0) {
      return res.status(404).json({ message: "No City found" });
    }

    res
      .status(200)
      .json({ message: "City fetched successfully", data: packages });
  } catch (error) {
    console.error("Error fetching city:", error);
    res.status(500).json({ message: "Failed to fetch city" });
  }
});

exports.getOrderMarketplaceOrdash = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    if (!orderId || isNaN(parseInt(orderId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const orderData = await targetDDao.getOrderMarketplaceOrdash(orderId);

    if (orderData.error) {
      return res.status(404).json({
        success: false,
        message: orderData.message,
      });
    }

    res.status(200).json({
      success: true,
      data: orderData,
    });
  } catch (error) {
    console.error("Error fetching order by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order details",
      error: error.message,
    });
  }
};
