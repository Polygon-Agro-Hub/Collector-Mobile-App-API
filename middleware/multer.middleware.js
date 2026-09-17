const multer = require("multer");
const path = require("path");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimetypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "application/pdf",
    ];
    const filetypes = /jpeg|jpg|png|pdf|heic|heif|webp/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedMimetypes.includes(file.mimetype.toLowerCase());

    // Accept if mimetype OR extname matches (handles Android DocumentPicker
    // which may give a mismatched extension for cache files)
    if (mimetype || extname) {
      return cb(null, true);
    } else {
      return cb(new Error("Only images (JPEG, PNG, HEIC, HEIF, WEBP) and PDFs are allowed"));
    }
  },
});

module.exports = upload;