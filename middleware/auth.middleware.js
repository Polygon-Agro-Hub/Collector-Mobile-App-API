const jwt = require("jsonwebtoken");
const db = require("../startup/database");
const officerStatusCache = require("../services/officer-status-cache");
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

    // 1. In-memory cache check: fast-reject if officer is known to be rejected or not approved
    if (officerStatusCache.isRejected(officerId)) {
      return res.status(403).json({
        status: "error",
        message: "This account is rejected.",
        accountStatus: "Rejected",
        statusType: "rejected",
      });
    }

    if (officerStatusCache.isNotApproved(officerId)) {
      return res.status(403).json({
        status: "error",
        message: "This account is not approved.",
        accountStatus: "not approved",
        statusType: "not_approved",
      });
    }

    // 2. Fast-approve if verified in cache
    if (officerStatusCache.isApproved(officerId)) {
      req.user = decoded;
      return next();
    }

    // 3. Cache miss: verify account status in the database and update cache
    db.collectionofficer.query(
      "SELECT status FROM collectionofficer WHERE id = ?",
      [officerId],
      (dbErr, results) => {
        if (dbErr) {
          console.error("Database query error in auth middleware:", dbErr);
          // Fail-safe: if DB connection drops/times out but JWT is verified & marked Approved, allow request to proceed
          if ((decoded.accountStatus || "").trim().toLowerCase() === "approved") {
            req.user = decoded;
            return next();
          }
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

        const rawStatus = results[0].status || "";
        const normalizedStatus = rawStatus.trim().toLowerCase();

        // Update in-memory cache with normalized status
        officerStatusCache.setOfficerStatus(
          officerId,
          normalizedStatus === "approved" ? "Approved" : rawStatus.trim()
        );

        if (normalizedStatus !== "approved") {
          const io = req.app?.get("io");
          if (io) {
            io.to(`user_${officerId}`).emit("officer_status_changed", {
              accountStatus: rawStatus,
              message: `This account is ${rawStatus || "not approved"}.`,
            });
          }

          return res.status(403).json({
            status: "error",
            message: `This account is ${rawStatus || "not approved"}.`,
            accountStatus: rawStatus,
          });
        }

        req.user = decoded;
        next();
      }
    );
  });
};

module.exports = auth;

