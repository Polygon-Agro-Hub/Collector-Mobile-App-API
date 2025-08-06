const collectionofficerDao = require('../dao/manager-dao')
const jwt = require('jsonwebtoken'); const Joi = require('joi');

const uploadFileToS3 = require('../Middlewares/s3upload');

// exports.createCollectionOfficer = async (req, res) => {
//   try {
//     const { id: irmId } = req.user;

//     // Get IRM details
//     const irmDetails = await collectionofficerDao.getIrmDetails(irmId);
//     if (!irmDetails) {
//       return res.status(404).json({ error: "IRM details not found" });
//     }

//     const { companyId, centerId } = irmDetails;

//     // Validate NIC
//     console.log("NIC:", req.body.nicNumber);
//     const nicExists = await collectionofficerDao.checkNICExist(req.body.nicNumber);
//     if (nicExists) {
//       return res.status(400).json({ error: "NIC or Email already exists" });
//     }

//     // Validate Email
//     console.log("Email:", req.body.email);
//     const emailExists = await collectionofficerDao.checkEmailExist(req.body.email);
//     if (emailExists) {
//       return res.status(400).json({ error: "Email already exists." });
//     }

//     // Map request body fields
//     const officerData = {
//       ...req.body,
//       empId: req.body.userId, // Map userId to empId
//       phoneNumber01: req.body.phoneNumber1, // Map phoneNumber1 to phoneNumber01
//       phoneNumber02: req.body.phoneNumber2 || null, // Map phoneNumber2 to phoneNumber02
//       nic: req.body.nicNumber,
//       accHolderName: req.body.accountHolderName,
//       accNumber: req.body.accountNumber,
//       phoneCode01: req.body.phoneCode1,
//       phoneCode02: req.body.phoneCode2 || null,
//     };

//     console.log("Mapped Officer Data:", officerData);

//     // Create the collection officer
//     const resultsPersonal = await collectionofficerDao.createCollectionOfficerPersonal(
//       officerData,
//       centerId,
//       companyId,
//       irmId
//     );

//     console.log("Collection Officer created successfully:", resultsPersonal);
//     return res.status(201).json({
//       message: "Collection Officer created successfully",
//       id: resultsPersonal.insertId,
//       status: true,
//     });
//   } catch (error) {
//     console.error("Error creating collection officer:", error);
//     return res.status(500).json({
//       error: "An error occurred while creating the collection officer",
//     });
//   }
// };
const createCollectionOfficerSchema = require('../Validations/manager-validation')

// exports.createCollectionOfficer = async (req, res) => {
//   try {

//     // Validate request body using Joi
//     const { error, value } = createCollectionOfficerSchema.createCollectionOfficerSchema.validate(req.body, {
//       abortEarly: false,  // Return all errors, not just the first one
//       stripUnknown: true  // Remove unknown keys
//     });

//     if (error) {
//       const errorMessages = error.details.map(detail => detail.message);
//       return res.status(400).json({
//         error: "Validation failed",
//         details: errorMessages
//       });
//     }


//     const { id: irmId, role:jobRole } = req.user;
//     console.log("hiiiiiiiiiiiiiiiiiiiii", jobRole)

//     // Get IRM details
//     const irmDetails = await collectionofficerDao.getIrmDetails(irmId, jobRole);
//     if (!irmDetails) {
//       return res.status(404).json({ error: "IRM details not found" });
//     }
//     const { companyId, centerId } = irmDetails;

//     // Validate NIC
//     console.log("NIC:", req.body.nicNumber);
//     const nicExists = await collectionofficerDao.checkNICExist(req.body.nicNumber);
//     if (nicExists) {
//       return res.status(400).json({ error: "NIC or Email already exists" });
//     }

//     // Validate Email
//     console.log("Email:", req.body.email);
//     const emailExists = await collectionofficerDao.checkEmailExist(req.body.email);
//     if (emailExists) {
//       return res.status(400).json({ error: "Email already exists." });
//     }

//     // Helper function to convert base64 to buffer (defined inline)
//     const convertBase64ToBuffer = (base64String) => {
//       try {
//         // Remove data:image/jpeg;base64, or similar prefix if present
//         const base64Data = base64String.includes(';base64,')
//           ? base64String.split(';base64,').pop()
//           : base64String;

