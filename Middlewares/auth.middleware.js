const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            status: "error",
            message: "No token provided",
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
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

        req.user = decoded;
        next();
    });
};

module.exports = auth;
