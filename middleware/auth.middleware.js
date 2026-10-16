const jwt = require("jsonwebtoken");
const userAuthDao = require("../dao/common/user-auth-dao");

/**
 * auth — JWT verification + live account status check.
 *
 * Flow:
 *  1. Extract & verify JWT signature.
 *  2. Query DB for the officer's current status (live — not from token).
 *  3. Reject if rejected / banned / not approved / not found.
 *  4. Only allow through if status is explicitly "approved".
 *  5. On any DB error → fail closed (503). Never fall back to token status.
 */
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
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired token",
      });
    }

    if (!decoded?.id) {
      return res.status(401).json({
        status: "error",
        message: "Token is missing officer ID",
      });
    }

    // ── Live DB status check ──────────────────────────────────────────────
    let officer;
    try {
      officer = await userAuthDao.getOfficerStatusById(decoded.id);
    } catch (dbError) {
      // Fail closed — never let a DB error silently pass a user through.
      console.error("[Auth] DB status check failed:", dbError?.message || dbError);
      return res.status(503).json({
        status: "error",
        message: "Service temporarily unavailable. Please try again.",
      });
    }

    if (!officer) {
      return res.status(401).json({
        status: "error",
        message: "Account not found",
        statusType: "not_found",
      });
    }

    const normalizedStatus = (officer.status || "").trim().toLowerCase();

    // ── Rejected / Banned ─────────────────────────────────────────────────
    if (normalizedStatus === "rejected" || normalizedStatus === "banned") {
      return res.status(403).json({
        status: "error",
        message: "This account has been rejected.",
        accountStatus: "Rejected",
        statusType: "rejected",
      });
    }

    // ── Not Approved (any status that is not exactly "approved") ──────────
    if (normalizedStatus !== "approved") {
      return res.status(403).json({
        status: "error",
        message: `This account is not approved (status: ${officer.status || "unknown"}).`,
        accountStatus: officer.status || "Not Approved",
        statusType: "not_approved",
      });
    }

    // ── Approved — populate req.user with fresh DB values ─────────────────
    req.user = {
      ...decoded,
      status: officer.status,
      accountStatus: officer.status,
      jobRole: officer.jobRole || decoded.jobRole || decoded.role,
      role: officer.jobRole || decoded.role,
    };

    next();
  });
};

module.exports = auth;
