const jwt = require("jsonwebtoken");
const cropDetailsDao = require("../dao/unRegisteredCropFarmer-dao");
const { collectionofficer } = require("../startup/database");
const { cropDetailsSchema } = require("../Validations/crop-validations");
const s3middleware = require("../Middlewares/s3upload");
const asyncHandler = require("express-async-handler");

exports.addCropDetails = async (req, res) => {
  const { crops, farmerId, invoiceNumber } = req.body;

  const userId = req.user.id;

  const { error } = cropDetailsSchema.validate(req.body);

  if (error) {
    console.error("Joi Validation Error:", error.details);

    return res.status(400).json({
      status: "error",
      message: error.details[0].message,
      details: error.details,
    });
  }

  const connection = await collectionofficer.promise().getConnection();

  try {
    await connection.beginTransaction();

    const registeredFarmerId = await cropDetailsDao.insertFarmerPayment(
      farmerId,
      userId,
      invoiceNumber,
    );

    const cropPromises = crops.map(async (crop) => {
      let imageAUrl = null,
        imageBUrl = null,
        imageCUrl = null;

      if (crop.imageA) {
        try {
          const fileBufferA = Buffer.from(crop.imageA, "base64");
          const fileNameA = `crop_${Date.now()}_${Math.floor(Math.random() * 1000)}_A.jpg`;
          imageAUrl = await s3middleware(
            fileBufferA,
            fileNameA,
            "crops-collection/images",
          );
        } catch (uploadError) {
          console.error("Error uploading image A to S3:", uploadError);
          throw uploadError;
        }
      }

      if (crop.imageB) {
        try {
          const fileBufferB = Buffer.from(crop.imageB, "base64");
          const fileNameB = `crop_${Date.now()}_${Math.floor(Math.random() * 1000)}_B.jpg`;
          imageBUrl = await s3middleware(
            fileBufferB,
            fileNameB,
            "crops-collection/images",
          );
        } catch (uploadError) {
          console.error("Error uploading image B to S3:", uploadError);
          throw uploadError;
        }
      }

      if (crop.imageC) {
        try {
          const fileBufferC = Buffer.from(crop.imageC, "base64");
          const fileNameC = `crop_${Date.now()}_${Math.floor(Math.random() * 1000)}_C.jpg`;
          imageCUrl = await s3middleware(
            fileBufferC,
            fileNameC,
            "crops-collection/images",
          );
        } catch (uploadError) {
          console.error("Error uploading image C to S3:", uploadError);
          throw uploadError;
        }
      }

      const cropWithImageUrls = {
        ...crop,
        imageAUrl,
        imageBUrl,
        imageCUrl,
      };
      const officerId = userId;
      const centerId = req.user.centerId;
      return cropDetailsDao.insertCropDetails(
        registeredFarmerId,
        cropWithImageUrls,
        officerId,
        centerId,
      );
    });

    await Promise.all(cropPromises);

    await connection.commit();

    res.status(201).json({
      message: "Crop payment records added successfully",
      registeredFarmerId,
    });
  } catch (err) {
    console.error("Error processing request:", err);

    await connection.rollback();

    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    connection.release();
  }
};

