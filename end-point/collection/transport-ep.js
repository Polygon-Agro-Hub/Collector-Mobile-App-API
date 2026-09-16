const TransportDAO = require("../../dao/collection/transport-dao");
const { DRIVER_STATUS } = require("../../constants/driver-status");


exports.getSentProductsToday = async (req, res) => {
    try {
        const officerId = req.user.id;

        if (!officerId) {
            return res.status(400).json({
                success: false,
                message: "Officer ID not found in token",
            });
        }

        const sentProducts = await TransportDAO.getSentProductsToday(officerId);

        res.status(200).json({
            success: true,
            data: sentProducts,
        });
    } catch (error) {
        console.error("Error fetching sent products today:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch sent products today",
        });
    }
};

exports.getTransportLoadDetails = async (req, res) => {
    try {
        const { transportId } = req.params;

        if (!transportId) {
            return res.status(400).json({
                success: false,
                message: "Transport ID is required",
            });
        }

        const loadDetails = await TransportDAO.getTransportLoadDetails(transportId);

        if (!loadDetails) {
            return res.status(404).json({
                success: false,
                message: "Transport load details not found",
            });
        }

        res.status(200).json({
            success: true,
            data: loadDetails,
        });
    } catch (error) {
        console.error("Error fetching transport load details:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch transport load details",
        });
    }
};


exports.verifyDriverQR = async (req, res) => {
    try {
        let { qrData } = req.body;

        if (!qrData || typeof qrData !== "string" || !qrData.trim()) {
            return res.status(400).json({
                success: false,
                code: "INVALID_QR",
                message: "Invalid QR code. Please scan a valid driver QR code.",
            });
        }

        qrData = qrData.trim();
        let extractedEmpId = null;

        // Strictly validate JSON format {"empId": "DRVXXXXX"} where XXXXX is number
        try {
            const parsed = JSON.parse(qrData);
            if (parsed && typeof parsed === "object") {
                const empIdValue = parsed.empId || parsed.empld;
                if (empIdValue && typeof empIdValue === "string" && /^DRV\d+$/i.test(empIdValue.trim())) {
                    extractedEmpId = empIdValue.trim();
                }
            }
        } catch (e) {
            // Not a JSON format
        }

        // If not valid JSON or empId does not match DRVXXXXX format
        if (!extractedEmpId) {
            return res.status(400).json({
                success: false,
                code: "INVALID_QR",
                message: "Invalid QR code. Please scan a valid driver QR code.",
            });
        }

        const officer = await TransportDAO.getDriverByQRCode(qrData, extractedEmpId);

        if (!officer) {
            return res.status(404).json({
                success: false,
                code: "INVALID_QR",
                message: "Invalid QR code. Please scan a valid driver QR code.",
            });
        }

        // Check driver status (must be Approved)
        const isApproved =
            officer.status === DRIVER_STATUS.APPROVED ||
            officer.status === "Approved" ||
            officer.status === 1 ||
            officer.status === "1";

        if (!isApproved) {
            return res.status(403).json({
                success: false,
                code: "UNAUTHORIZED_STATUS",
                message: "Driver access has been rejected. Please contact the company for assistance.",
            });
        }

        const normalizedRole = (officer.jobRole || "").trim().toLowerCase();
        if (normalizedRole !== TransportDAO.HEAVY_WEIGHT_DRIVER_ROLE.toLowerCase()) {
            return res.status(403).json({
                success: false,
                code: "UNAUTHORIZED_ROLE",
                message: "Driver access has been rejected. Please contact the company for assistance.",
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                driverId: officer.id,
                empId: officer.empId,
                fullName: `${officer.firstNameEnglish} ${officer.lastNameEnglish}`.trim(),
                jobRole: officer.jobRole,
                vehicleId: officer.vehicleId || null,
                vRegNo: officer.vRegNo || null,
                vehicleNo: officer.vRegNo || null,
                vType: officer.vType || null,
                vCapacity: officer.vCapacity || null,
            },
        });
    } catch (error) {
        console.error("Error verifying driver QR:", error);
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            message: error.message || "Failed to verify QR code",
        });
    }
};

exports.getAllDistributionCentres = async (req, res) => {
    try {
        const officerId = req.user?.id;
        const centres = await TransportDAO.getAllDistributionCentres(officerId);

        res.status(200).json({
            success: true,
            data: centres,
        });
    } catch (error) {
        console.error("Error fetching distribution centres:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch distribution centres",
        });
    }
};

exports.getCropsAndVarietiesForOfficer = async (req, res) => {
    try {
        const officerId = req.user?.id;

        let companyCenterId = null;
        if (officerId) {
            try {
                companyCenterId = await TransportDAO.getOfficerCompanyCenterId(officerId);
            } catch (e) {
                console.warn("Could not find company center id for officer:", e.message);
            }
        }

        const data = await TransportDAO.getCropsAndVarietiesForCenter(companyCenterId);

        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        console.error("Error fetching crops and varieties:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch crops and varieties",
        });
    }
};

exports.saveTransportLoad = async (req, res) => {
    try {
        const officerId = req.user?.id;
        const { driverId, centreId, disComCenId, items } = req.body;

        if (!officerId) {
            return res.status(401).json({
                success: false,
                message: "Officer ID not found in token",
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No items provided for transport load",
            });
        }

        const result = await TransportDAO.saveTransportLoad({
            officerId,
            driverId,
            centreId,
            disComCenId,
            items,
        });

        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("Error creating transport load:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create transport load",
        });
    }
};