//         return Buffer.from(base64Data, 'base64');
//       } catch (error) {
//         console.error("Error converting base64 to buffer:", error);
//         throw new Error("Invalid base64 format");
//       }
//     };

//     // Helper function to generate a unique filename (defined inline)
//     const generateUniqueFileName = (originalName) => {
//       const timestamp = Date.now();
//       const randomStr = Math.random().toString(36).substring(2, 8);

//       // Extract extension from original filename or use default
//       let fileExt = 'jpg';
//       if (originalName && originalName.includes('.')) {
//         fileExt = originalName.split('.').pop();
//       }

//       return `${timestamp}-${randomStr}.${fileExt}`;
//     };

//     // Handle image upload from base64
//     let profileImageUrl = null;
//     if (req.body.profileImage) {
//       try {
//         // Convert base64 to buffer
//         const fileBuffer = convertBase64ToBuffer(req.body.profileImage);

//         // Generate a unique filename
//         const fileName = generateUniqueFileName('profile.jpg');

//         // Upload to S3
//         profileImageUrl = await uploadFileToS3(
//           fileBuffer,
//           fileName,
//           "collection-officers/profile-images"
//         );
//       } catch (uploadError) {
//         console.error("Error uploading image to S3:", uploadError);
//         return res.status(400).json({ error: "Invalid image format or upload failed" });
//       }
//     }

//     // Map request body fields and include profile image URL if available
//     const officerData = {
//       ...req.body,
//       empId: req.body.userId, // Map userId to empId
//       phoneNumber01: req.body.phoneNumber1, // Map phoneNumber1 to phoneNumber01
//       phoneNumber02: req.body.phoneNumber2 || null, // Map phoneNumber2 to phoneNumber02
//       nic: req.body.nicNumber,
//       accHolderName: req.body.accountHolderName,
//       accNumber: req.body.accountNumber,
//       phoneCode01: req.body.phoneCode1,
//       phoneCode02: req.body.phoneCode2 || null,
//       profileImageUrl, // Include the S3 URL for the image
//     };

//     console.log("Mapped Officer Data:", officerData);

//     // Create the collection officer
//     const resultsPersonal = await collectionofficerDao.createCollectionOfficerPersonal(
//       officerData,
//       centerId,
//       companyId,
//       irmId,
//       jobRole
//     );

//     console.log("Collection Officer created successfully:", resultsPersonal);
//     return res.status(201).json({
//       message: "Collection Officer created successfully",
//       id: resultsPersonal.insertId,
//       status: true,
//     });
//   } catch (error) {
//     console.error("Error creating collection officer:", error);
//     return res.status(500).json({
//       error: "An error occurred while creating the collection officer",
//     });
//   }
// };

