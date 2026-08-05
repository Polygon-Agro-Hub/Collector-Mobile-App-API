const dao = require("../dao/purchase-shortage-dao");
const uploadFileToS3 = require("../middleware/s3upload");

function convertBase64ToBuffer(base64String) {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

exports.getOfficerShortages = async (req, res) => {
  try {
    const officerId = req.user?.id || 232;
    const data = await dao.getShortagesForOfficer(officerId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getOfficerShortages:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shortage assignments",
      error: error.message,
    });
  }
};

exports.submitPurchase = async (req, res) => {
  try {
    const { srtAssignId, prchQty, prchPrice, slip, reqStatus } = req.body;

    if (!srtAssignId) {
      return res.status(400).json({
        success: false,
        message: "srtAssignId is required",
      });
    }

    if (!prchQty || !prchPrice) {
      return res.status(400).json({
        success: false,
        message: "prchQty and prchPrice are required",
      });
    }

    let slipUrl = slip;
    if (slip && (slip.startsWith("data:image") || slip.length > 500)) {
      try {
        const fileBuffer = convertBase64ToBuffer(slip);
        const fileName = `slip_${Date.now()}.jpg`;
        slipUrl = await uploadFileToS3(
          fileBuffer,
          fileName,
          "shortagepurchase/slips"
        );
      } catch (uploadError) {
        console.error("Error uploading photo slip to R2 bucket:", uploadError);
      }
    }

    await dao.submitShortagePurchase({
      srtAssignId,
      prchQty,
      prchPrice,
      slip: slipUrl,
      reqStatus: reqStatus || "Pending",
    });

    return res.status(200).json({
      success: true,
      message: "Purchase recorded successfully",
      slipUrl,
    });
  } catch (error) {
    console.error("Error in submitPurchase:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to submit purchase",
      error: error.message,
    });
  }
};
