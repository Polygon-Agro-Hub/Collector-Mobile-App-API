const rateLimit = require("express-rate-limit");

/**
 * Strict rate limiter for sensitive authentication endpoints (Login, Password Reset).
 * Limits each IP to 25 attempts per 15-minute window.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Limit each IP to 25 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: "error",
    code: "TOO_MANY_REQUESTS",
    message: "Too many login attempts from this IP address. Please try again after 15 minutes.",
  },
  statusCode: 429,
});

/**
 * General API rate limiter for standard routes to prevent accidental abuse/flooding.
 * Allows 600 requests per minute per IP.
 */
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests. Please slow down.",
  },
  statusCode: 429,
});

module.exports = {
  authLimiter,
  generalLimiter,
};