exports.addCropDetails2 = async (req, res) => {
  const { crops, farmerId, invoiceNumber } = req.body;

  const userId = req.user.id;

  if (!crops || typeof crops !== "object") {
    return res
      .status(400)
      .json({ error: "Crops data is required and must be an object" });
  }

  try {
    let imageAUrl = null;
    let imageBUrl = null;
    let imageCUrl = null;

    if (crops.imageA) {
      try {
        const fileBufferA = Buffer.from(crops.imageA, "base64");
        const fileNameA = `crop_A_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        imageAUrl = await s3middleware(
          fileBufferA,
          fileNameA,
          "crops-collection/images",
        );
      } catch (uploadError) {
        console.error("Error uploading image A to S3:", uploadError);
        throw uploadError;
      }
    }

    if (crops.imageB) {
      try {
        const fileBufferB = Buffer.from(crops.imageB, "base64");
        const fileNameB = `crop_B_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        imageBUrl = await s3middleware(
          fileBufferB,
          fileNameB,
          "crops-collection/images",
        );
      } catch (uploadError) {
        console.error("Error uploading image B to S3:", uploadError);
        throw uploadError;
      }
    }

    if (crops.imageC) {
      try {
        const fileBufferC = Buffer.from(crops.imageC, "base64");
        const fileNameC = `crop_C_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        imageCUrl = await s3middleware(
          fileBufferC,
          fileNameC,
          "crops-collection/images",
        );
      } catch (uploadError) {
        console.error("Error uploading image C to S3:", uploadError);
        throw uploadError;
      }
    }

    const cropsWithImageUrls = {
      ...crops,
      imageAUrl,
      imageBUrl,
      imageCUrl,
    };

    const registeredFarmerId = await cropDetailsDao.insertFarmerPayment(
      farmerId,
      userId,
      invoiceNumber,
    );
    const officerId = userId;
    const centerId = req.user.centerId;
    await cropDetailsDao.insertCropDetails(
      registeredFarmerId,
      cropsWithImageUrls,
      officerId,
      centerId,
    );

    res.status(201).json({
      message: "Crop payment records added successfully",
      registeredFarmerId,
    });
  } catch (err) {
    console.error("Error processing request:", err);

    if (err.message === "Validation error") {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getCropDetailsByUserId = async (req, res) => {
  try {
    const { userId, registeredFarmerId } = req.params;

    if (!userId || !registeredFarmerId) {
      return res.status(400).json({
        status: "error",
        message: "Both userId and registeredFarmerId are required",
      });
    }

    const cropDetails = await cropDetailsDao.getCropDetailsByUserAndFarmerId(
      userId,
      registeredFarmerId,
    );

    res.status(200).json({
      status: "success",
      data: cropDetails,
    });
  } catch (error) {
    console.error("Error fetching crop details:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch crop details",
      error: error.message,
    });
  }
};

exports.getAllCropNames = async (req, res) => {
  try {
    const officerId = req.user.id;

    const today = new Date().toISOString().split("T")[0];

    const startDate = req.query.startDate || today;
    const endDate = req.query.endDate || today;

    const cropNames = await cropDetailsDao.getAllCropNames(
      officerId,
      startDate,
      endDate,
    );
    res.status(200).json(cropNames);
  } catch (error) {
    console.error("Error fetching crop names:", error);
    res.status(500).json({ error: "Failed to retrieve crop names" });
  }
};

exports.getAllCropNamesForCollection = async (req, res) => {
  try {
    const cropNames = await cropDetailsDao.getAllCropNamesForCollection();
    res.status(200).json(cropNames);
  } catch (error) {
    console.error("Error fetching crop names:", error);
    res.status(500).json({ error: "Failed to retrieve crop names" });
  }
};

exports.getVarietiesByCropId = async (req, res) => {
  const cropId = req.params.id;
  const officerId = req.user.id;

  const today = new Date().toISOString().split("T")[0];
  const startDate = req.query.startDate || today;
  const endDate = req.query.endDate || today;

  try {
    const varieties = await cropDetailsDao.getVarietiesByCropId(
      officerId,
      cropId,
      startDate,
      endDate,
    );
    res.status(200).json(varieties);
  } catch (error) {
    console.error("Error fetching crop varieties:", error);
    res.status(500).json({ error: "Failed to retrieve crop varieties" });
  }
};

exports.getUnitPricesByCropId = async (req, res) => {
  const { cropId } = req.params;
  const companycenterId = req.user.companycenterId;

  try {
    const prices = await cropDetailsDao.getMarketPricesByVarietyId(
      cropId,
      companycenterId,
    );

    if (prices.length === 0) {
      return res
        .status(404)
        .json({ message: "No market prices found for the specified cropId" });
    }

    res.status(200).json(prices);
  } catch (error) {
    console.error("Error retrieving market prices:", error);
    res.status(500).json({ error: "Failed to retrieve market prices" });
  }
};

exports.getLatestInvoiceNumber = async (req, res) => {
  try {
    const { empId, currentDate } = req.params;

    const latestInvoice = await cropDetailsDao.getLatestInvoiceNumberDao(
      empId,
      currentDate,
    );

    let newSequenceNumber = "00001";

    if (latestInvoice && latestInvoice.invNo) {
      const lastInvoiceNumber = latestInvoice.invNo;
      const lastSequence = parseInt(lastInvoiceNumber.slice(-5), 10);
      newSequenceNumber = String(lastSequence + 1).padStart(5, "0");
    }

    const currentDateFromInvoice = latestInvoice
      ? latestInvoice.invNo.slice(empId.length, empId.length + 6)
      : null;

    if (currentDate !== currentDateFromInvoice) {
      newSequenceNumber = "00001";
    }

    const invoiceNumber = `${empId}${currentDate}${newSequenceNumber}`;

    res.status(200).json({ invoiceNumber });
  } catch (error) {
    console.error("Error generating invoice number:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getaddCollection = async (req, res) => {
  const { crop, variety, loadIn, routeNumber, buildingNo, streetName, city } =
    req.body;

  if (
    !crop ||
    !variety ||
    !loadIn ||
    !routeNumber ||
    !buildingNo ||
    !streetName ||
    !city
  ) {
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
      city,
    );

    return res.status(201).json({
      message: "Collection request submitted successfully",
      data: collectionResult,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ error: "Duplicate entry error: " + error.message });
    }
    console.error("Error during collection request submission:", error);
    return res
      .status(500)
      .json({ error: "An unexpected error occurred: " + error.message });
  }
};

exports.getAllCropNameId = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const officerId = req.user.id;
    const cropNames = await cropDetailsDao.getAllCropNames(officerId);

    if (!cropNames || cropNames.length === 0) {
      return res.status(404).json({ message: "No crop names found" });
    }

    res.status(200).json(cropNames);
  } catch (error) {
    console.error("Error fetching crop names:", error);
    res.status(500).json({ error: "Failed to retrieve crop names" });
  }
};

exports.getVarietiesByCropIdCollection = async (req, res) => {
  const cropId = req.params.id;
  const officerId = req.user.id;

  try {
    if (!officerId) {
      console.error("No Officer ID provided");
      return res
        .status(401)
        .json({ error: "Unauthorized: Officer ID is required" });
    }

    if (!cropId) {
      console.error("No Crop ID provided");
      return res.status(400).json({ error: "Crop ID is required" });
    }

    const varieties = await cropDetailsDao.getVarietiesByCropIdCollection(
      officerId,
      cropId,
    );

    if (!varieties || varieties.length === 0) {
      console.warn("No varieties found for crop ID:", cropId);
      return res
        .status(404)
        .json({ message: "No varieties found for this crop" });
    }

    res.status(200).json(varieties);
  } catch (error) {
    console.error("Full Error Details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    if (error.sqlMessage) {
      console.error("SQL Error:", error.sqlMessage);
    }

    res.status(500).json({
      error: "Failed to retrieve crop varieties",
      details: error.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const officerId = req.user.id;

    const { nicNumber } = req.query;

    const users = await cropDetailsDao.getAllUsers(officerId, nicNumber);

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No farmers found" });
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching farmers:", error);
    res.status(500).json({
      error: "Failed to retrieve farmers",
      details: error.message,
    });
  }
};

exports.updateUserAddress = async (req, res) => {
  const { userId } = req.params;
  const { routeNumber, buildingNo, streetName, city } = req.body;

  if (!buildingNo || !streetName || !city) {
    return res
      .status(400)
      .json({ error: "Building number, street name, and city are required" });
  }

  try {
    await cropDetailsDao.updateUserAddress(
      userId,
      routeNumber,
      buildingNo,
      streetName,
      city,
    );
    res.status(200).json({ message: "User address updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.submitCollectionRequest = async (req, res) => {
  const { requests } = req.body;

  if (!requests || !Array.isArray(requests) || requests.length === 0) {
    return res.status(400).json({ error: "No collection requests provided" });
  }

  try {
    const invalidRequests = requests.filter(
      (request) =>
        !request.farmerId ||
        !request.crop ||
        !request.variety ||
        !request.loadIn,
    );

    if (invalidRequests.length > 0) {
      return res.status(400).json({
        error: "Some requests are missing required fields",
        invalidRequests,
      });
    }

    const centerId = req.user.centerId;
    const companyId = req.user.companyId;
    const cmId = req.user.id;
    const empId = req.user.empId;
    const insertedRequestDetails = [];

    for (const request of requests) {
      const { farmerId, buildingNo, streetName, city, routeNumber } = request;

      try {
        const updateAddress = await cropDetailsDao.updateUserAddress(
          farmerId,
          routeNumber,
          buildingNo,
          streetName,
          city,
        );

        if (!updateAddress) {
          return res
            .status(400)
            .json({ error: "Failed to update farmer address" });
        }
      } catch (error) {
        console.error("Error updating farmer address:", error);
        return res
          .status(500)
          .json({ error: "Failed to update farmer address" });
      }

      const collectionRequestResult =
        await cropDetailsDao.createCollectionRequest(
          request.farmerId,
          cmId,
          empId,
          request.crop,
          request.variety,
          request.loadIn,
          centerId,
          companyId,
          request.scheduleDate,
        );

      const requestId =
        collectionRequestResult.requestIdItem ||
        collectionRequestResult.requestId;

      await cropDetailsDao.createCollectionRequestItems(
        requestId,
        request.crop,
        request.variety,
        request.loadIn,
      );

      insertedRequestDetails.push({
        requestId,
        farmerId: request.farmerId,
        crop: request.crop,
      });
    }

    res.status(200).json({
      message: "Collection requests submitted successfully",
      requestDetails: insertedRequestDetails,
    });
  } catch (error) {
    console.error("Error submitting collection requests:", error);
    res.status(500).json({ error: error.message });
  }
};
