const db = require("../../startup/database");

exports.getDCenterTarget = (irmId = null) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
          co.id,
          co.irmId,

          dt.id AS distributedTargetId,
          pr.companyCenterId AS companycenterId,
          co.id AS userId,
          (SELECT COUNT(*) FROM distributedtargetitems WHERE targetId = dt.id) AS target,
          (SELECT COUNT(*) FROM distributedtargetitems WHERE targetId = dt.id AND orderStatus = 'Completed') AS complete,
          dt.createdAt AS targetCreatedAt,

          dti.id AS distributedTargetItemId,
          dti.orderId,
          (CASE WHEN dti.orderStatus = 'Completed' THEN 1 ELSE 0 END) AS isComplete,
          dti.completeTime,
          dti.createdAt AS itemCreatedAt,

          po.id AS processOrderId,
          po.invNo,
          po.transactionId,
          po.paymentMethod,
          po.isPaid,
          po.amount,
          po.status,
          po.outDlvrDate,
          po.createdAt AS orderCreatedAt,
          po.reportStatus,

          o.id AS orderId,
          o.isPackage,
          o.userId AS orderUserId,
          o.orderApp,
          o.buildingType,
          o.sheduleType,
          o.sheduleDate,
          o.sheduleTime,

          -- Additional item counts
          COALESCE(additional_item_counts.total_items, 0) AS totalAdditionalItems,
          COALESCE(additional_item_counts.packed_items, 0) AS packedAdditionalItems,
          COALESCE(additional_item_counts.pending_items, 0) AS pendingAdditionalItems,

          -- Additional item status
          CASE 
              WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN NULL
              WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
              WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
                   COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
              WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
              ELSE NULL
          END AS additionalItemStatus,

          -- Package counts
          COALESCE(package_item_counts.total_items, 0) AS totalPackageItems,
          COALESCE(package_item_counts.packed_items, 0) AS packedPackageItems,
          COALESCE(package_item_counts.pending_items, 0) AS pendingPackageItems,
          COALESCE(package_item_counts.total_packages, 0) AS totalPackages,
          COALESCE(package_item_counts.locked_packages, 0) AS lockedPackages,
          COALESCE(package_item_counts.completed_packages, 0) AS completedPackages,
          COALESCE(package_item_counts.opened_packages, 0) AS openedPackages,
          COALESCE(package_item_counts.pending_packages, 0) AS pendingPackages,

          package_item_counts.all_locked AS allPackagesLocked,
          package_item_counts.packing_status_summary AS packagePackingStatusSummary,

          -- Overall package status
          CASE 
              WHEN o.isPackage = 0 THEN NULL
              WHEN COALESCE(package_item_counts.total_packages, 0) = 0 THEN 'Pending'
              WHEN COALESCE(package_item_counts.completed_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Completed'
              WHEN COALESCE(package_item_counts.pending_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Pending'
              ELSE 'Opened'
          END AS packageItemStatus,

          -- Final overall selectedStatus
          CASE 
              WHEN o.isPackage = 0 THEN
                  CASE 
                      WHEN COALESCE(additional_item_counts.total_items, 0) = 0 THEN 'Pending'
                      WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
                      WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND 
                           COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
                      WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) THEN 'Completed'
                      ELSE 'Pending'
                  END
              WHEN o.isPackage = 1 THEN
                  CASE 
                      WHEN COALESCE(additional_item_counts.total_items, 0) > 0 AND 
                           COALESCE(package_item_counts.total_packages, 0) > 0 THEN
                          CASE 
                              WHEN COALESCE(additional_item_counts.packed_items, 0) = COALESCE(additional_item_counts.total_items, 0) AND
                                   COALESCE(package_item_counts.completed_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Completed'
                              WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 OR
                                   COALESCE(package_item_counts.pending_packages, 0) > 0 THEN 'Pending'
                              WHEN COALESCE(additional_item_counts.packed_items, 0) > 0 AND
                                   COALESCE(package_item_counts.pending_packages, 0) = 0 THEN 'Opened'
                              ELSE 'Pending'
                          END
                      WHEN COALESCE(additional_item_counts.total_items, 0) > 0 THEN
                          CASE 
                              WHEN COALESCE(additional_item_counts.packed_items, 0) = 0 THEN 'Pending'
                              WHEN COALESCE(additional_item_counts.packed_items, 0) < COALESCE(additional_item_counts.total_items, 0) THEN 'Opened'
                              ELSE 'Completed'
                          END
                      WHEN COALESCE(package_item_counts.total_packages, 0) > 0 THEN
                          CASE 
                              WHEN COALESCE(package_item_counts.completed_packages, 0) = COALESCE(package_item_counts.total_packages, 0) THEN 'Completed'
                              WHEN COALESCE(package_item_counts.pending_packages, 0) > 0 THEN 'Pending'
                              ELSE 'Opened'
                          END
                      ELSE 'Pending'
                  END
              ELSE 'Pending'
          END AS selectedStatus

      FROM 
          distributedtarget dt
      LEFT JOIN
          targetposition tp ON dt.id = tp.targetId
      LEFT JOIN 
          collectionofficer co ON tp.officerId = co.id
      LEFT JOIN
          packingrows pr ON dt.rowId = pr.id
      INNER JOIN 
          distributedtargetitems dti ON dt.id = dti.targetId
      LEFT JOIN 
          processorders po ON dti.orderId = po.id
      LEFT JOIN 
          orders o ON po.orderId = o.id
      LEFT JOIN (
          SELECT 
              orderId,
              COUNT(*) as total_items,
              SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
              SUM(CASE WHEN isPacked = 0 THEN 1 ELSE 0 END) as pending_items
          FROM orderadditionalitems
          GROUP BY orderId
      ) additional_item_counts ON o.id = additional_item_counts.orderId
      LEFT JOIN (
          SELECT 
              op.orderId,
              COUNT(DISTINCT op.id) as total_packages,
              SUM(CASE WHEN op.isLock = 1 THEN 1 ELSE 0 END) as locked_packages,
              SUM(COALESCE(package_items.total_items, 0)) as total_items,
              SUM(COALESCE(package_items.packed_items, 0)) as packed_items,
              SUM(COALESCE(package_items.pending_items, 0)) as pending_items,
              CASE WHEN COUNT(CASE WHEN op.isLock = 0 THEN 1 END) = 0 THEN 1 ELSE 0 END as all_locked,
              GROUP_CONCAT(DISTINCT op.packingStatus ORDER BY op.packingStatus) as packing_status_summary,
              SUM(CASE 
                  WHEN COALESCE(package_items.total_items, 0) = 0 THEN 0
                  WHEN COALESCE(package_items.packed_items, 0) = COALESCE(package_items.total_items, 0) THEN 1 
                  ELSE 0 
              END) as completed_packages,
              SUM(CASE 
                  WHEN COALESCE(package_items.total_items, 0) = 0 THEN 1
                  WHEN COALESCE(package_items.packed_items, 0) = 0 THEN 1 
                  ELSE 0 
              END) as pending_packages,
              SUM(CASE 
                  WHEN COALESCE(package_items.packed_items, 0) > 0 AND 
                       COALESCE(package_items.packed_items, 0) < COALESCE(package_items.total_items, 0) THEN 1 
                  ELSE 0 
              END) as opened_packages
          FROM orderpackage op
          LEFT JOIN (
              SELECT 
                  orderPackageId,
                  COUNT(id) as total_items,
                  SUM(CASE WHEN isPacked = 1 THEN 1 ELSE 0 END) as packed_items,
                  SUM(CASE WHEN isPacked = 0 THEN 1 ELSE 0 END) as pending_items
              FROM orderpackageitems
              GROUP BY orderPackageId
          ) package_items ON op.id = package_items.orderPackageId
          GROUP BY op.orderId
      ) package_item_counts ON po.id = package_item_counts.orderId

      WHERE
          DATE(dt.createdAt) BETWEEN DATE_SUB(CURDATE(), INTERVAL 2 DAY) AND CURDATE()
          ${irmId ? "AND (co.irmId = ? OR tp.officerId = ?)" : ""}

      ORDER BY 
          pr.companyCenterId ASC,
          tp.officerId DESC,
          (SELECT COUNT(*) FROM distributedtargetitems WHERE targetId = dt.id) ASC,
          (SELECT COUNT(*) FROM distributedtargetitems WHERE targetId = dt.id AND orderStatus = 'Completed') ASC,
          o.id ASC
    `;

    const queryParams = irmId ? [irmId, irmId] : [];
    db.collectionofficer.query(sql, queryParams, (err, results) => {
      if (err) {
        console.error("Error executing query:", err);
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.getOfficerDetailsById = (officerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        co.*, 
        co.empId,
        dc.regCode,
        dc.centerName AS collectionCenterName,
        dc.contact01 AS centerContact01,
        dc.contact02 AS centerContact02,
        dc.district AS centerDistrict,
        dc.province AS centerProvince,
        com.companyNameEnglish AS companyNameEnglish,
        com.companyNameSinhala AS companyNameSinhala,
        com.companyNameTamil AS companyNameTamil,
        com.email AS companyEmail,
        com.oicName AS companyOICName,
        com.oicEmail AS companyOICEmail
      FROM 
        collectionofficer co
      JOIN 
        distributedcenter dc ON co.distributedCenterId = dc.id
      JOIN 
        company com ON co.companyId = com.id
      WHERE 
        co.id = ?;
    `;

    db.collectionofficer.query(sql, [officerId], (err, results) => {
      if (err) {
        console.error("Database error:", err.message);
        return reject(new Error("Database error"));
      }

      if (results.length === 0) {
        return reject(new Error("Officer not found"));
      }

      resolve(results[0]);
    });
  });
};
exports.getAllDistributionOfficer = async (managerId) => {
  try {
    const managerQuery = `
      SELECT 
        id,
        centerId,
        distributedCenterId,
        companyId,
        irmId,
        firstNameEnglish,
        firstNameSinhala,
        firstNameTamil,
        lastNameEnglish,
        lastNameSinhala,
        lastNameTamil,
        jobRole,
        empId
      FROM collectionofficer 
      WHERE id = ?
    `;

    const officersQuery = `
      SELECT 
        id,
        centerId,
        distributedCenterId,
        companyId,
        irmId,
        firstNameEnglish,
        firstNameSinhala,
        firstNameTamil,
        lastNameEnglish,
        lastNameSinhala,
        lastNameTamil,
        jobRole,
        empId
      FROM collectionofficer 
      WHERE irmId = ? AND status = 'Approved'
    `;

    const [managerRows] = await db.collectionofficer
      .promise()
      .query(managerQuery, [managerId]);
    const [officerRows] = await db.collectionofficer
      .promise()
      .query(officersQuery, [managerId]);

    const allData = [];

    if (managerRows.length > 0) {
      allData.push(managerRows[0]);
    }

    allData.push(...officerRows);

    return allData;
  } catch (error) {
    console.error("Error in getAllDistributionOfficer DAO:", error);
    throw error;
  }
};

