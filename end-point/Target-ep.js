const TargetDAO = require('../dao/Target-dao')
const TargetValidate = require('../Validations/Target-validation')



exports.getAllCropCatogory = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const result = await TargetDAO.getAllCropNameDAO()

    console.log("Successfully fetched gatogory");
    return res.status(200).json(result);
  } catch (error) {
    if (error.isJoi) {
      // Handle validation error
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching crop names and verity:", error);
    return res.status(500).json({ error: "An error occurred while fetching crop names and verity" });
  }
}

exports.addDailyTarget = async (req, res) => {
  try {
    const target = req.body;
    console.log(target.TargetItems.length, req.user);
    const companyId = req.user.companyId;
    const userId = req.user.id;

    console.log(target, companyId, userId);


    const targetId = await TargetDAO.createDailyTargetDao(target, companyId, userId);

    if (!targetId) {
      return res.json({ message: "Faild create target try again!", status: false })
    }

    for (let i = 0; i < target.TargetItems.length; i++) {
      console.log(i);
      await TargetDAO.createDailyTargetItemsDao(target.TargetItems[i], targetId);
    }

    console.log("Daily Target Created Successfully");
    res.json({ message: "Daily Target Created Successfully!", status: true })
  } catch (err) {
    if (err.isJoi) {
      // Validation error
      console.error("Validation error:", err.details[0].message);
      return res.status(400).json({ error: err.details[0].message });
    }

    console.error("Error fetching news:", err);
    res.status(500).json({ error: "An error occurred while fetching news" });
  }
};


exports.getAllDailyTarget = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { searchText, page, limit } = await TargetValidate.getAllDailyTargetSchema.validateAsync(req.query);
    const companyId = req.user.companyId

    console.log(searchText, page, limit, companyId);

    const resultTarget = await TargetDAO.getAllDailyTargetDAO(companyId, searchText);
    const resultComplete = await TargetDAO.getAllDailyTargetCompleteDAO(companyId, searchText);
    const combinedData = [];


    for (const target of resultTarget) {
      const completeMatch = resultComplete.find(
        (complete) =>
          complete.cropNameEnglish === target.cropNameEnglish &&
          complete.varietyNameEnglish === target.varietyNameEnglish &&
          complete.grade === target.grade
        // &&
        // new Date(complete.buyDate) >= new Date(target.fromDate) &&
        // new Date(complete.buyDate) <= new Date(target.toDate)
      );


      // Logic for adding combined data
      if (target.qtyA !== undefined) {
        combinedData.push({
          cropNameEnglish: target.cropNameEnglish,
          varietyNameEnglish: target.varietyNameEnglish,
          toDate: target.toDate,
          toTime: target.toTime,
          grade: "A",
          status: parseFloat(completeMatch?.totA) >= parseFloat(target.qtyA) ? 'Completed' : 'Pending',
          TargetQty: target.qtyA,
          CompleteQty: completeMatch?.totA || "0.00",
        });
      }

      if (target.qtyB !== undefined) {
        combinedData.push({
          cropNameEnglish: target.cropNameEnglish,
          varietyNameEnglish: target.varietyNameEnglish,
          toDate: target.toDate,
          toTime: target.toTime,
          grade: "B",
          status: parseFloat(completeMatch?.totB) >= parseFloat(target.qtyB) ? 'Completed' : 'Pending',
          TargetQty: target.qtyB,
          CompleteQty: completeMatch?.totB || "0.00",
        });
      }

      if (target.qtyC !== undefined) {
        combinedData.push({
          cropNameEnglish: target.cropNameEnglish,
          varietyNameEnglish: target.varietyNameEnglish,
          toDate: target.toDate,
          toTime: target.toTime,
          grade: "C",
          status: parseFloat(completeMatch?.totC) >= parseFloat(target.qtyC) ? 'Completed' : 'Pending',
          TargetQty: target.qtyC,
          CompleteQty: completeMatch?.totC || "0.00",
        });
      }
    }

    const totalCount = combinedData.length;

    const totalPages = Math.ceil(totalCount / limit);


    const startIndex = (page - 1) * limit;
    const paginatedData = combinedData.slice(startIndex, startIndex + limit);

    console.log("Successfully transformed data");
    return res.status(200).json({
      items: paginatedData,
      totalPages: totalCount
    });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching crop names and verity:", error);
    return res.status(500).json({ error: "An error occurred while fetching crop names and verity" });
  }
};


