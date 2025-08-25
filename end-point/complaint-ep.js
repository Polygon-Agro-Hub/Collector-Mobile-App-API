const ComplaintDao = require('../dao/complaint-dao');
const { v4: uuidv4 } = require('uuid'); // To generate unique IDs
const {
    createComplain
} = require('../Validations/complain-validation')
const asyncHandler = require("express-async-handler");
// Function to create a farmer complaint
exports.createFarmerComplaint = async (req, res) => {
    try {


        const { complain, language, userId, category } = req.body;
        const officerId = req.user.id;

        const userExists = await ComplaintDao.checkIfUserExists(userId);

        if (!userExists) {
            return res.status(400).json({ message: 'User does not exist' });
        } else {
            console.log('User exists');
        }
        farmerId = userExists.id;
        const today = new Date();
        const YYMMDD = today.toISOString().slice(2, 10).replace(/-/g, '');
        const datePrefix = `PC${YYMMDD}`;

        const complaintsOnDate = 565322;
        const referenceNumber = `${datePrefix}${String(complaintsOnDate + 1).padStart(4, '0')}`;
        const status = 'Opened';

        // Call the DAO to insert the complaint into the database
        const compain = await ComplaintDao.createComplaint(complain, language, farmerId, category, status, officerId, referenceNumber);
        console.log(compain)

        return res.status(201).json({ message: 'Complaint registered successfully' });
    } catch (error) {
        console.error('Error inserting complaint:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


exports.createOfficerComplain = asyncHandler(async (req, res) => {
    try {
        const coId = req.user.id;
        const empId = req.user.empId

        const { language, complain, category } = req.body;
        let setlanguage;
        if (language === 'en') {
            setlanguage = 'English';
        } else if (language === 'si') {
            setlanguage = 'Sinhala';
        } else if (language === 'ta') {
            setlanguage = 'Tamil';
        }

        const officerRole = req.user.role;

        console.log("Officer Role:", officerRole);


        console.log("Creating complain:", { coId, language, complain, category, officerRole });
        const today = new Date();
        const YYMMDD = today.toISOString().slice(2, 10).replace(/-/g, '');
        const datePrefix = `${empId}${YYMMDD}`;

        const complaintsOnDate = await ComplaintDao.countOfiicerComplaintsByDate(today);
        const referenceNumber = `${datePrefix}${String(complaintsOnDate + 1).padStart(3, '0')}`;

        const newComplainId = await ComplaintDao.createOfficerComplaint(
            coId,
            setlanguage,
            complain,
            category,
            referenceNumber,
            officerRole
        );

        res.status(201).json({
            status: "success",
            message: "Complain created successfully.",
            complainId: newComplainId,
        });
    } catch (err) {
        console.error("Error creating complain:", err);

        res.status(500).json({
            status: "error",
            message: "Internal Server Error",
        });
    }
});

exports.getComplains = asyncHandler(async (req, res) => {
    console.log("Fetching complaints...");
    try {
        const userId = req.user.id;
        const officerRole = req.user.role;
        const complains = await ComplaintDao.getAllComplaintsByUserId(userId, officerRole);

        if (!complains || complains.length === 0) {
            return res.status(404).json({ message: "No complaints found" });
        }

        res.status(200).json(complains);
        console.log("Complaints fetched successfully", complains);
    } catch (error) {
        console.error("Error fetching complaints:", error);
        res.status(500).json({ message: "Failed to fetch complaints" });
    }
});



exports.getComplainCategory = asyncHandler(async (req, res) => {
    try {
        const appName = req.params.appName;
        console.log("Fetching categories for app:", appName);
        const categories = await ComplaintDao.getComplainCategories(appName);

        if (!categories || categories.length === 0) {
            return res.status(404).json({ message: "No categories found" });
        }

        res.status(200).json({ status: "success", data: categories });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ message: "Failed to fetch categories" });
    }
});