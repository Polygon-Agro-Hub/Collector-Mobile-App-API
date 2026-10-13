const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const { OFFICER_STATUS } = require("../constants/officer-status");

const auth = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "No token provided",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || "T1", (err, decoded) => {
    if (err) {
      console.error("Token verification error:", err);
      return res.status(401).json({
        status: "error",
        message: "Invalid token",
      });
    }

    if (!decoded.id) {
      return res.status(401).json({
        status: "error",
        message: "Collection officer ID is missing in the token",
      });
    }

    const officerId = decoded.id;

    // Check account status directly from database on every request (no cache)
    db.collectionofficer.query(
      "SELECT status FROM collectionofficer WHERE id = ?",
      [officerId],
      (dbErr, results) => {
        if (dbErr) {
          console.error("Database query error in auth middleware:", dbErr);
          return res.status(500).json({
            status: "error",
            message: "Database error during authentication check",
          });
        }

        if (results.length === 0) {
          return res.status(401).json({
            status: "error",
            message: "User not found",
          });
        }

        const rawStatus = (results[0].status || "").trim();
        const normalizedStatus = rawStatus.toLowerCase();

        if (normalizedStatus === "rejected" || normalizedStatus === "banned") {
          return res.status(403).json({
            status: "error",
            message: "This EMP ID is Rejected",
            accountStatus: "Rejected",
            statusType: "rejected",
          });
        }

        if (normalizedStatus !== "approved") {
          return res.status(403).json({
            status: "error",
            message: `This account is ${rawStatus || "not approved"}.`,
            accountStatus: rawStatus || "not approved",
            statusType: "not_approved",
          });
        }

        req.user = decoded;
        next();
      }
    );
  });
};

module.exports = auth;

