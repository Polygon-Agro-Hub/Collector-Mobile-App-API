const jwt = require("jsonwebtoken");
const userAuthDao = require("../dao/common/user-auth-dao");

/**
 * auth — JWT verification + live account status check with short-lived TTL cache.
 *
 * Flow:
 *  1. Extract & verify JWT signature.
 *  2. Check in-process TTL cache for this officer's status (max 30s stale).
 *  3. On cache miss → query DB live.
 *  4. Reject if rejected / banned / not approved / not found.
 *  5. Only allow through if status is explicitly "approved".
 *  6. On DB error → fail closed (503). Never fall back to token status.
 *
 * Cache TTL = 15 minutes:
 *  - Significantly reduces DB queries for active officers across operations.
 *  - Zero external dependencies — plain JS Map, cleared on process restart.
 */

// ── Status TTL cache ──────────────────────────────────────────────────────────
const STATUS_TTL_MS = 15 * 60 * 1000; // 15 minutes
const _statusCache = new Map(); // key: officer id (string) → { status, jobRole, expiresAt }

function _getCached(id) {
  const key = String(id);
  const entry = _statusCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry;
  _statusCache.delete(key); // expired — remove it
  return null;
}

function _setCache(id, officer) {
  const key = String(id);
  _statusCache.set(key, {
    status: officer.status,
    jobRole: officer.jobRole,
    expiresAt: Date.now() + STATUS_TTL_MS,
  });
}

/**
 * Call this when an admin rejects/bans a user so the next request
 * immediately gets a fresh DB check instead of waiting for TTL expiry.
 */
const clearOfficerStatusCache = (id) => {
  if (id) {
    _statusCache.delete(String(id));
  } else {
    _statusCache.clear();
  }
};

// ── Auth middleware ───────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "No token provided",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
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

    // ── Cache lookup then DB fallback ─────────────────────────────────────
    let officer = _getCached(decoded.id);

    if (!officer) {
      try {
        officer = await userAuthDao.getOfficerStatusById(decoded.id);
        if (officer) _setCache(decoded.id, officer);
      } catch (dbError) {
        // Fail closed — never let a DB error silently pass a user through.
        console.error("[Auth] DB status check failed:", dbError?.message || dbError);
        return res.status(503).json({
          status: "error",
          message: "Service temporarily unavailable. Please try again.",
        });
      }
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
      clearOfficerStatusCache(decoded.id); // force fresh check next time
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

// Default export stays as the middleware function — backward compatible with all route files.
// clearOfficerStatusCache is attached as a property for use in other modules.
auth.clearCache = clearOfficerStatusCache;
module.exports = auth;
