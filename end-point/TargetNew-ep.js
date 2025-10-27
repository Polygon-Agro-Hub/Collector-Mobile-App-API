const TargetDAO = require('../dao/TargetNew-dao');

const targetValidation = require('../Validations/Target-validation');

exports.getDailyTargetsForOfficer = async (req, res) => {
  try {
    const { officerId } = req.params;

    if (!officerId || isNaN(officerId)) {
      return res.status(400).json({
        success: false,
        message: "Valid officer ID is required"
      });
    }

    const dailyTargets = await TargetDAO.getOfficerDailyTargets(officerId);

    res.status(200).json({
      success: true,
      data: dailyTargets
    });
  } catch (error) {
    console.error("Error fetching daily targets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch daily targets"
    });
  }
};


exports.getTargetForOfficerManagerView = async (req, res) => {
  try {
    const officerId = req.user.id;

    if (!officerId || isNaN(officerId)) {
      return res.status(400).json({
        success: false,
        message: "Valid officer ID is required"
      });
    }

    const dailyTargets = await TargetDAO.getOfficerDailyTargets(officerId);

    res.status(200).json({
      success: true,
      data: dailyTargets
    });
  } catch (error) {
    console.error("Error fetching daily targets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch daily targets"
    });
  }
};


exports.getCenterTarget = async (req, res) => {
  try {
    const centerId = req.user.centerId;

    console.log('centerId', centerId)

    if (!centerId || isNaN(centerId)) {
      return res.status(400).json({
        success: false,
        message: "Valid center ID is required"
      });
    }

    const targets = await TargetDAO.getCenterTarget(centerId);
    console.log('targets', targets)

    res.status(200).json({
      success: true,
      data: targets
    });
  } catch (error) {
    console.error("Error in getCenterTargets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get center targets"
    });
  }
};



exports.transferTarget = async (req, res) => {
  // Validate request body
  const { error } = targetValidation.transferSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { fromOfficerId, toOfficerId, varietyId, grade, amount } = req.body;
  console.log('from officer---', fromOfficerId);

  try {
    const result = await TargetDAO.transferTargetDAO(fromOfficerId, toOfficerId, varietyId, grade, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.receiveTarget = async (req, res) => {
  // Validate request body
  const { error } = targetValidation.transferSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { fromOfficerId, toOfficerId, varietyId, grade, amount } = req.body;
  console.log('from officer---', fromOfficerId);

  try {
    const result = await TargetDAO.receiveTargetDAO(fromOfficerId, toOfficerId, varietyId, grade, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.ManagertransferTarget = async (req, res) => {
  console.log('recieved pass target', req.body);

  // Validate request body
  const { error } = targetValidation.managerTransferSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { toOfficerId, varietyId, grade, amount } = req.body;
  const fromOfficerId = req.user.id;

  try {
    const result = await TargetDAO.transferTargetDAO(fromOfficerId, toOfficerId, varietyId, grade, amount);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.ManagereceiveTarget = async (req, res) => {
  // Validate request body
  const { error } = targetValidation.managerReceiveSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const { fromOfficerId, varietyId, grade, amount } = req.body;
  const toOfficerId = req.user.id;

  console.log('recieved pass target', req.body);

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

// exports.getOfficerTaskSummary = async (req, res) => {
//   try {
//     const officerId = req.user.id; // Extract officer ID from authenticated session

//     if (!officerId) {
//       return res.status(400).json({ error: "Officer ID is required" });
//     }

//     console.log("Fetching task summary for Officer ID:", officerId);

//     // Fetch summary data from DAO
//     const taskSummary = await TargetDAO.getOfficerSummaryDao(officerId);

//     if (!taskSummary) {
//       return res.status(404).json({ message: "No tasks found for this officer." });
//     }

//     const { totalTasks, completedTasks } = taskSummary;
//     const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

//     res.status(200).json({
//       success: true,
//       officerId,
//       totalTasks,
//       completedTasks,
//       completionPercentage: `${percentage}%`
//     });
//   } catch (error) {
//     console.error("Error fetching task summary:", error);
//     res.status(500).json({ error: "Failed to fetch task summary." });
//   }
// };

exports.getOfficerTaskSummary = async (req, res) => {
  try {
    const officerId = req.user.id;
    if (!officerId) {
      return res.status(400).json({ error: "Officer ID is required" });
    }
    console.log("Fetching task summary for Officer ID:", officerId);

    const taskSummary = await TargetDAO.getOfficerSummaryDao(officerId);

    if (!taskSummary) {
      return res.status(404).json({ message: "No tasks found for this officer." });
    }

    const { totalTasks, completedTasks, totalTarget, totalComplete } = taskSummary;

    // Calculate percentage based on total target vs total complete
    const percentage = totalTarget > 0
      ? Math.round((totalComplete / totalTarget) * 100)
      : 0;

    res.status(200).json({
      success: true,
      officerId,
      totalTasks,
      completedTasks,
      totalTarget,
      totalComplete,
      completionPercentage: `${percentage}%`
    });
  } catch (error) {
    console.error("Error fetching task summary:", error);
    res.status(500).json({ error: "Failed to fetch task summary." });
  }
};


// exports.getOfficerTaskSummaryManagerView = async (req, res) => {
//   try {
//     const { collectionOfficerId } = req.params; // Extract officer ID from authenticated session
//     console.log('officerId', collectionOfficerId);

//     if (!collectionOfficerId) {
//       return res.status(400).json({ error: "Officer ID is required" });
//     }

//     console.log("Fetching task summary for Officer ID:", collectionOfficerId);

//     // Fetch summary data from DAO
//     const taskSummary = await TargetDAO.getOfficerSummaryDaoManager(collectionOfficerId);

//     if (!taskSummary) {
//       return res.status(404).json({ message: "No tasks found for this officer." });
//     }

//     const { totalTasks, completedTasks } = taskSummary;
//     const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

//     res.status(200).json({
//       success: true,
//       collectionOfficerId,
//       totalTasks,
//       completedTasks,
//       completionPercentage: `${percentage}%`
//     });
//   } catch (error) {
//     console.error("Error fetching task summary:", error);
//     res.status(500).json({ error: "Failed to fetch task summary." });
//   }
// };

exports.getOfficerTaskSummaryManagerView = async (req, res) => {
  try {
    const { collectionOfficerId } = req.params;
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

    const { totalTasks, completedTasks, totalTarget, totalComplete, gradesAssigned } = taskSummary;

    // Calculate percentage based on total target vs total complete
    const percentage = totalTarget > 0
      ? Math.round((totalComplete / totalTarget) * 100)
      : 0;

    res.status(200).json({
      success: true,
      collectionOfficerId,
      totalTasks,
      completedTasks,
      totalTarget,
      totalComplete,
      gradesAssigned,
      completionPercentage: `${percentage}%`
    });
  } catch (error) {
    console.error("Error fetching task summary:", error);
    res.status(500).json({ error: "Failed to fetch task summary." });
  }
};