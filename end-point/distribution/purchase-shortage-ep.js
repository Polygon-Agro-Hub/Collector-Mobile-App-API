const dao = require("../../dao/distribution/purchase-shortage-dao");
const uploadFileToS3 = require("../../middleware/s3upload");

function parseBase64File(base64String) {
  let ext = "jpg";
  const mimeMatch = base64String.match(/^data:([^;]+);base64,/i);
  if (mimeMatch) {
    const mime = mimeMatch[1].toLowerCase();
    if (mime.includes("pdf")) ext = "pdf";
    else if (mime.includes("png")) ext = "png";
    else if (mime.includes("webp")) ext = "webp";
    else if (mime.includes("gif")) ext = "gif";
    else if (mime.includes("heic")) ext = "heic";
    else if (mime.includes("heif")) ext = "heif";
    else if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
  }
  const cleanData = base64String.replace(/^data:[^;]+;base64,/i, "");
  const buffer = Buffer.from(cleanData, "base64");
  return { ext, buffer };
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
    if (
      slip &&
      (slip.startsWith("data:") ||
        slip.startsWith("data:image") ||
        slip.startsWith("data:application/pdf") ||
        slip.length > 500)
    ) {
      try {
        const { ext, buffer } = parseBase64File(slip);
        const fileName = `slip_${Date.now()}.${ext}`;
        slipUrl = await uploadFileToS3(
          buffer,
          fileName,
          "shortagepurchase/slips"
        );
      } catch (uploadError) {
        console.error("Error uploading photo/pdf slip to R2 bucket:", uploadError);
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