exports.downloadDailyTarget = async (req, res) => {
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  console.log(fullUrl);

  try {
    const { fromDate, toDate } = await TargetValidate.downloadDailyTargetSchema.validateAsync(req.query);
    const companyId = req.user.companyId

    console.log(fromDate, toDate, companyId);

    const resultTarget = await TargetDAO.downloadAllDailyTargetDao(companyId, fromDate, toDate);
    const resultComplete = await TargetDAO.downloadAllDailyTargetCompleteDAO(companyId, fromDate, toDate);
    const combinedData = [];


    for (const target of resultTarget) {
      const completeMatch = resultComplete.find(
        (complete) =>
          complete.cropNameEnglish === target.cropNameEnglish &&
          complete.varietyNameEnglish === target.varietyNameEnglish &&
          complete.grade === target.grade
        // &&
        // new Date(complete.buyDate) >= new Date(target.fromDate) &&
        // new Date(complete.buyDate) <= new Date(target.toDate)
      );


      // Logic for adding combined data
      if (target.qtyA !== undefined) {
        combinedData.push({
          cropNameEnglish: target.cropNameEnglish,
          varietyNameEnglish: target.varietyNameEnglish,
          toDate: target.toDate,
          toTime: target.toTime,
          grade: "A",
          status: parseFloat(completeMatch?.totA) >= parseFloat(target.qtyA) ? 'Completed' : 'Pending',
          TargetQty: target.qtyA,
          CompleteQty: completeMatch?.totA || "0.00",
        });
      }

      if (target.qtyB !== undefined) {
        combinedData.push({
          cropNameEnglish: target.cropNameEnglish,
          varietyNameEnglish: target.varietyNameEnglish,
          toDate: target.toDate,
          toTime: target.toTime,
          grade: "B",
          status: parseFloat(completeMatch?.totB) >= parseFloat(target.qtyB) ? 'Completed' : 'Pending',
          TargetQty: target.qtyB,
          CompleteQty: completeMatch?.totB || "0.00",
        });
      }

      if (target.qtyC !== undefined) {
        combinedData.push({
          cropNameEnglish: target.cropNameEnglish,
          varietyNameEnglish: target.varietyNameEnglish,
          toDate: target.toDate,
          toTime: target.toTime,
          grade: "C",
          status: parseFloat(completeMatch?.totC) >= parseFloat(target.qtyC) ? 'Completed' : 'Pending',
          TargetQty: target.qtyC,
          CompleteQty: completeMatch?.totC || "0.00",
        });
      }
    }


    console.log("Successfully transformed data");
    return res.status(200).json({ message: 'Daily tartget find', status: true, data: combinedData });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    console.error("Error fetching crop names and verity:", error);
    return res.status(500).json({ error: "An error occurred while fetching crop names and verity" });
  }
};




exports.deleteTargetById = async (req, res) => {
  const targetId = req.params.id;

  if (!targetId) {
    return res.status(400).json({ error: "Target ID is required" });
  }

  try {
    await TargetDAO.deleteTargetByIdDao(targetId);
    res.status(200).json({ message: "Target deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete target" });
  }
};