exports.targetPass = async (params) => {
  try {
    const {
      assigneeOfficerId,
      targetItems,
      invoiceNumbers,
      processOrderId,
      officerId,
    } = params;

    if (!officerId) {
      return { success: false, message: "officerId is required" };
    }

    if (!assigneeOfficerId) {
      return { success: false, message: "assigneeOfficerId is required" };
    }

    if (!Array.isArray(processOrderId) || processOrderId.length === 0) {
      return {
        success: false,
        message: "processOrderId must be a non-empty array",
      };
    }

    let sourceOfficerId;

    const sourceQuery = `
      SELECT id FROM collection_officer.collectionofficer
      WHERE empId = ?
      LIMIT 1
    `;
    const sourceResult = await db.collectionofficer
      .promise()
      .query(sourceQuery, [officerId]);

    if (!sourceResult[0] || sourceResult[0].length === 0) {
      return {
        success: false,
        message: `Source officer not found with empId: ${officerId}`,
      };
    }
    sourceOfficerId = parseInt(sourceResult[0][0].id);

    let targetOfficerId;

    if (
      typeof assigneeOfficerId === "number" ||
      !isNaN(parseInt(assigneeOfficerId))
    ) {
      targetOfficerId = parseInt(assigneeOfficerId);
    } else {
      const assigneeQuery = `
        SELECT id FROM collection_officer.collectionofficer
        WHERE empId = ?
        LIMIT 1
      `;
      const assigneeResult = await db.collectionofficer
        .promise()
        .query(assigneeQuery, [assigneeOfficerId]);

      if (!assigneeResult[0] || assigneeResult[0].length === 0) {
        return {
          success: false,
          message: `Assignee officer not found with code: ${assigneeOfficerId}`,
        };
      }
      targetOfficerId = parseInt(assigneeResult[0][0].id);
    }

    const targetFromOrderQuery = `
      SELECT dt.id, dt.userId, dt.target, dt.complete, dt.createdAt, dt.companycenterId
      FROM collection_officer.distributedtargetitems dti
      JOIN collection_officer.distributedtarget dt ON dti.targetId = dt.id
      WHERE dti.orderId = ?
      LIMIT 1
    `;
    const targetFromOrderResult = await db.collectionofficer
      .promise()
      .query(targetFromOrderQuery, [parseInt(processOrderId[0])]);

    const sourceRows = targetFromOrderResult[0];

    if (!sourceRows || sourceRows.length === 0) {
      return {
        success: false,
        message: `Could not find a target record for the selected orders.`,
      };
    }

    if (parseInt(sourceRows[0].userId) !== sourceOfficerId) {
      return {
        success: false,
        message: `These orders do not belong to officer ${officerId}. They belong to userId: ${sourceRows[0].userId}.`,
      };
    }

    const sourceTargetId = parseInt(sourceRows[0].id);
    const sourceTargetCount = sourceRows[0].target;
    const sourceComplete = sourceRows[0].complete;
    const sourceCreatedAt = sourceRows[0].createdAt;

    const assigneeTargetQuery = `
      SELECT id, userId, target, complete, createdAt
      FROM collection_officer.distributedtarget
      WHERE userId = ?
      AND DATE(createdAt) = CURDATE()
      ORDER BY id DESC
      LIMIT 1
    `;
    const assigneeTargetResult = await db.collectionofficer
      .promise()
      .query(assigneeTargetQuery, [targetOfficerId]);

    const assigneeRows = assigneeTargetResult[0];

    let assigneeTargetId;
    let assigneeTargetCount;

    if (!assigneeRows || assigneeRows.length === 0) {
      const getCompanyCenterQuery = `
        SELECT companycenterId
        FROM collection_officer.distributedtarget
        WHERE userId = ?
        ORDER BY id DESC
        LIMIT 1
      `;
      const companyCenterResult = await db.collectionofficer
        .promise()
        .query(getCompanyCenterQuery, [targetOfficerId]);

      let companycenterId;
      if (companyCenterResult[0] && companyCenterResult[0].length > 0) {
        companycenterId = companyCenterResult[0][0].companycenterId;
      } else {
        companycenterId = sourceRows[0].companycenterId || null;
      }

      const createTargetQuery = `
        INSERT INTO collection_officer.distributedtarget
        (companycenterId, userId, target, complete, createdAt)
        VALUES (?, ?, 0, 0, NOW())
      `;
      const createResult = await db.collectionofficer
        .promise()
        .query(createTargetQuery, [companycenterId, targetOfficerId]);

      assigneeTargetId = parseInt(createResult[0].insertId);
      assigneeTargetCount = 0;
    } else {
      assigneeTargetId = parseInt(assigneeRows[0].id);
      assigneeTargetCount = assigneeRows[0].target;
    }

    const transferCount = processOrderId.length;

    if (sourceTargetCount < transferCount) {
      return {
        success: false,
        message: `Source officer does not have enough targets. Has ${sourceTargetCount}, trying to transfer ${transferCount}.`,
      };
    }

    const newSourceTarget = sourceTargetCount - transferCount;
    const updateSourceQuery = `
      UPDATE collection_officer.distributedtarget
      SET target = ?
      WHERE id = ?
    `;
    await db.collectionofficer
      .promise()
      .query(updateSourceQuery, [newSourceTarget, sourceTargetId]);

    const newAssigneeTarget = assigneeTargetCount + transferCount;
    const updateAssigneeQuery = `
      UPDATE collection_officer.distributedtarget
      SET target = ?
      WHERE id = ?
    `;
    await db.collectionofficer
      .promise()
      .query(updateAssigneeQuery, [newAssigneeTarget, assigneeTargetId]);

    const results = [];
    const errors = [];

    for (const orderId of processOrderId) {
      try {
        const orderIdInt = parseInt(orderId);

        const checkOrderQuery = `
          SELECT id, targetId, orderId
          FROM collection_officer.distributedtargetitems
          WHERE orderId = ?
        `;
        const existingRecords = await db.collectionofficer
          .promise()
          .query(checkOrderQuery, [orderIdInt]);
        const existingRows = existingRecords[0];

        if (!existingRows || existingRows.length === 0) {
          errors.push(`No records found for order ID: ${orderIdInt}`);
          continue;
        }

        if (existingRows[0].targetId !== sourceTargetId) {
          errors.push(
            `Order ID ${orderIdInt} does not belong to source target (targetId mismatch: ${existingRows[0].targetId} vs ${sourceTargetId})`,
          );
          continue;
        }

        const updateItemsQuery = `
          UPDATE collection_officer.distributedtargetitems
          SET targetId = ?
          WHERE orderId = ?
        `;
        const updateResult = await db.collectionofficer
          .promise()
          .query(updateItemsQuery, [assigneeTargetId, orderIdInt]);

        if (updateResult[0].affectedRows === 0) {
          errors.push(`No records updated for order ID: ${orderIdInt}`);
          continue;
        }

        const updatedRecordsQuery = `
          SELECT id, targetId, orderId
          FROM collection_officer.distributedtargetitems
          WHERE orderId = ?
          ORDER BY id ASC
        `;
        const updatedRecords = await db.collectionofficer
          .promise()
          .query(updatedRecordsQuery, [orderIdInt]);

        results.push({
          orderId: orderIdInt,
          previousTargetId: sourceTargetId,
          newTargetId: assigneeTargetId,
          affectedRows: updateResult[0].affectedRows,
          updatedRecords: updatedRecords[0],
        });
      } catch (orderError) {
        console.error(`Error processing order ID ${orderId}:`, orderError);
        errors.push(
          `Failed to process order ID ${orderId}: ${orderError.message}`,
        );
      }
    }

    const response = {
      success: results.length > 0,
      message:
        results.length > 0
          ? "Target passed successfully"
          : "No targets were passed",
      data: {
        sourceOfficer: {
          officerId: officerId,
          targetId: sourceTargetId,
          previousTarget: sourceTargetCount,
          newTarget: newSourceTarget,
          reduced: transferCount,
        },
        assigneeOfficer: {
          officerId: assigneeOfficerId,
          targetId: assigneeTargetId,
          previousTarget: assigneeTargetCount,
          newTarget: newAssigneeTarget,
          increased: transferCount,
        },
        transferredOrders: {
          successful: results.length,
          total: processOrderId.length,
          failed: errors.length,
        },
        targetItems: targetItems,
        invoiceNumbers: invoiceNumbers,
        results: results,
      },
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.message += ` (${errors.length} error(s) occurred)`;
    }

    return response;
  } catch (error) {
    console.error("Error in targetPass DAO:", error);
    return {
      success: false,
      message: "Database operation failed",
      error: error.message,
    };
  }
};

