const jwt = require("jsonwebtoken");
const cropDetailsDao = require('../dao/unRegisteredCropFarmer-dao');
const { collectionofficer } = require('../startup/database');
const { cropDetailsSchema } = require('../Validations/crop-validations');
const s3middleware = require('../Middlewares/s3upload');
const asyncHandler = require('express-async-handler');



exports.addCropDetails = async (req, res) => {
  console.log("Request body:", req.body);
  const { crops, farmerId, invoiceNumber } = req.body;
  console.log('invoiceNumber:', invoiceNumber);
  const userId = req.user.id;

  // Step 1: Validate the request body using Joi
  const { error } = cropDetailsSchema.validate(req.body);

  if (error) {
    // Log the full Joi error details for debugging
    console.error('Joi Validation Error:', error.details);

    // Send a detailed error response with the first validation error message
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message,  // Send only the first error message
      details: error.details              // Optionally include all error details in the response
    });
  }

  // Get a connection from the pool
  const connection = await collectionofficer.promise().getConnection();

  try {
    // Step 2: Start a transaction
    await connection.beginTransaction();

    // Step 3: Insert registered farmer payment
    const registeredFarmerId = await cropDetailsDao.insertFarmerPayment(farmerId, userId, invoiceNumber);

    // Step 4: Process and insert crop details with S3 image uploads
    const cropPromises = crops.map(async (crop) => {
      // Process image if provided in base64 format
      let imageAUrl = null, imageBUrl = null, imageCUrl = null;

      // Upload image for grade A
      if (crop.imageA) {
        try {
          const fileBufferA = Buffer.from(crop.imageA, 'base64');
          const fileNameA = `crop_${Date.now()}_${Math.floor(Math.random() * 1000)}_A.jpg`;
          imageAUrl = await s3middleware(fileBufferA, fileNameA, "crops-collection/images");
        } catch (uploadError) {
          console.error('Error uploading image A to S3:', uploadError);
          throw uploadError;
        }
      }

      // Upload image for grade B
      if (crop.imageB) {
        try {
          const fileBufferB = Buffer.from(crop.imageB, 'base64');
          const fileNameB = `crop_${Date.now()}_${Math.floor(Math.random() * 1000)}_B.jpg`;
          imageBUrl = await s3middleware(fileBufferB, fileNameB, "crops-collection/images");
        } catch (uploadError) {
          console.error('Error uploading image B to S3:', uploadError);
          throw uploadError;
        }
      }

      // Upload image for grade C
      if (crop.imageC) {
        try {
          const fileBufferC = Buffer.from(crop.imageC, 'base64');
          const fileNameC = `crop_${Date.now()}_${Math.floor(Math.random() * 1000)}_C.jpg`;
          imageCUrl = await s3middleware(fileBufferC, fileNameC, "crops-collection/images");
        } catch (uploadError) {
          console.error('Error uploading image C to S3:', uploadError);
          throw uploadError;
        }
      }

      // Update the crop object with the S3 image URL
      const cropWithImageUrls = {
        ...crop,
        imageAUrl,
        imageBUrl,
        imageCUrl
      }; const officerId = userId;
      const centerId = req.user.centerId;
      return cropDetailsDao.insertCropDetails(registeredFarmerId, cropWithImageUrls, officerId, centerId);
    });

    await Promise.all(cropPromises);

    // Step 5: Commit the transaction
    await connection.commit();

    // Return success response
    res.status(201).json({
      message: 'Crop payment records added successfully',
      registeredFarmerId
    });
  } catch (err) {
    console.error('Error processing request:', err);

    // Rollback the transaction if an error occurs
    await connection.rollback();

    // Return error response
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    // Release the connection back to the pool
    connection.release();
  }
};




