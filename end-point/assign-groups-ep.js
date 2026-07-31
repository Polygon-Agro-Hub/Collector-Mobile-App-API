const assignGroupsDao = require("../dao/assign-groups-dao");
const asyncHandler = require("express-async-handler");

// Time slot code mapping helpers
const timeSlotMap = {
  "8-12": "08:00 AM - 12:00 PM",
  "12-4": "12:00 PM - 04:00 PM",
  "4-9": "04:00 PM - 09:00 PM"
};

/**
 * Get timeslot groups for today (split into retail & wholesale)
 */
exports.getGroupTimeslots = asyncHandler(async (req, res) => {
  const dbResults = await assignGroupsDao.getGroupTimeslotCounts();
  
  // Default structure matching Group.tsx expect
  const retail = [
    { id: 1, timeSlotCode: "8-12", timeSlot: "08:00 AM - 12:00 PM", ordersLeft: 0, status: "no_orders" },
    { id: 2, timeSlotCode: "12-4", timeSlot: "12:00 PM - 04:00 PM", ordersLeft: 0, status: "no_orders" },
    { id: 3, timeSlotCode: "4-9",  timeSlot: "04:00 PM - 09:00 PM", ordersLeft: 0, status: "no_orders" }
  ];
  
  const wholesale = [
    { id: 4, timeSlotCode: "8-12", timeSlot: "08:00 AM - 12:00 PM", ordersLeft: 0, status: "no_orders" },
    { id: 5, timeSlotCode: "12-4", timeSlot: "12:00 PM - 04:00 PM", ordersLeft: 0, status: "no_orders" },
    { id: 6, timeSlotCode: "4-9",  timeSlot: "04:00 PM - 09:00 PM", ordersLeft: 0, status: "no_orders" }
  ];

  dbResults.forEach(row => {
    const timeSlot = row.sheduleTime;
    const app = row.orderApp;
    const totalCount = row.totalCount || 0;
    const leftCount = Number(row.leftCount) || 0;

    const list = app === 'Marketplace' ? retail : wholesale;
    const item = list.find(g => g.timeSlot === timeSlot);
    
    if (item) {
      item.ordersLeft = leftCount;
      if (leftCount > 0) {
        item.status = "active";
      } else if (totalCount > 0) {
        item.status = "assigned";
      } else {
        item.status = "no_orders";
      }
    }
  });

  res.status(200).json({
    success: true,
    message: "Timeslots groups retrieved successfully",
    data: { retail, wholesale }
  });
});

/**
 * Get unassigned orders for a chosen timeslot group
 */
exports.getUnassignedOrders = asyncHandler(async (req, res) => {
  const { timeSlotCode, type } = req.query;

  if (!timeSlotCode || !type) {
    return res.status(400).json({
      success: false,
      message: "timeSlotCode and type are required query parameters"
    });
  }

  const sheduleTime = timeSlotMap[timeSlotCode];
  const orderApp = type.toLowerCase() === "retail" ? "Marketplace" : "Dash";

  if (!sheduleTime) {
    return res.status(400).json({
      success: false,
      message: "Invalid timeSlotCode. Must be 8-12, 12-4, or 4-9"
    });
  }

  const orders = await assignGroupsDao.getUnassignedOrdersForGroup(sheduleTime, orderApp);

  res.status(200).json({
    success: true,
    message: "Unassigned orders retrieved successfully",
    data: orders
  });
});

/**
 * Get allocated counts for enabled packing rows today
 */
exports.getRowAllocations = asyncHandler(async (req, res) => {
  const companyCenterId = req.user.companycenterId;
  const rows = await assignGroupsDao.getRowAllocationCounts(companyCenterId);
  res.status(200).json({
    success: true,
    message: "Row allocations retrieved successfully",
    data: rows
  });
});

/**
 * Assign selected orders to a packing row
 */
exports.assignGroupOrders = asyncHandler(async (req, res) => {
  const { rowId, timeSlotCode, orderIds } = req.body;

  if (!rowId || isNaN(rowId) || !timeSlotCode || !orderIds || !Array.isArray(orderIds)) {
    return res.status(400).json({
      success: false,
      message: "rowId (number), timeSlotCode (string), and orderIds (array) are required"
    });
  }

  const result = await assignGroupsDao.assignOrdersToRow(
    Number(rowId),
    timeSlotCode,
    orderIds.map(Number)
  );

  res.status(200).json({
    success: true,
    message: "Orders assigned to packing row successfully",
    data: result
  });
});