exports.getOfficerDetails = async (empId) => {
  const sql = `
    SELECT 
      firstNameEnglish AS firstName, 
      lastNameEnglish AS lastName, 
      jobRole 
    FROM 
      collectionofficer
    WHERE 
      empId = ?;
  `;
  return db.collectionofficer.promise().query(sql, [empId]);
};

exports.getDistributionPaymentsSummary = async ({
  collectionOfficerId,
  fromDate,
  toDate,
}) => {
  const sql = `
    SELECT 
        DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30')) AS date,
        COUNT(dti.id) AS completedOrders,
        SUM(COALESCE(po.amount, 0)) AS totalAmount,
        MIN(po.invNo) AS invNo,
        po.orderId AS orderId,
        o.sheduleDate AS sheduleDate,
        o.sheduleTime AS sheduleTime
    FROM 
        collection_officer.distributedtarget dt
    JOIN 
        collection_officer.distributedtargetitems dti ON dt.id = dti.targetId
    JOIN 
        processorders po ON po.id = dti.orderId
    JOIN 
        orders o ON o.id = po.orderId
    WHERE 
        dt.userId = ?
        AND dti.isComplete = 1
        AND dti.completeTime IS NOT NULL
        AND DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30')) BETWEEN ? AND ?
    GROUP BY 
        DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30')),
        po.orderId,
        o.sheduleDate,
        o.sheduleTime
    ORDER BY 
        DATE(CONVERT_TZ(dti.completeTime, '+00:00', '+05:30'));
    `;
  return db.collectionofficer
    .promise()
    .query(sql, [collectionOfficerId, fromDate, toDate]);
};

