/**
 * Middleware to restrict route access based on user roles.
 * @param {string|string[]} allowedRoles - Single role string or array of allowed roles.
 */
const checkRole = (allowedRoles) => {
  // Convert single string role to an array
  const roles = typeof allowedRoles === "string" ? [allowedRoles] : allowedRoles;
  
  // Normalize roles to lowercase for comparison
  const normalizedRoles = roles.map(role => role.trim().toLowerCase());

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        status: "error",
        message: "Access denied. No role associated with this user.",
      });
    }

    const userRole = req.user.role.trim().toLowerCase();

    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        status: "error",
        message: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }

    next();
  };
};

module.exports = checkRole;
