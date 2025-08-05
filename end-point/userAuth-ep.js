const jwt = require("jsonwebtoken");
const userAuthDao = require("../dao/userAuth-dao");
const bcrypt = require("bcrypt");
const { loginSchema } = require('../Validations/Auth-validations');
const { Socket } = require("socket.io");
const uploadFileToS3 = require('../Middlewares/s3upload');
const delectfilesOnS3 = require('../Middlewares/s3delete')



// exports.loginUser = async (req, res) => {
//   try {
//     const { error } = loginSchema.validate(req.body);
//     console.log("Validation Error:", error);

//     if (error) {
//       return res.status(400).json({
//         status: "error",
//         message: error.details[0].message,
//       });
//     }

//     const { empId, password } = req.body;

//     console.log("Employee ID:", empId);
//     console.log("Password Provided:", password);

//     let collectionOfficerResult;
//     try {
//       collectionOfficerResult = await userAuthDao.getOfficerByEmpId(empId);
//     } catch (error) {
//       console.error("Error fetching Employee ID:", error.message);
//       return res.status(404).json({
//         status: "error",
//         message: error.message,
//       });
//     }

//     const collectionOfficerId = collectionOfficerResult[0]?.id;
//     const jobRole = collectionOfficerResult[0]?.jobRole;

//     if (!collectionOfficerId) {
//       return res.status(404).json({
//         status: "error",
//         message: "Invalid Employee ID",
//       });
//     }

//     const users = await userAuthDao.getOfficerPasswordById(collectionOfficerId);

//     if (!users || users.length === 0) {
//       return res.status(404).json({ status: "error", message: "User not found" });
//     }

//     const officer = users[0];
//     console.log("Hashed Password from Database:", officer.password);

//     // // Check if the officer's status is "Approved"
//     // if (officer.status !== "Approved") {	
//     //   return res.status(403).json({
//     //     status: "error",
//     //     message: `Access denied.No collection center found. Please contact the admin for assistance.`,
//     //   });
//     // }

//     // Compare the provided password with the hashed password in the database
//     const isPasswordValid = await bcrypt.compare(password, officer.password);
//     console.log("Password Match Result:", isPasswordValid);

//     if (!isPasswordValid) {
//       return res.status(401).json({
//         status: "error",
//         message: "Invalid password",
//       });
//     }

//     // If password is valid, generate a JWT token
//     const payload = {
//       id: officer.id,
//       email: officer.email,
//       firstNameEnglish: officer.firstNameEnglish,
//       lastNameEnglish: officer.lastNameEnglish,
//       phoneNumber01: officer.phoneNumber01,
//       centerId: officer.centerId,
//       companyId: officer.companyId,
//       empId: officer.empId,
//     };

//     const token = jwt.sign(payload, process.env.JWT_SECRET || "T1", {
//       expiresIn: "10h",
//     });

//     const passwordUpdateRequired = !officer.passwordUpdated;

//     const response = {
//       status: "success",
//       message: passwordUpdateRequired
//         ? "Login successful, but password update is required"
//         : "Login successful",
//       officer: payload,
//       passwordUpdateRequired,
//       token,
//       userId: officer.id,
//       jobRole: jobRole,
//       empId: officer.empId,
//     };

//     const status = 1

//     console.log(collectionOfficerId)
//     const resds = await userAuthDao.updateLoginStatus(collectionOfficerId, status );
//     console.log(resds)

//     res.status(200).json(response);
//   } catch (err) {
//     console.error("Login Error:", err);

//     if (err.isJoi) {
//       return res.status(400).json({
//         status: "error",
//         message: err.details[0].message,
//       });
//     }

//     res.status(500).json({
//       status: "error",
//       message: "An error occurred during login.",
//     });
//   }
// };