exports.getOfficerSummaryDaoManager = async (collectionOfficerId) => {
  try {
    const query = `
      SELECT 
        COUNT(dti.id) AS totalTasks,
        SUM(CASE WHEN dti.orderStatus = 'Completed' THEN 1 ELSE 0 END) AS completedTasks,
        SUM(CASE WHEN dti.orderStatus = 'Completed' THEN 1 ELSE 0 END) AS totalComplete,
        COUNT(dti.id) AS totalTarget
      FROM collection_officer.targetposition tp
      INNER JOIN collection_officer.distributedtarget dt
        ON tp.targetId = dt.id
      INNER JOIN collection_officer.distributedtargetitems dti
        ON dti.targetId = dt.id
      INNER JOIN processorders po
        ON po.id = dti.orderId
      INNER JOIN orders o
        ON o.id = po.orderId
      WHERE
        tp.officerId = ?
        AND DATE(tp.createdAt) = CURDATE()
    `;

    const [results] = await db.collectionofficer
      .promise()
      .query(query, [collectionOfficerId]);

    if (!results || results.length === 0 || results[0].totalTasks === null) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        totalComplete: 0,
        totalTarget: 0,
      };
    }

    return {
      totalTasks: parseInt(results[0].totalTasks) || 0,
      completedTasks: parseInt(results[0].completedTasks) || 0,
      totalComplete: parseInt(results[0].totalComplete) || 0,
      totalTarget: parseInt(results[0].totalTarget) || 0,
    };
  } catch (error) {
    console.error("Database error in getOfficerSummaryDao:", error);
    throw new Error(`Database operation failed: ${error.message}`);
  }
};