exports.getAllTargets = async (req, res) => {
  try {
    const targets = await TargetDAO.getAllTargetsDao();

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Reset time to start of the day

    const formattedTargets = targets.reduce((acc, target) => {
      const targetToDate = new Date(target.toDate);
      targetToDate.setHours(0, 0, 0, 0); // Reset time to start of the day for accurate comparison

      const targetType = targetToDate < currentDate ? "expired" : "active"; // Classify based on `toDate`

      const existing = acc[targetType].find((t) => t.targetId === target.targetId);
      if (existing) {
        existing.items.push({
          itemId: target.itemId,
          varietyId: target.varietyId,
          qtyA: target.qtyA,
          qtyB: target.qtyB,
          qtyC: target.qtyC,
        });
      } else {
        acc[targetType].push({
          targetId: target.targetId,
          companyId: target.companyId,
          fromDate: target.fromDate,
          toDate: target.toDate,
          fromTime: target.fromTime,
          toTime: target.toTime,
          createdBy: target.createdBy,
          createdAt: target.createdAt,
          items: target.itemId ? [{
            itemId: target.itemId,
            varietyId: target.varietyId,
            qtyA: target.qtyA,
            qtyB: target.qtyB,
            qtyC: target.qtyC,
          }] : [],
        });
      }
      return acc;
    }, { active: [], expired: [] }); // Initial structure for active and expired

    res.status(200).json(formattedTargets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch targets" });
  }
};


exports.getTargetsByCompanyId = async (req, res) => {
  try {
    const centerId = req.user.centerId; // Fetch companyId from request parameters

    if (!centerId) {
      return res.status(400).json({ error: "centerId is required" });
    }

    const targets = await TargetDAO.getTargetsByCompanyIdDao(centerId);

    if (!targets.length) {
      return res.status(404).json({ message: "No targets found for this company." });
    }

    const formattedTargets = targets.flatMap((target) => {
      return target.itemId
        ? [
          ...(parseFloat(target.targetA) > 0 || parseFloat(target.todoQtyA) > 0
            ? [{
              varietyId: target.varietyId,
              grade: "A", // Assuming a static grade for simplicity, modify if grade is dynamic
              target: target.targetA,
              todo: target.todoQtyA,
            }]
            : []),
          ...(parseFloat(target.targetB) > 0 || parseFloat(target.todoQtyB) > 0
            ? [{
              varietyId: target.varietyId,
              grade: "B", // Assuming grade B for qtyB
              target: target.targetB,
              todo: target.todoQtyB,
            }]
            : []),
          ...(parseFloat(target.targetC) > 0 || parseFloat(target.todoQtyC) > 0
            ? [{
              varietyId: target.varietyId,
              grade: "C", // Assuming grade C for qtyC
              target: target.targetC,
              todo: target.todoQtyC,
            }]
            : []),
        ]
        : [];
    });

    res.status(200).json(formattedTargets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch targets" });
  }
};




exports.getCenterTargetEp = async (req, res) => {
  try {
    const { varietyId, grade } = req.params; // Get parameters from URL
    const centerId = req.user.centerId; // Get center ID from the authenticated
    console.log("Received API Request - varietyId:", varietyId, "grade:", grade, "centerId:", centerId);

    // Ensure parameters exist
    if (!centerId || !varietyId || !grade) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const results = await TargetDAO.getCenterTargetDao(centerId, varietyId, grade);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching center target data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};




exports.getCenterTarget = async (req, res) => {
  try {
    const centerId = req.user.centerId; // Get centerId from the authenticated user
    console.log("Received API Request - centerId:", centerId);

    // Ensure the centerId exists
    if (!centerId) {
      return res.status(400).json({ success: false, message: 'Missing centerId' });
    }

    // Call DAO to get center target data based on centerId
    const targets = await TargetDAO.getCenterTarget(centerId);

    // Map the results in the required format for all grades (A, B, C)
    const formattedTargets = targets.map((target) => [
      // Grade A
      {
        varietyId: target.varietyId,
        varietyNameEnglish: target.varietyNameEnglish,
        varietyNameEnglish: target.varietyNameEnglish,
        varietyNameTamil: target.varietyNameTamil,
        grade: "A",
        target: parseFloat(target.qtyA || 0),
        todo: parseFloat(target.qtyA || 0) - parseFloat(target.complteQtyA || 0),
        complete: parseFloat(target.complteQtyA || 0),
      },
      // Grade B
      {
        varietyId: target.varietyId,
        varietyNameEnglish: target.varietyNameEnglish,
        varietyNameSinhala: target.varietyNameSinhala,
        varietyNameTamil: target.varietyNameTamil,
        grade: "B",
        target: parseFloat(target.qtyB || 0),
        todo: parseFloat(target.qtyB || 0) - parseFloat(target.complteQtyB || 0),
      },
      // Grade C
      {
        varietyId: target.varietyId,
        varietyNameEnglish: target.varietyNameEnglish,
        varietyNameSinhala: target.varietyNameSinhala,
        varietyNameTamil: target.varietyNameTamil,
        grade: "C",
        target: parseFloat(target.qtyC || 0),
        todo: parseFloat(target.qtyC || 0) - parseFloat(target.complteQtyC || 0),
      },
    ]).flat();  // Flatten the array to ensure all results are in a single array

    res.json({ success: true, data: formattedTargets });
  } catch (error) {
    console.error('Error fetching center target data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};




exports.getTargetForOfficerManagerView = async (req, res) => {
  try {
    const officerId = req.user.id;
    const centerId = req.user.centerId; // Get center ID from authenticated user session

    console.log("Received API Request - Officer ID:", officerId, "Center ID:", centerId);

    if (!officerId) {
      return res.status(400).json({ error: "Officer ID is required" });
    }

    // Fetch officer targets
    const targets = await TargetDAO.getTargetForOfficerDao(officerId);

    if (!targets.length) {
      return res.status(404).json({ message: "No targets found for this officer." });
    }

    // Format officer targets
    const formattedTargets = targets.map((target) => ({
      varietyId: target.varietyId,
      varietyNameEnglish: target.varietyNameEnglish,
      varietyNameSinhala: target.varietyNameSinhala,
      varietyNameTamil: target.varietyNameTamil,
      grade: target.grade,
      target: parseFloat(target.target),
      todo: parseFloat(target.target) - parseFloat(target.complete),
      complete: parseFloat(target.complete)
    }));

    // Fetch center targets for the same varieties & grades
    const centerTargets = await Promise.all(
      formattedTargets.map(async (target) => {
        const centerTargetData = await TargetDAO.getCenterTargetDao(centerId, target.varietyId, target.grade);
        return {
          varietyNameEnglish: target.varietyNameEnglish,
          varietyNameSinhala: target.varietyNameSinhala,
          varietyNameTamil: target.varietyNameTamil,
          grade: target.grade,
          centerTarget: centerTargetData.length > 0 ? centerTargetData[0] : null,
        };
      })
    );

    // Combine officer targets with center target data
    const combinedData = formattedTargets.map((target) => {
      const centerData = centerTargets.find(
        (ct) => ct.varietyId === target.varietyId && ct.grade === target.grade
      );
      return {
        ...target,
        centerTarget: centerData ? centerData.centerTarget : null,
      };
    });

    res.status(200).json({ success: true, data: combinedData });
  } catch (error) {
    console.error("Error fetching target data:", error);
    res.status(500).json({ error: "Failed to fetch target data." });
  }
};






exports.getTargetForOfficer = async (req, res) => {
  try {
    const { officerId } = req.params;

    // Validate officerId
    if (!officerId || isNaN(officerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid officer ID provided'
      });
    }

    // Get targets from DAO
    const targets = await TargetDAO.getTargetForOfficerDao(officerId);

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





exports.transferTarget = async (req, res) => {
  const { fromOfficerId, toOfficerId, varietyId, grade, amount } = req.body;
  console.log('from officer---', fromOfficerId)

  if (!fromOfficerId || !toOfficerId || !varietyId || !grade || !amount) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const result = await TargetDAO.transferTargetDAO(fromOfficerId, toOfficerId, varietyId, grade, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.receiveTarget = async (req, res) => {
  const { fromOfficerId, toOfficerId, varietyId, grade, amount } = req.body;
  console.log('from officer---', fromOfficerId)

  if (!fromOfficerId || !toOfficerId || !varietyId || !grade || !amount) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const result = await TargetDAO.receiveTargetDAO(fromOfficerId, toOfficerId, varietyId, grade, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.ManagertransferTarget = async (req, res) => {
  console.log('recieved pass target', req.body);
  const { toOfficerId, varietyId, grade, amount } = req.body;

  const fromOfficerId = req.user.id;


  if (!fromOfficerId || !toOfficerId || !varietyId || !grade || !amount) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const result = await TargetDAO.transferTargetDAO(fromOfficerId, toOfficerId, varietyId, grade, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.ManagereceiveTarget = async (req, res) => {
  const { fromOfficerId, varietyId, grade, amount } = req.body;
  const toOfficerId = req.user.id;

  console.log('recieved pass target', req.body);

  if (!fromOfficerId || !toOfficerId || !varietyId || !grade || !amount) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    const result = await TargetDAO.receiveTargetDAO(fromOfficerId, toOfficerId, varietyId, grade, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getDailyTarget = async (req, res) => {
  const { officerId, varietyId, grade } = req.params;
  console.log('getDailyTarget', req.params);

  if (!officerId || !varietyId) {
    return res.status(400).json({ error: "Missing required parameters: officerId and varietyId" });
  }

  try {
    const targets = await TargetDAO.getDailyTargetByOfficerAndVariety(officerId, varietyId, grade);
    res.status(200).json({ status: "success", data: targets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getOfficerTaskSummary = async (req, res) => {
  try {
    const officerId = req.user.id; // Extract officer ID from authenticated session

    if (!officerId) {
      return res.status(400).json({ error: "Officer ID is required" });
    }

    console.log("Fetching task summary for Officer ID:", officerId);

    // Fetch summary data from DAO
    const taskSummary = await TargetDAO.getOfficerSummaryDao(officerId);

    if (!taskSummary) {
      return res.status(404).json({ message: "No tasks found for this officer." });
    }

    const { totalTasks, completedTasks } = taskSummary;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.status(200).json({
      success: true,
      officerId,
      totalTasks,
      completedTasks,
      completionPercentage: `${percentage}%`
    });
  } catch (error) {
    console.error("Error fetching task summary:", error);
    res.status(500).json({ error: "Failed to fetch task summary." });
  }
};


exports.getOfficerTaskSummaryManagerView = async (req, res) => {
  try {
    const { collectionOfficerId } = req.params; // Extract officer ID from authenticated session
    console.log('officerId', collectionOfficerId);

    if (!collectionOfficerId) {
      return res.status(400).json({ error: "Officer ID is required" });
    }

    console.log("Fetching task summary for Officer ID:", collectionOfficerId);

    // Fetch summary data from DAO
    const taskSummary = await TargetDAO.getOfficerSummaryDaoManager(collectionOfficerId);

    if (!taskSummary) {
      return res.status(404).json({ message: "No tasks found for this officer." });
    }

    const { totalTasks, completedTasks } = taskSummary;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.status(200).json({
      success: true,
      collectionOfficerId,
      totalTasks,
      completedTasks,
      completionPercentage: `${percentage}%`
    });
  } catch (error) {
    console.error("Error fetching task summary:", error);
    res.status(500).json({ error: "Failed to fetch task summary." });
  }
};