exports.createCollectionOfficer = async (req, res) => {
  try {
    // Validate request body using Joi
    const { error, value } = createCollectionOfficerSchema.createCollectionOfficerSchema.validate(req.body, {
      abortEarly: false,  // Return all errors, not just the first one
      stripUnknown: true  // Remove unknown keys
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        error: "Validation failed",
        details: errorMessages
      });
    }

    const { id: irmId, role: jobRole } = req.user;
    console.log("Job Role:", jobRole);

    // Get IRM details
    const irmDetails = await collectionofficerDao.getIrmDetails(irmId, jobRole);
    if (!irmDetails) {
      return res.status(404).json({ error: "IRM details not found" });
    }
    const { companyId, centerId } = irmDetails;

    // Validate NIC
    console.log("NIC:", req.body.nicNumber);
    const nicExists = await collectionofficerDao.checkNICExist(req.body.nicNumber);
    if (nicExists) {
      return res.status(400).json({ error: "NIC or Email already exists" });
    }

    // Validate Email
    console.log("Email:", req.body.email);
    const emailExists = await collectionofficerDao.checkEmailExist(req.body.email);
    if (emailExists) {
      return res.status(400).json({ error: "Email already exists." });
    }

    // Generate empId based on job role
    const generatedEmpId = await collectionofficerDao.generateEmpId(req.body.jobRole);
    console.log("Generated empId:", generatedEmpId);

    // Helper function to convert base64 to buffer (defined inline)
    const convertBase64ToBuffer = (base64String) => {
      try {
        // Remove data:image/jpeg;base64, or similar prefix if present
        const base64Data = base64String.includes(';base64,')
          ? base64String.split(';base64,').pop()
          : base64String;

        return Buffer.from(base64Data, 'base64');
      } catch (error) {
        console.error("Error converting base64 to buffer:", error);
        throw new Error("Invalid base64 format");
      }
    };

    // Helper function to generate a unique filename (defined inline)
    const generateUniqueFileName = (originalName) => {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);

      // Extract extension from original filename or use default
      let fileExt = 'jpg';
      if (originalName && originalName.includes('.')) {
        fileExt = originalName.split('.').pop();
      }

      return `${timestamp}-${randomStr}.${fileExt}`;
    };

    // Handle image upload from base64
    let profileImageUrl = null;
    if (req.body.profileImage) {
      try {
        // Convert base64 to buffer
        const fileBuffer = convertBase64ToBuffer(req.body.profileImage);

        // Generate a unique filename
        const fileName = generateUniqueFileName('profile.jpg');

        // Upload to S3
        profileImageUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "collection-officers/profile-images"
        );
      } catch (uploadError) {
        console.error("Error uploading image to S3:", uploadError);
        return res.status(400).json({ error: "Invalid image format or upload failed" });
      }
    }

    // Map request body fields and include generated empId and profile image URL
    const officerData = {
      ...req.body,
      empId: generatedEmpId, // Use generated empId instead of userId
      phoneNumber01: req.body.phoneNumber1, // Map phoneNumber1 to phoneNumber01
      phoneNumber02: req.body.phoneNumber2 || null, // Map phoneNumber2 to phoneNumber02
      nic: req.body.nicNumber,
      accHolderName: req.body.accountHolderName,
      accNumber: req.body.accountNumber,
      phoneCode01: req.body.phoneCode1,
      phoneCode02: req.body.phoneCode2 || null,
      profileImageUrl, // Include the S3 URL for the image
    };

    console.log("Mapped Officer Data:", officerData);

    // Create the collection officer
    const resultsPersonal = await collectionofficerDao.createCollectionOfficerPersonal(
      officerData,
      centerId,
      companyId,
      irmId,
      jobRole
    );

    console.log("Collection Officer created successfully:", resultsPersonal);
    return res.status(201).json({
      message: "Collection Officer created successfully",
      id: resultsPersonal.insertId,
      empId: generatedEmpId, // Return the generated empId
      status: true,
    });
  } catch (error) {
    console.error("Error creating collection officer:", error);
    return res.status(500).json({
      error: "An error occurred while creating the collection officer",
    });
  }
};



exports.getForCreateId = async (req, res) => {
  try {
    const { role } = req.params;
    console.log("Role:", role);
    let rolePrefix;

    // Determine the role prefix based on the role
    if (role === 'Collection Officer') {
      rolePrefix = 'COO';
    } else if (role === 'Distribution Officer') {
      rolePrefix = 'DIO';
    }

    const results = await collectionofficerDao.getForCreateId(rolePrefix);
    console.log('employee id', results);

    if (results.length === 0) {
      return res.json({ result: { empId: "00001" }, status: true });
    }

    res.status(200).json({ result: results[0], status: true });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
};



//transaction details
exports.getFarmerListByCollectionOfficerAndDate = async (req, res) => {
  const { collectionOfficerId, date } = req.query;

  if (!collectionOfficerId || !date) {
    return res.status(400).json({
      error: 'Both collectionOfficerId and date are required.',
    });
  }

  try {
    const farmers = await collectionofficerDao.getFarmerListByCollectionOfficerAndDate(
      collectionOfficerId,
      date
    );
    res.status(200).json(farmers);
  } catch (error) {
    console.error('Error fetching farmer list:', error);
    res.status(500).json({ error: 'An error occurred while fetching the farmer list' });
  }
};


exports.getFarmerListByCollectionOfficerAndDateForManager = async (req, res) => {
  const { date } = req.query;
  const collectionOfficerId = req.user.id;
  console.log('manager transcations officer id', collectionOfficerId) // Get the collectionOfficerId from authenticated user (req.user.id)

  // Check if the date is provided
  if (!date) {
    return res.status(400).json({
      error: 'Date is required.',
    });
  }

  try {
    // Call the DAO function with collectionOfficerId and date
    const farmers = await collectionofficerDao.getFarmerListByCollectionOfficerAndDate(
      collectionOfficerId,
      date
    );
    res.status(200).json(farmers);
    // console.log(farmers);
  } catch (error) {
    console.error('Error fetching farmer list:', error);
    res.status(500).json({ error: 'An error occurred while fetching the farmer list' });
  }
};


exports.getClaimOfficer = async (req, res) => {

  const { empID, jobRole } = req.body;
  try {
    const results = await collectionofficerDao.getClaimOfficer(empID, jobRole);
    res.status(200).json({ result: results, status: true });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
}

exports.createClaimOfficer = async (req, res) => {
  const { officerId } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: "Authorization token is missing" });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const irmId = decoded.id;
  const centerId = decoded.centerId;
  const mangerJobRole = decoded.role

  try {
    const results = await collectionofficerDao.createClaimOfficer(officerId, irmId, centerId, mangerJobRole);
    res.status(200).json({ result: results, status: true });
  } catch (err) {
    console.error("Error executing query:", err);
    res.status(500).send("An error occurred while fetching data.");
  }
}

