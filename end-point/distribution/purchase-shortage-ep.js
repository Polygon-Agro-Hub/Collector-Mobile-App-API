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

  if (!mimeMatch && buffer.length >= 4) {
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      ext = "pdf";
    } else if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      ext = "png";
    } else if (
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      ext = "jpg";
    } else if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46
    ) {
      ext = "gif";
    } else if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    ) {
      ext = "webp";
    }
  }

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

    let slipUrl = null;

    if (req.file) {
      try {
        slipUrl = await uploadFileToS3(
          req.file.buffer,
          req.file.originalname,
          "shortagepurchase/slips"
        );
      } catch (uploadError) {
        console.error("Error uploading file slip to R2 bucket:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload slip file to storage",
          error: uploadError.message,
        });
      }
    } else if (slip) {
      if (slip.startsWith("http://") || slip.startsWith("https://")) {
        slipUrl = slip;
      } else if (
        slip.startsWith("data:") ||
        slip.length > 50
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
          return res.status(500).json({
            success: false,
            message: "Failed to upload slip file to storage",
            error: uploadError.message,
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid slip format. Please upload a valid image or PDF file.",
        });
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