exports.getOrderById = async (orderId) => {
  let connection;

  try {
    connection = await db.collectionofficer.promise().getConnection();

    const orderSql = `
      SELECT
          o.id AS orderId,
          o.userId,
          o.orderApp,
          o.sheduleType,
          o.sheduleDate,
          o.sheduleTime,
          o.createdAt,
          o.total,
          o.buildingType AS orderBuildingType,
          o.discount,
          o.fullTotal,
          o.isPackage AS orderIsPackage,
          o.isCoupon,
          o.couponValue,
          o.couponType,
          o.delivaryMethod,
          o.centerId,
          o.title,
          o.fullName,
          o.phonecode1,
          o.phone1,
          o.phonecode2,
          o.phone2,
          o.buildingType AS userBuildingType,
          c.email
      FROM orders o
      JOIN marketplaceusers c ON o.userId = c.id
      WHERE o.id = ?
    `;

    const [orderResults] = await connection.execute(orderSql, [orderId]);

    if (orderResults.length === 0) {
      return { message: "No order found with the given ID" };
    }

    const order = orderResults[0];

    let finalIsPackage = 0;
    let processOrderId = null;
    let invoiceNumber = null;
    let orderStatus = null;
    let reportStatus = null;
    let paymentMethod = null;
    let isPaid = null;
    let creditPaid = null;

    if (order.orderApp === "Marketplace") {
      finalIsPackage = order.orderIsPackage || 0;

      const processOrderSql = `
        SELECT 
            id AS processOrderId,
            invNo AS invoiceNumber,
            status,
            paymentMethod,
            reportStatus,
            isPaid,
            creditPaid
        FROM processorders 
        WHERE orderId = ?
      `;

      const [processOrderResults] = await connection.execute(processOrderSql, [
        orderId,
      ]);

      if (processOrderResults.length > 0) {
        const processOrder = processOrderResults[0];
        processOrderId = processOrder.processOrderId;
        invoiceNumber = processOrder.invoiceNumber;
        orderStatus = processOrder.status;
        paymentMethod = processOrder.paymentMethod;
        reportStatus = processOrder.reportStatus;
        isPaid = processOrder.isPaid;
        creditPaid = processOrder.creditPaid;
      }
    } else if (order.orderApp === "Dash") {
      const processOrderSql = `
        SELECT 
            id AS processOrderId,
            invNo AS invoiceNumber,
            status,
            paymentMethod,
            reportStatus,
            isPaid,
            creditPaid
        FROM processorders 
        WHERE orderId = ?
      `;

      const [processOrderResults] = await connection.execute(processOrderSql, [
        orderId,
      ]);

      if (processOrderResults.length > 0) {
        const processOrder = processOrderResults[0];
        processOrderId = processOrder.processOrderId;
        invoiceNumber = processOrder.invoiceNumber;
        orderStatus = processOrder.status;
        paymentMethod = processOrder.paymentMethod;
        reportStatus = processOrder.reportStatus;
        isPaid = processOrder.isPaid;
        creditPaid = processOrder.creditPaid;

        const packageCheckSql = `
          SELECT COUNT(*) as packageCount
          FROM orderpackage 
          WHERE orderId = ?
        `;

        const [packageCheckResults] = await connection.execute(
          packageCheckSql,
          [processOrderId],
        );

        if (packageCheckResults[0].packageCount > 0) {
          finalIsPackage = 1;
        } else {
          finalIsPackage = 0;
        }
      }
    }

    const buildingType = order.orderBuildingType || order.userBuildingType;

    let formattedAddress = "";
    let apartmentAddress = null;

    if (buildingType === "House") {
      const addressSql = `
        SELECT
            houseNo,
            streetName,
            city
        FROM orderhouse
        WHERE orderId = ?
      `;

      const [addressResults] = await connection.execute(addressSql, [orderId]);

      if (addressResults[0]) {
        const addr = addressResults[0];
        formattedAddress =
          `${addr.houseNo || ""}, ${addr.streetName || ""}, ${addr.city || ""}`.trim();

        formattedAddress = formattedAddress
          .replace(/^,\s*/, "")
          .replace(/,\s*$/, "")
          .replace(/,\s*,/g, ",")
          .replace(/\s+/g, " ")
          .trim();
      } else {
        console.log("No house address found for orderId:", orderId);
      }
    } else if (buildingType === "Apartment") {
      const addressSql = `
        SELECT
            buildingNo,
            buildingName,
            unitNo,
            floorNo,
            houseNo,
            streetName,
            city
        FROM orderapartment
        WHERE orderId = ?
      `;

      const [addressResults] = await connection.execute(addressSql, [orderId]);

      if (addressResults[0]) {
        const addr = addressResults[0];

        apartmentAddress = {
          buildingNo: addr.buildingNo || null,
          buildingName: addr.buildingName || null,
          unitNo: addr.unitNo || null,
          floorNo: addr.floorNo || null,
          houseNo: addr.houseNo || null,
          streetName: addr.streetName || null,
          city: addr.city || null,
        };

        const addressParts = [];
        if (addr.buildingName) addressParts.push(addr.buildingName);
        if (addr.buildingNo) addressParts.push(addr.buildingNo);
        if (addr.unitNo) addressParts.push(`Unit ${addr.unitNo}`);
        if (addr.floorNo) addressParts.push(`Floor ${addr.floorNo}`);
        if (addr.houseNo) addressParts.push(addr.houseNo);
        if (addr.streetName) addressParts.push(addr.streetName);
        if (addr.city) addressParts.push(addr.city);
        formattedAddress = addressParts.join(", ");
      } else {
        console.log("No apartment address found for orderId:", orderId);
      }
    } else {
      console.log("Unknown building type:", buildingType);
    }

    let centerDetails = null;

    if (order.delivaryMethod === "Pickup" && order.centerId) {
      const centerSql = `
        SELECT
            centerName,
            city        AS centerCity,
            district    AS centerDistrict,
            province    AS centerProvince,
            country     AS centerCountry
        FROM collection_officer.distributedcenter
        WHERE id = ?
      `;

      let centerConnection;
      try {
        centerConnection = await db.collectionofficer.promise().getConnection();
        const [centerResults] = await centerConnection.execute(centerSql, [
          order.centerId,
        ]);

        if (centerResults.length > 0) {
          centerDetails = centerResults[0];
        } else {
          console.log("No center found for centerId:", order.centerId);
        }
      } catch (centerErr) {
        console.error("Failed to fetch center details:", centerErr);
      } finally {
        if (centerConnection) centerConnection.release();
      }
    }

    const additionalItemsSql = `
      SELECT
          oai.qty,
          oai.productId,
          oai.unit,
          oai.price,
          oai.discount AS itemDiscount
      FROM orderadditionalitems oai
      WHERE oai.orderId = ?
    `;

    const [additionalItemsResults] = await connection.execute(
      additionalItemsSql,
      [orderId],
    );

    const additionalItems = additionalItemsResults
      .filter((item) => item.productId !== null && item.productId !== undefined)
      .map((item) => ({
        productId: item.productId,
        qty: parseFloat(item.qty) || 0,
        unit: item.unit || "",
        price: parseFloat(item.price) || 0,
        discount: parseFloat(item.itemDiscount) || 0,
      }));

    let allPackages = [];

    if (finalIsPackage === 1 && processOrderId) {
      const packagesSql = `
        SELECT
            op.id AS orderPackageId,
            op.packageId,
            op.qty,
            mpp.displayName AS packageDisplayName,
            mpp.productPrice AS packagePrice,
            mpp.packingFee AS packagePackingFee,
            mpp.serviceFee AS packageServiceFee,
            mpp.status AS packageStatus,
            op.packingStatus,
            op.isLock,
            op.createdAt AS packageCreatedAt
        FROM orderpackage op
        LEFT JOIN marketplacepackages mpp ON mpp.id = op.packageId
        WHERE op.orderId = ?
        ORDER BY op.id ASC
      `;

      const [packagesResults] = await connection.execute(packagesSql, [
        processOrderId,
      ]);

      for (const packageData of packagesResults) {
        const packageItemsSql = `
          SELECT
              opi.id,
              opi.orderPackageId,
              opi.productType,
              opi.productId,
              opi.qty,
              opi.price,
              opi.isPacked,
              pt.typeName AS productTypeName,
              mi.displayName AS productDisplayName,
              mi.varietyId,
              mi.category,
              mi.normalPrice,
              mi.discountedPrice
          FROM orderpackageitems opi
          JOIN producttypes pt ON pt.id = opi.productType
          LEFT JOIN marketplaceitems mi ON mi.id = opi.productId
          WHERE opi.orderPackageId = ?
          ORDER BY opi.id ASC
        `;

        const [packageItemsResults] = await connection.execute(
          packageItemsSql,
          [packageData.orderPackageId],
        );

        const packageItems = packageItemsResults.map((item) => {
          const specName = item.productDisplayName || "N/A";
          const catName = item.productTypeName || "General";
          return {
            id: item.id,
            orderPackageId: item.orderPackageId,
            productType: item.productType,
            productTypeName: catName,
            productId: item.productId,
            productDisplayName: specName,
            itemDescription: specName !== "N/A" ? `${specName} (${catName})` : catName,
            varietyId: item.varietyId,
            category: item.category,
            normalPrice: item.normalPrice,
            discountedPrice: item.discountedPrice,
            qty: parseFloat(item.qty) || 0,
            price: parseFloat(item.price) || 0,
            isPacked: item.isPacked,
          };
        });

        // Group package items separately by category (e.g. Low Country Vegetables, Up Country Vege)
        const itemsByCategory = {};
        packageItems.forEach((pi) => {
          const cat = pi.productTypeName || "General";
          if (!itemsByCategory[cat]) {
            itemsByCategory[cat] = [];
          }
          itemsByCategory[cat].push(pi);
        });

        const packageInfo = {
          packageId: packageData.packageId,
          orderPackageId: packageData.orderPackageId,
          qty: parseInt(packageData.qty) || 1,
          displayName: packageData.packageDisplayName,
          productPrice: parseFloat(packageData.packagePrice) || 0,
          packingFee: parseFloat(packageData.packagePackingFee) || 0,
          serviceFee: parseFloat(packageData.packageServiceFee) || 0,
          status: packageData.packageStatus,
          packingStatus: packageData.packingStatus,
          isLock: packageData.isLock,
          packageCreatedAt: packageData.packageCreatedAt,
          packageItems: packageItems,
          itemsByCategory: itemsByCategory,
        };

        allPackages.push(packageInfo);
      }

      const expandedPackages = [];
      for (const pkg of allPackages) {
        const qty = parseInt(pkg.qty) || 1;
        for (let i = 0; i < qty; i++) {
          expandedPackages.push({ ...pkg });
        }
      }
      allPackages = expandedPackages;
    }

    let enhancedAdditionalItems = [];
    if (additionalItems.length > 0) {
      const productIds = additionalItems.map((item) => item.productId);
      const placeholders = productIds.map(() => "?").join(",");

      const productDetailsSql = `
        SELECT
            mi.id,
            mi.displayName,
            mi.varietyId,
            mi.category,
            mi.normalPrice,
            mi.discountedPrice
        FROM marketplaceitems mi
        WHERE mi.id IN (${placeholders})
      `;

      const [productResults] = await connection.execute(
        productDetailsSql,
        productIds,
      );

      enhancedAdditionalItems = additionalItems.map((item) => {
        const productDetail = productResults.find(
          (p) => p.id === item.productId,
        );
        return {
          ...item,
          displayName: productDetail
            ? productDetail.displayName
            : "Unknown Product",
          varietyId: productDetail ? productDetail.varietyId : null,
          category: productDetail ? productDetail.category : null,
          normalPrice: productDetail ? productDetail.normalPrice : null,
          discountedPrice: productDetail ? productDetail.discountedPrice : null,
        };
      });
    }

    const result = {
      orderId: order.orderId,
      userId: order.userId,
      orderApp: order.orderApp,
      scheduleType: order.sheduleType,
      scheduleDate: order.sheduleDate,
      scheduleTime: order.sheduleTime,
      createdAt: order.createdAt,
      total: parseFloat(order.total) || 0,
      discount: parseFloat(order.discount) || 0,
      fullTotal: parseFloat(order.fullTotal) || 0,
      isPackage: finalIsPackage,
      isCoupon: order.isCoupon,
      couponType: order.couponType || null,
      couponValue:
        order.orderApp === "Marketplace"
          ? parseFloat(order.couponValue) || 0
          : null,
      delivaryMethod: order.delivaryMethod || "Delivery",
      centerName: centerDetails?.centerName || null,
      centerCity: centerDetails?.centerCity || null,
      centerDistrict: centerDetails?.centerDistrict || null,
      centerProvince: centerDetails?.centerProvince || null,
      centerCountry: centerDetails?.centerCountry || null,
      customerInfo: {
        title: order.title || null,
        fullName: order.fullName || null,
        phoneCode1: order.phonecode1 || null,
        phone1: order.phone1 || null,
        phoneCode2: order.phonecode2 || null,
        phone2: order.phone2 || null,
        buildingType: buildingType,
        email: order.email,
      },
      fullAddress: formattedAddress,
      apartmentAddress: apartmentAddress,
      orderStatus: {
        processOrderId: processOrderId,
        invoiceNumber: invoiceNumber,
        status: orderStatus,
        paymentMethod: paymentMethod,
        reportStatus: reportStatus,
        isPaid: isPaid,
        creditPaid: creditPaid,
      },
      additionalItems: enhancedAdditionalItems,
      packages: allPackages,
    };

    return result;
  } catch (err) {
    console.error("Database error:", err);
    throw err;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};



exports.getAllCity = async () => {
  return new Promise((resolve, reject) => {
    const query = `
        SELECT id, city, charge,   createdAt
        FROM deliverycharge
      
        ORDER BY city ASC
        `;

    db.collectionofficer.query(query, (error, results) => {
      if (error) {
        console.error("Error fetching packages:", error);
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
};



exports.getClaimOfficer = (empID, jobRole, OfficercompanyId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        c.*, 
        comp.companyNameEnglish,
        comp.companyNameSinhala,
        comp.companyNameTamil
      FROM 
        collectionofficer c 
      INNER JOIN 
        company comp 
      ON 
        c.companyId = comp.id 
      WHERE 
        c.empId = ? 
        AND c.jobRole = ? 
        AND c.centerId IS NULL 
        AND c.claimStatus = 0
        AND c.companyId = ?
    `;

    db.collectionofficer.query(
      sql,
      [empID, jobRole, OfficercompanyId],
      (err, results) => {
        if (err) {
          return reject(err);
        }

        resolve(results);
      },
    );
  });
};




