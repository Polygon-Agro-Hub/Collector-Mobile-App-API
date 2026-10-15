const jwt = require("jsonwebtoken");

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

    // Check account status directly from token payload
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
        accountStatus: rawStatus || "not approved",
        statusType: "not_approved",
      });
    }

    req.user = decoded;
    next();
  });
};

module.exports = auth;