exports.loginUser = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    console.log("Validation Error:", error);

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.details[0].message,
      });
    }

    const { empId, password } = req.body;

    console.log("Employee ID:", empId);
    console.log("Password Provided:", password);

    let collectionOfficerResult;
    try {
      collectionOfficerResult = await userAuthDao.getOfficerByEmpId(empId);
    } catch (error) {
      console.error("Error fetching Employee ID:", error.message);
      return res.status(404).json({
        status: "error",
        message: error.message,
      });
    }


    const collectionOfficerId = collectionOfficerResult[0]?.id;
    const jobRole = collectionOfficerResult[0]?.jobRole;


    if (!collectionOfficerId) {
      return res.status(404).json({
        status: "error",
        message: "Invalid Employee ID",
      });
    }

    const users = await userAuthDao.getOfficerPasswordById(collectionOfficerId, jobRole);

    if (!users || users.length === 0) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    const officer = users[0];
    console.log("Hashed Password from Database:", officer.password);

    // // Check if the officer's status is "Approved"
    // if (officer.status !== "Approved") {	
    //   return res.status(403).json({
    //     status: "error",
    //     message: `Access denied.No collection center found. Please contact the admin for assistance.`,
    //   });
    // }
    const centerId = officer.centerId;
    const distributionCenterId = officer.distributedCenterId;
    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, officer.password);
    console.log("Password Match Result:", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Invalid password",
      });
    }

    let center;
    if (jobRole === "Collection Officer" || jobRole === "Collection Center Manager") {
      center = centerId;
    } else if (jobRole === "Distribution Center Manager" || jobRole === "Distribution Officer") {
      center = distributionCenterId;

    }
    console.log("Centre Id", center)

    // If password is valid, generate a JWT token
    const payload = {
      id: officer.id,
      email: officer.email,
      firstNameEnglish: officer.firstNameEnglish,
      lastNameEnglish: officer.lastNameEnglish,
      phoneNumber01: officer.phoneNumber01,
      centerId: center,
      companyId: officer.companyId,
      empId: officer.empId,
      role: officer.jobRole,
      companycenterId: officer.companycenterId
    };
    console.log("payload", payload)

    const token = jwt.sign(payload, process.env.JWT_SECRET || "T1", {
      expiresIn: "10h",
    });

    const passwordUpdateRequired = !officer.passwordUpdated;

    const response = {
      status: "success",
      message: passwordUpdateRequired
        ? "Login successful, but password update is required"
        : "Login successful",
      officer: payload,
      passwordUpdateRequired,
      token,
      userId: officer.id,
      jobRole: jobRole,
      empId: officer.empId,
      companyNameEnglish: officer.companyNameEnglish,
      companyNameSinhala: officer.companyNameSinhala,
      companyNameTamil: officer.companyNameTamil
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Login Error:", err);

    if (err.isJoi) {
      return res.status(400).json({
        status: "error",
        message: err.details[0].message,
      });
    }

    res.status(500).json({
      status: "error",
      message: "An error occurred during login.",
    });
  }
};


// exports.updatePassword = async (req, res) => {
//   const { empId, currentPassword, newPassword } = req.body;
//   console.log("Attempting to update password for empid:", empId);
//   if (!empId || !currentPassword || !newPassword) {
//     return res.status(400).json({ message: "All fields are required" });
//   }
//   const collectionOfficerIdResult = await userAuthDao.getOfficerByEmpId(
//     empId
//   );
//   const collectionOfficerId = collectionOfficerIdResult[0]?.id;
//   console.log("Collection Officer ID:", collectionOfficerId);

//   const users = await userAuthDao.getOfficerPasswordById(
//     collectionOfficerId
//   );
//   const officer = users[0];
//   console.log("Stored Hashed Password (from DB):", officer.password);

//   const isPasswordValid = await bcrypt.compare(currentPassword, officer.password);
//   console.log("Password Match Result:", isPasswordValid);
//   if (!isPasswordValid) {
//     return res.status(401).json({
//       status: "error",
//       message: "Invalid password",
//     });
//   }
//   const saltRounds = 10;
//   const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
//   console.log("Plain Password:", hashedPassword);
//   try {
//     try {
//       await userAuthDao.updatePasswordInDatabase(
//         collectionOfficerId,
//         hashedPassword
//       );

//       res.status(200).json({ message: "Password updated successfully" });
//     } catch (error) {
//       if (error === "Database error") {
//         return res.status(500).json({
//           message: "Database error occurred while updating the password",
//         });
//       } else if (error === "Current password is incorrect") {
//         return res
//           .status(401)
//           .json({ message: "Current password is incorrect" });
//       } else {
//         return res
//           .status(500)
//           .json({ message: "An error occurred while updating the password" });
//       }
//     }
//   } catch (error) {
//     console.error("Error updating password:", error);
//     res
//       .status(500)
//       .json({ message: "An error occurred while updating the password" });
//   }
// };


