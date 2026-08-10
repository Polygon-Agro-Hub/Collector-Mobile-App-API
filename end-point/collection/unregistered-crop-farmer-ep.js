const cropDetailsDao = require("../../dao/collection/unregistered-crop-farmer-dao");
const { collectionofficer } = require("../../startup/database");
const { cropDetailsSchema } = require("../../validation/crop-validations");
const s3middleware = require("../../middleware/s3upload");

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




