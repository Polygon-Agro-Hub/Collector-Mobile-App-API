const cache = require("../cache/cache");
const { collectionofficer } = require("../startup/database");
const { OFFICER_STATUS } = require("../constants/officer-status");

const REJECTED_OFFICERS_KEY = "rejected_officer_ids";
const NOT_APPROVED_OFFICERS_KEY = "not_approved_officer_ids";
const OFFICER_STATUS_PREFIX = "officer_status_";

/**
 * Fetch all disallowed officers (Rejected, Not Approved) from DB and populate in-memory cache.
 * stdTTL: 0 -> persists in memory without expiring until explicitly updated.
 */
const triggerGetRejectOfficers = async () => {
  try {
    const sql = "SELECT id, status FROM collectionofficer WHERE status != 'Approved'";
    
    return new Promise((resolve) => {
      collectionofficer.query(sql, (err, results) => {
        if (err || !results) {
          console.error("[Cache] Error fetching disallowed officers from DB:", err?.message);
          return resolve([]);
        }

        const rejectedIds = [];
        const notApprovedIds = [];

        results.forEach((row) => {
          const id = Number(row.id);
          const raw = (row.status || "").trim();
          const status = raw.toLowerCase() === "rejected" ? "Rejected" : raw;
          cache.set(`${OFFICER_STATUS_PREFIX}${id}`, status);

          if (status.toLowerCase() === "rejected") {
            rejectedIds.push(id);
          } else {
            notApprovedIds.push(id);
          }
        });

        cache.set(REJECTED_OFFICERS_KEY, rejectedIds);
        cache.set(NOT_APPROVED_OFFICERS_KEY, notApprovedIds);

        console.log(
          `[Cache] Loaded disallowed officers: ${rejectedIds.length} Rejected, ${notApprovedIds.length} Not Approved`
        );
        resolve(rejectedIds);
      });
    });
  } catch (err) {
    console.error("[Cache] Unexpected error in triggerGetRejectOfficers:", err.message);
    return [];
  }
};

/**
 * Get the list of rejected officer IDs from cache.
 * If cache is empty, triggers database fetch.
 */
const getRejectedOfficerIds = async () => {
  let rejectedIds = cache.get(REJECTED_OFFICERS_KEY);
  if (!rejectedIds) {
    rejectedIds = await triggerGetRejectOfficers();
  }
  return rejectedIds || [];
};

/**
 * Check if an officer ID is in the rejected cache.
 */
const isRejected = (officerId) => {
  const numericId = Number(officerId);
  const status = cache.get(`${OFFICER_STATUS_PREFIX}${numericId}`);
  if (status && status.toLowerCase() === "rejected") return true;

  const rejectedIds = cache.get(REJECTED_OFFICERS_KEY);
  return Array.isArray(rejectedIds) && rejectedIds.includes(numericId);
};

/**
 * Check if an officer ID is in the not-approved cache.
 */
const isNotApproved = (officerId) => {
  const numericId = Number(officerId);
  const status = cache.get(`${OFFICER_STATUS_PREFIX}${numericId}`);
  if (status && (status.toLowerCase() === "not approved" || status.toLowerCase() === "pending")) return true;

  const notApprovedIds = cache.get(NOT_APPROVED_OFFICERS_KEY);
  return Array.isArray(notApprovedIds) && notApprovedIds.includes(numericId);
};

/**
 * Check if an officer is cached as strictly Approved.
 */
const isApproved = (officerId) => {
  const numericId = Number(officerId);
  const status = cache.get(`${OFFICER_STATUS_PREFIX}${numericId}`);
  return status && status.toLowerCase() === "approved";
};

/**
 * Manually update or invalidate a single officer's status in cache.
 * Cleans old status and sets new status without expiration (stdTTL: 0).
 */
const setOfficerStatus = (officerId, status) => {
  const numericId = Number(officerId);
  const trimmed = (status || "").trim();
  const lower = trimmed.toLowerCase();
  const normStatus = lower === "approved" ? "Approved" : lower === "rejected" ? "Rejected" : trimmed;
  cache.set(`${OFFICER_STATUS_PREFIX}${numericId}`, normStatus);

  let rejectedIds = cache.get(REJECTED_OFFICERS_KEY) || [];
  let notApprovedIds = cache.get(NOT_APPROVED_OFFICERS_KEY) || [];

  if (normStatus === "Rejected") {
    if (!rejectedIds.includes(numericId)) {
      rejectedIds.push(numericId);
    }
    notApprovedIds = notApprovedIds.filter((id) => id !== numericId);
  } else if (normStatus === "Approved") {
    rejectedIds = rejectedIds.filter((id) => id !== numericId);
    notApprovedIds = notApprovedIds.filter((id) => id !== numericId);
  } else {
    if (!notApprovedIds.includes(numericId)) {
      notApprovedIds.push(numericId);
    }
    rejectedIds = rejectedIds.filter((id) => id !== numericId);
  }

  cache.set(REJECTED_OFFICERS_KEY, rejectedIds);
  cache.set(NOT_APPROVED_OFFICERS_KEY, notApprovedIds);
};

/**
 * Clear the entire status cache.
 */
const clearCache = () => {
  cache.flushAll();
};

module.exports = {
  cache,
  OFFICER_STATUS,
  triggerGetRejectOfficers,
  getRejectedOfficerIds,
  isRejected,
  isNotApproved,
  isApproved,
  setOfficerStatus,
  clearCache,
};