exports.updatePassword = async (req, res) => {
  const { empId, currentPassword, newPassword } = req.body;
  console.log("Attempting to update password for empid:", empId);

  if (!empId || !currentPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Get officer details by empId
    const collectionOfficerResult = await userAuthDao.getOfficerByEmpId(empId);

    // Check if officer exists
    if (!collectionOfficerResult || collectionOfficerResult.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "Employee ID not found",
      });
    }

    const collectionOfficerId = collectionOfficerResult[0]?.id;
    const jobRole = collectionOfficerResult[0]?.jobRole; // Get the job role
    console.log("Collection Officer ID:", collectionOfficerId);
    console.log("Job Role:", jobRole);

    // Get officer password with job role
    const users = await userAuthDao.getOfficerPasswordById(
      collectionOfficerId,
      jobRole // Pass the job role as second parameter
    );

    const officer = users[0];
    console.log("Stored Hashed Password (from DB):", officer.password);

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, officer.password);
    console.log("Password Match Result:", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "error",
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    console.log("New Hashed Password:", hashedPassword);

    // Update password in database
    await userAuthDao.updatePasswordInDatabase(collectionOfficerId, hashedPassword);

    res.status(200).json({
      status: "success",
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("Error updating password:", error);

    // Handle specific error types
    if (error.message === "Database query failed. Please try again.") {
      return res.status(500).json({
        status: "error",
        message: "Database error occurred while updating the password",
      });
    } else if (error.message === "Officer not found") {
      return res.status(404).json({
        status: "error",
        message: "Officer details not found",
      });
    } else if (error === "Database error while updating password") {
      return res.status(500).json({
        status: "error",
        message: "Database error occurred while updating the password",
      });
    } else {
      return res.status(500).json({
        status: "error",
        message: "An error occurred while updating the password",
      });
    }
  }
};

// exports.getProfile = async (req, res) => {
//   const userId = req.user.id;

//   try {
//     const user = await userAuthDao.getProfileById(userId);

//     res.status(200).json({
//       status: "success",
//       user: {
//         firstNameEnglish: user.firstNameEnglish,
//         firstNameSinhala: user.firstNameSinhala,
//         firstNameTamil: user.firstNameTamil,
//         lastNameEnglish: user.lastNameEnglish,
//         lastNameSinhala: user.lastNameSinhala,
//         lastNameTamil: user.lastNameTamil,
//         phoneNumber01: user.phoneNumber01,
//         phoneNumber02: user.phoneNumber02,
//         image: user.image,
//         nic: user.nic,
//         email: user.email,
//         address: {
//           houseNumber: user.houseNumber,
//           streetName: user.streetName,
//           city: user.city,
//           district: user.district,
//           province: user.province,
//           country: user.country,
//         },
//         languages: user.languages,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({
//       status: "error",
//       message: error.message,
//     });
//   }
// };

exports.getProfile = async (req, res) => {
  try {
    const officerId = req.user.id; // Assuming req.user.id is set after authentication
    const jobRole = req.user.role;
    console.log("Fetching details for Officer ID:", officerId, jobRole);

    if (!officerId) {
      return res.status(400).json({ status: "error", message: "Officer ID is required" });
    }

    const officerDetails = await userAuthDao.getOfficerDetailsById(officerId, jobRole);

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

exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await userAuthDao.getUserDetailsById(userId);

    res.status(200).json({
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName,
      regcode: user.regcode,
      jobRole: user.jobRole,
      nicNumber: user.nicNumber,
      address: user.address,
      phoneNumber: user.phoneNumber,
      empid: user.empid,
    });
  } catch (error) {
    console.error("Error in getUserDetails controller:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updatePhoneNumber = async (req, res) => {
  const userId = req.user.id; // Assuming req.user is set by your authentication middleware
  const { phoneNumber, phoneNumber2 } = req.body;

  console.log("Updating phone number ", phoneNumber, phoneNumber2);

  const validatePhoneNumber = (number) =>
    number && typeof number === "string" && number.length === 9;


  // Ensure at least one phone number is valid
  if (!validatePhoneNumber(phoneNumber) && !validatePhoneNumber(phoneNumber2)) {
    return res.status(400).json({
      message: "Invalid phone numbers. At least one valid 11-character phone number is required.",
    });
  }

  try {
    const results = await userAuthDao.updatePhoneNumberById(
      userId,
      phoneNumber,
      phoneNumber2
    );
    console.log("Results:", results);

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Phone number updated successfully" });
  } catch (error) {
    console.error("Error updating phone number:", error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the phone number" });
  }
};

exports.getOfficerQRCode = async (req, res) => {
  const officerId = req.user.id;

  try {
    const results = await userAuthDao.getQRCodeByOfficerId(officerId);

    if (results.length === 0) {
      return res.status(404).json({ error: "Officer not found" });
    }

    const { QRcode } = results[0];
    if (!QRcode) {
      return res
        .status(404)
        .json({ error: "QR code not available for this officer" });
    }

    // Convert QRcode binary data to base64
    const qrCodeBase64 = QRcode.toString("base64");

    res.status(200).json({
      message: "Officer QR code retrieved successfully",
      QRcode: `data:image/png;base64,${qrCodeBase64}`, // Return as a base64-encoded image
    });
  } catch (error) {
    console.error("Error fetching officer QR code:", error.message);
    res.status(500).json({ error: "Failed to fetch officer QR code" });
  }
};


//claim status for the collection officer

exports.GetClaimStatus = async (req, res) => {
  const { id: userId } = req.user; // Extract userId from the authenticated user

  try {
    if (!userId) {
      return res.status(400).json({ error: 'User ID is missing.' });
    }

    const claimStatus = await userAuthDao.getClaimStatusByUserId(userId);

    if (claimStatus === null) {
      return res.status(404).json({ error: 'User not found or claim status unavailable.' });
    }

    res.status(200).json({ userId, claimStatus });
  } catch (error) {
    console.error('Error fetching claim status:', error);
    res.status(500).json({ error: 'An error occurred while fetching claim status.' });
  }
};

exports.updateOnlineStatus = async (req, res) => {
  try {
    const { empId, status } = req.body;
    const result = await userAuthDao.updateOnlineStatusWithSocket(empId, status);

    // Check if the update was successful
    if (result === null) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ message: 'Officer status updated successfully.' });

  } catch (error) {
    console.error('Error updating online status:', error);
    res.status(500).json({ error: 'An error occurred while updating online status.' });
  }
};


// exports.updateOnlineStatusTest = async (req, res) => {
//   const { status } = req.body;  // Get the status from the request body

//   console.log('Status:', status);

//   if (typeof status !== 'boolean') {
//     return res.status(400).json({ error: 'Status must be a boolean value.' });
//   }

//   // Assuming req.user contains the user data after successful authentication
//   const userId = req.user.id;  // Get userId from req.user (authenticated user)

//   if (!userId) {
//     return res.status(401).json({ error: 'User not authenticated' });
//   }

//   try {
//     // Update the online status in the database
//     const result = await userAuthDao.updateOnlineStatus(status, userId);

//     if (result.affectedRows > 0) {
//       return res.status(200).json({ message: 'User status updated successfully.' });
//     } else {
//       return res.status(404).json({ error: 'User not found' });
//     }
//   } catch (error) {
//     console.error('Error updating online status:', error);
//     return res.status(500).json({ error: 'Failed to update online status' });
//   }
// };

exports.uploadProfileImage = async (req, res) => {
  console.log("hitttt")
  try {
    const userId = req.user.id;

    const existingProfileImage = await userAuthDao.getUserProfileImage(userId);
    if (existingProfileImage) {
      delectfilesOnS3(existingProfileImage);
    }

    let profileImageUrl = null;

    if (req.file) {
      const fileName = req.file.originalname;
      const imageBuffer = req.file.buffer;

      const uploadedImage = await uploadFileToS3(imageBuffer, fileName, "collectionofficer/image");
      profileImageUrl = uploadedImage;
    } else {
    }
    await userAuthDao.updateUserProfileImage(userId, profileImageUrl);

    res.status(200).json({
      status: "success",
      message: "Profile image uploaded successfully",
      profileImageUrl,
    });
  } catch (err) {
    console.error("Error uploading profile image:", err);

    if (err.isJoi) {
      return res.status(400).json({
        status: "error",
        message: err.details[0].message,
      });
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
};


exports.getPassword = async (req, res) => {
  const id = req.user.id;

  try {
    const user = await userAuthDao.getPassword(id);
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};