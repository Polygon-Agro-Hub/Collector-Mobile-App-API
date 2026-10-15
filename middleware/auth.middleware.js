const jwt = require("jsonwebtoken");
const userAuthDao = require("../dao/common/user-auth-dao");

const auth = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "No token provided",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || "T1", async (err, decoded) => {
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

    try {
      // Live database status check via DAO layer
      const officer = await userAuthDao.getOfficerStatusById(decoded.id);

      if (!officer) {
        return res.status(401).json({
          status: "error",
          message: "User account no longer exists",
          statusType: "not_found",
        });
      }

      const rawStatus = (officer.status || "").trim();
      const normalizedStatus = rawStatus.toLowerCase();

      if (normalizedStatus === "rejected" || normalizedStatus === "banned") {
        return res.status(403).json({
          status: "error",
          message: "This EMP ID is Rejected",
          accountStatus: "Rejected",
          statusType: "rejected",
        });
      }

      if (normalizedStatus && normalizedStatus !== "approved") {
        return res.status(403).json({
          status: "error",
          message: `This account is ${rawStatus || "not approved"}.`,
          accountStatus: rawStatus || "Not Approved",
          statusType: "not_approved",
        });
      }

      // Populate req.user with latest database status & role
      req.user = {
        ...decoded,
        status: officer.status,
        accountStatus: officer.status,
        jobRole: officer.jobRole || decoded.jobRole || decoded.role,
        role: officer.jobRole || decoded.role,
      };

      next();
    } catch (dbError) {
      console.error("Auth middleware live status check error:", dbError?.message || dbError);
      // Fallback: If DB query fails temporarily, fall back to decoded token status
      const rawStatus = (decoded.accountStatus || decoded.status || "").trim();
      const normalizedStatus = rawStatus.toLowerCase();

      if (normalizedStatus === "rejected" || normalizedStatus === "banned") {
        return res.status(403).json({
          status: "error",
          message: "This EMP ID is Rejected",
          accountStatus: "Rejected",
          statusType: "rejected",
        });
      }

      if (normalizedStatus && normalizedStatus !== "approved") {
        return res.status(403).json({
          status: "error",
          message: `This account is ${rawStatus || "not approved"}.`,
          accountStatus: rawStatus || "Not Approved",
          statusType: "not_approved",
        });
      }

      req.user = decoded;
      next();
    }
  });
};

module.exports = auth;