exports.addCropDetails2 = async (req, res) => {
  console.log("Request body:", req.body.crops);
  const { crops, farmerId, invoiceNumber } = req.body;
  console.log('invoiceNumber:', invoiceNumber);
  const userId = req.user.id;

  if (!crops || typeof crops !== 'object') {
    return res.status(400).json({ error: 'Crops data is required and must be an object' });
  }

  try {
    // Process image if provided
    let imageAUrl = null;
    let imageBUrl = null;
    let imageCUrl = null;

    // Handle image uploads for grade A, B, and C if provided
    if (crops.imageA) {
      try {
        const fileBufferA = Buffer.from(crops.imageA, 'base64');
        const fileNameA = `crop_A_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        imageAUrl = await s3middleware(fileBufferA, fileNameA, "crops-collection/images");
      } catch (uploadError) {
        console.error('Error uploading image A to S3:', uploadError);
        throw uploadError;
      }
    }

    if (crops.imageB) {
      try {
        const fileBufferB = Buffer.from(crops.imageB, 'base64');
        const fileNameB = `crop_B_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        imageBUrl = await s3middleware(fileBufferB, fileNameB, "crops-collection/images");
      } catch (uploadError) {
        console.error('Error uploading image B to S3:', uploadError);
        throw uploadError;
      }
    }

    if (crops.imageC) {
      try {
        const fileBufferC = Buffer.from(crops.imageC, 'base64');
        const fileNameC = `crop_C_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        imageCUrl = await s3middleware(fileBufferC, fileNameC, "crops-collection/images");
      } catch (uploadError) {
        console.error('Error uploading image C to S3:', uploadError);
        throw uploadError;
      }
    }

    // Update the crop object with the S3 image URLs
    const cropsWithImageUrls = {
      ...crops,
      imageAUrl,
      imageBUrl,
      imageCUrl
    };

    const registeredFarmerId = await cropDetailsDao.insertFarmerPayment(farmerId, userId, invoiceNumber);
    const officerId = userId;
    const centerId = req.user.centerId;
    await cropDetailsDao.insertCropDetails(registeredFarmerId, cropsWithImageUrls, officerId, centerId);

    res.status(201).json({
      message: 'Crop payment records added successfully',
      registeredFarmerId
    });
  } catch (err) {
    console.error('Error processing request:', err);

    if (err.message === "Validation error") {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: 'Internal Server Error' });
  }
};




exports.getCropDetailsByUserId = async (req, res) => {
  try {
    const { userId, registeredFarmerId } = req.params;

    console.log('------------------userId:', userId);
    console.log('------registeredFarmerId:', registeredFarmerId);

    // Validate parameters
    if (!userId || !registeredFarmerId) {
      return res.status(400).json({
        status: 'error',
        message: 'Both userId and registeredFarmerId are required'
      });
    }

    // Call the DAO function
    const cropDetails = await cropDetailsDao.getCropDetailsByUserAndFarmerId(userId, registeredFarmerId);

    res.status(200).json({
      status: 'success',
      data: cropDetails
    });

    console.log('----------Final Crop details:', cropDetails);

  } catch (error) {
    console.error('Error fetching crop details:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch crop details',
      error: error.message
    });
  }
};



exports.getAllCropNames = async (req, res) => {
  console.log('Fetching crop names for today');
  try {
    const officerId = req.user.id;

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Use today as both start and end date if no date parameters are provided
    const startDate = req.query.startDate || today;
    const endDate = req.query.endDate || today;

    console.log('Query parameters:', {
      officerId,
      startDate,
      endDate
    });

    const cropNames = await cropDetailsDao.getAllCropNames(officerId, startDate, endDate);
    res.status(200).json(cropNames);
  } catch (error) {
    console.error('Error fetching crop names:', error);
    res.status(500).json({ error: 'Failed to retrieve crop names' });
  }
};



exports.getAllCropNamesForCollection = async (req, res) => {
  console.log('Fetching all crop names');
  try {
    const cropNames = await cropDetailsDao.getAllCropNamesForCollection();
    res.status(200).json(cropNames);  // Sending the response as JSON
  } catch (error) {
    console.error('Error fetching crop names:', error);
    res.status(500).json({ error: 'Failed to retrieve crop names' });
  }
};

// exports.getVarietiesByCropId = async (req, res) => {
//   const cropId = req.params.id;  // Extract cropId from request parameters
//   console.log(cropId);
//   const officerId = req.user.id;


//   try {
//     const varieties = await cropDetailsDao.getVarietiesByCropId(officerId, cropId);
//     res.status(200).json(varieties);  // Return the varieties as JSON
//   } catch (error) {
//     console.error('Error fetching crop varieties:', error);  // Log the error for debugging
//     res.status(500).json({ error: 'Failed to retrieve crop varieties' });
//   }
// };

exports.getVarietiesByCropId = async (req, res) => {
  const cropId = req.params.id;
  const officerId = req.user.id;

  // Get today's date or use query parameters (same as getAllCropNames)
  const today = new Date().toISOString().split('T')[0];
  const startDate = req.query.startDate || today;
  const endDate = req.query.endDate || today;

  console.log('Query parameters:', {
    officerId,
    cropId,
    startDate,
    endDate
  });

  try {
    const varieties = await cropDetailsDao.getVarietiesByCropId(officerId, cropId, startDate, endDate);
    res.status(200).json(varieties);
  } catch (error) {
    console.error('Error fetching crop varieties:', error);
    res.status(500).json({ error: 'Failed to retrieve crop varieties' });
  }
};

exports.getUnitPricesByCropId = async (req, res) => {
  const { cropId } = req.params; // Extract cropId from the URL parameters
  const companycenterId = req.user.companycenterId
  console.log("company center id", companycenterId)

  try {
    console.log("Received cropId:", cropId); // Log for debugging, consider replacing in production with a proper logger

    // Fetch market prices by varietyId (cropId)
    const prices = await cropDetailsDao.getMarketPricesByVarietyId(cropId, companycenterId);

    if (prices.length === 0) {
      return res.status(404).json({ message: 'No market prices found for the specified cropId' });
    }

    // Return the market prices as a JSON response
    res.status(200).json(prices);
  } catch (error) {
    console.error("Error retrieving market prices:", error);  // Log the error
    res.status(500).json({ error: 'Failed to retrieve market prices' });
  }
};




exports.getLatestInvoiceNumber = async (req, res) => {
  try {
    const { empId, currentDate } = req.params;

    // Fetch the latest invoice number for this employee and date
    const latestInvoice = await cropDetailsDao.getLatestInvoiceNumberDao(empId, currentDate);

    let newSequenceNumber = '00001'; // Default to 00001 if no invoice number exists

    if (latestInvoice && latestInvoice.invNo) {
      // Extract the last sequence number from the invoice (last 5 digits)
      const lastInvoiceNumber = latestInvoice.invNo;
      const lastSequence = parseInt(lastInvoiceNumber.slice(-5), 10); // Last 5 digits for sequence
      newSequenceNumber = String(lastSequence + 1).padStart(5, '0'); // Increment and pad to 5 digits
    }

    // Check if it's a new day and reset the sequence number if necessary
    const currentDateFromInvoice = latestInvoice ? latestInvoice.invNo.slice(empId.length, empId.length + 6) : null;

    // If the current date does not match the invoice's date, reset the sequence to '00001'
    if (currentDate !== currentDateFromInvoice) {
      newSequenceNumber = '00001';
    }

    // Generate the new invoice number
    const invoiceNumber = `${empId}${currentDate}${newSequenceNumber}`;
    console.log('Generated Invoice Number:', invoiceNumber);

    // Respond with the newly generated invoice number
    res.status(200).json({ invoiceNumber });
  } catch (error) {
    console.error('Error generating invoice number:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};






//Collection

exports.getaddCollection = async (req, res) => {
  const { crop, variety, loadIn, routeNumber, buildingNo, streetName, city } = req.body;

  // Validation: Ensure all fields are provided
  if (!crop || !variety || !loadIn || !routeNumber || !buildingNo || !streetName || !city) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const collectionResult = await cropDetailsDao.createCollection(
      crop,
      variety,
      loadIn,
      routeNumber,
      buildingNo,
      streetName,
      city
    );

    return res.status(201).json({
      message: "Collection request submitted successfully",
      data: collectionResult,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Duplicate entry error: " + error.message });
    }
    console.error("Error during collection request submission:", error);
    return res.status(500).json({ error: "An unexpected error occurred: " + error.message });
  }
};

exports.getAllCropNameId = async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const officerId = req.user.id;
    const cropNames = await cropDetailsDao.getAllCropNames(officerId);

    // If no crop names found, return appropriate response
    if (!cropNames || cropNames.length === 0) {
      return res.status(404).json({ message: 'No crop names found' });
    }

    res.status(200).json(cropNames);
  } catch (error) {
    console.error('Error fetching crop names:', error);
    res.status(500).json({ error: 'Failed to retrieve crop names' });
  }
};



exports.getVarietiesByCropIdCollection = async (req, res) => {
  const cropId = req.params.id;
  const officerId = req.user.id;

  console.log('Received Request Details:', {
    cropId: cropId,
    officerId: officerId
  });

  try {
    // Validate inputs
    if (!officerId) {
      console.error('No Officer ID provided');
      return res.status(401).json({ error: 'Unauthorized: Officer ID is required' });
    }

    if (!cropId) {
      console.error('No Crop ID provided');
      return res.status(400).json({ error: 'Crop ID is required' });
    }

    // Debug: Log before calling DAO method
    console.log('Attempting to fetch varieties for cropId:', cropId);

    const varieties = await cropDetailsDao.getVarietiesByCropIdCollection(officerId, cropId);

    // Debug: Log results
    console.log('Varieties Fetched:', varieties);

    // If no varieties found, return appropriate response
    if (!varieties || varieties.length === 0) {
      console.warn('No varieties found for crop ID:', cropId);
      return res.status(404).json({ message: 'No varieties found for this crop' });
    }

    res.status(200).json(varieties);
  } catch (error) {
    // Comprehensive error logging
    console.error('Full Error Details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    // Log any SQL-specific errors
    if (error.sqlMessage) {
      console.error('SQL Error:', error.sqlMessage);
    }

    res.status(500).json({
      error: 'Failed to retrieve crop varieties',
      details: error.message
    });
  }
};






exports.getAllUsers = async (req, res) => {
  try {
    // Extract officerId from authenticated user
    const officerId = req.user.id;

    // Get NIC number from query parameters
    const { nicNumber } = req.query;

    // Log the request for debugging
    console.log('Fetching farmers for officer ID:', officerId, 'NIC Number:', nicNumber);

    // Fetch users, optionally filtered by NIC number
    const users = await cropDetailsDao.getAllUsers(officerId, nicNumber);

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No farmers found' });
    }

    // Send successful response
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching farmers:', error);
    res.status(500).json({
      error: 'Failed to retrieve farmers',
      details: error.message
    });
  }
};






exports.updateUserAddress = async (req, res) => {
  const { userId } = req.params;
  const { routeNumber, buildingNo, streetName, city } = req.body;

  // Only check required fields, allow routeNumber to be null or empty
  if (!buildingNo || !streetName || !city) {
    return res.status(400).json({ error: 'Building number, street name, and city are required' });
  }

  try {
    // Pass routeNumber as is (can be undefined, null, or empty string)
    await cropDetailsDao.updateUserAddress(userId, routeNumber, buildingNo, streetName, city);
    res.status(200).json({ message: 'User address updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};




exports.submitCollectionRequest = async (req, res) => {
  const { requests } = req.body;
  console.log("req body", req.body)


  if (!requests || !Array.isArray(requests) || requests.length === 0) {
    return res.status(400).json({ error: 'No collection requests provided' });
  }

  try {
    const invalidRequests = requests.filter(
      request => !request.farmerId || !request.crop ||
        !request.variety || !request.loadIn
    );

    if (invalidRequests.length > 0) {
      return res.status(400).json({
        error: 'Some requests are missing required fields',
        invalidRequests
      });
    }

    const centerId = req.user.centerId;
    const companyId = req.user.companyId;
    const cmId = req.user.id;
    const empId = req.user.empId;
    const insertedRequestDetails = [];

    console.log("User empId:", empId);


    for (const request of requests) {
      const { farmerId, buildingNo, streetName, city, routeNumber } = request;

      // Update address for each request
      try {
        const updateAddress = await cropDetailsDao.updateUserAddress(
          farmerId,
          routeNumber,
          buildingNo,
          streetName,
          city
        );

        if (!updateAddress) {
          return res.status(400).json({ error: 'Failed to update farmer address' });
        }
        console.log(`Address updated successfully for farmerId ${farmerId}`);
      } catch (error) {
        console.error("Error updating farmer address:", error);
        return res.status(500).json({ error: 'Failed to update farmer address' });
      }
      // Ensure we get an existing or new request ID
      const collectionRequestResult = await cropDetailsDao.createCollectionRequest(
        request.farmerId, cmId, empId, request.crop, request.variety,
        request.loadIn, centerId, companyId, request.scheduleDate
      );

      // Extract the request ID - handle both new and existing requests
      const requestId = collectionRequestResult.requestIdItem || collectionRequestResult.requestId;

      // Log for debugging
      console.log("Using requestId:", requestId);

      // Insert items using the obtained requestId
      await cropDetailsDao.createCollectionRequestItems(
        requestId, request.crop, request.variety, request.loadIn
      );

      insertedRequestDetails.push({
        requestId,
        farmerId: request.farmerId,
        crop: request.crop
      });
    }

    res.status(200).json({
      message: 'Collection requests submitted successfully',
      requestDetails: insertedRequestDetails
    });
  } catch (error) {
    console.error('Error submitting collection requests:', error);
    res.status(500).json({ error: error.message });
  }
};