exports.disclaimOfficer = async (req, res) => {
  const { collectionOfficerId, jobRole } = req.body;
  console.log("Request Body in Middleware:", req.body);
  if (!collectionOfficerId) {
    return res.status(400).json({ status: 'error', message: 'Missing collectionOfficerId in request body.' });
  }

  try {
    const results = await collectionofficerDao.disclaimOfficer(collectionOfficerId, jobRole);
    if (results.affectedRows > 0) {
      res.status(200).json({
        status: 'success',
        data: results,
        message: 'Officer disclaimed successfully.',
      });
    } else {
      res.status(404).json({
        status: 'error',
        message: 'Officer not found or already disclaimed.',
      });
    }
  } catch (err) {
    console.error('Error executing query:', err);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while disclaiming the officer.',
    });
  }
};



//GET farmer details for the managers purchase report
exports.GetFarmerReportDetails = async (req, res) => {
  const { userId, createdAt, farmerId } = req.params; // Extract userId, createdAt, and farmerId from params

  try {
    if (!userId || !createdAt || !farmerId) {
      return res.status(400).json({ error: 'userId, createdAt, and farmerId parameters are required.' });
    }

    const cropDetails = await collectionofficerDao.GetFarmerReportDetailsDao(userId, createdAt, farmerId);
    res.status(200).json(cropDetails);
  } catch (error) {
    console.error('Error fetching crop details:', error);
    res.status(500).json({ error: 'An error occurred while fetching crop details' });
  }
};




//get the collection officer list for the manager and the end-points for the monthly report of a collection officer
exports.getCollectionOfficers = async (req, res) => {
  try {
    const managerId = req.user.id;
    const [rows] = await collectionofficerDao.getCollectionOfficers(managerId);
    console.log(rows)

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No collection officers found for the given manager ID.',
      });
    }

    res.status(200).json({
      status: 'success',
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching collection officers:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching collection officers.',
    });
  }
};

exports.getFarmerPaymentsSummary = async (req, res) => {
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

    const [rows] = await collectionofficerDao.getFarmerPaymentsSummary({
      collectionOfficerId,
      fromDate,
      toDate,
    });

    const reportData = rows.map(row => ({
      date: new Date(row.date).toLocaleDateString('en-US', { timeZone: 'Asia/Colombo' }),
      TCount: row.TCount,
      total: row.total ? parseFloat(row.total) : 0,
    }));

    res.status(200).json({
      status: 'success',
      data: reportData,
    });
  } catch (error) {
    console.error('Error fetching daily report:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred while fetching the report.',
    });
  }
};


exports.getOfficerDetailsForReport = async (req, res) => {
  const { empId } = req.params;

  if (!empId) {
    return res.status(400).json({
      status: 'error',
      message: 'Employee ID is required.',
    });
  }

  try {
    const [rows] = await collectionofficerDao.getOfficerDetails(empId);

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


exports.getofficeronline = async (req, res) => {
  const { collectionOfficerId } = req.params;

  try {
    const result = await collectionofficerDao.getOfficerOnlineStatus(collectionOfficerId);
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error fetching officer status:', error);
    res.status(500).json({ success: false, error: 'An error occurred while fetching officer status.' });
  }
};



