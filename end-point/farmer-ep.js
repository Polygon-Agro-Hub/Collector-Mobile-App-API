const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const farmerDao = require('../dao/farmar-dao');
const asyncHandler = require('express-async-handler');
const uploadFileToS3 = require('../Middlewares/s3upload');
const axios = require('axios');
const userSchema = require('../Validations/farmer-validation');


exports.addUserAndPaymentDetails = asyncHandler(async (req, res) => {
    try {

        console.log("addUserAndPaymentDetails", req.body);
        // Validate request body using Joi
        const { error, value } = userSchema.userSchema.validate(req.body, { abortEarly: false });

        if (error) {
            const validationErrors = error.details.map(detail => detail.message);
            return res.status(400).json({
                error: "Validation failed",
                details: validationErrors
            });
        }

        const {
            firstName,
            lastName,
            NICnumber,
            phoneNumber,
            district,
            accNumber,
            accHolderName,
            bankName,
            branchName,
            PreferdLanguage
        } = value;

        // Format phone number (removing + if present, then adding it back)
        const formattedPhoneNumber = `+${String(phoneNumber).replace(/^\+/, "")}`;
        console.log('Formatted Phone Number:', formattedPhoneNumber);

        // Create user record
        const userResult = await farmerDao.createUser(
            firstName,
            lastName,
            NICnumber,
            formattedPhoneNumber,
            district,
            PreferdLanguage
        );

        const userId = userResult.insertId;

        // Insert into the 'userbankdetails' table
        const paymentResult = await farmerDao.createPaymentDetails(
            userId,
            accNumber,
            accHolderName,
            bankName,
            branchName
        );

        const paymentId = paymentResult.insertId;

        // Generate and update QR code for the user
        const qrUrl = await exports.createQrCode(userId);

        // Success response
        res.status(200).json({
            message: "User, bank details, and QR code added successfully",
            userId: userId,
            paymentId: paymentId,
            qrCodeUrl: qrUrl,
            NICnumber: NICnumber,
        });
    } catch (error) {
        // Check for specific errors
        if (error.code === 'ER_DUP_ENTRY') {
            // Handle duplicate entry error from database
            return res.status(409).json({
                error: "A user with this information already exists",
                details: error.message
            });
        }

        // Generic error response
        console.error("Error during user creation:", error);
        res.status(500).json({
            error: "An unexpected error occurred",
            details: error.message
        });
    }
});

exports.addFarmerBankDetails = async (req, res) => {
    console.log("addFarmerBankDetails", req.body);

    const { error, value } = userSchema.bankDetailsSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const validationErrors = error.details.map(detail => detail.message);
        return res.status(400).json({
            error: "Validation failed",
            details: validationErrors
        });
    }

    const { userId, NICnumber, accNumber, accHolderName, bankName, branchName } = req.body;
    console.log("userId", userId, "NICnumber", NICnumber, "accNumber", accNumber, "accHolderName", accHolderName, "bankName", bankName, "branchName", branchName);

    // Validation: Check if all fields are filled
    if (!userId || !accNumber || !accHolderName || !bankName || !branchName) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // Insert into the 'userbankdetails' table
        const paymentResult = await farmerDao.createPaymentDetails(userId, accNumber, accHolderName, bankName, branchName);
        const paymentId = paymentResult.insertId;
        const qrUrl = await exports.createQrCode(userId);

        // Success response
        res.status(200).json({
            message: "User, bank details, and QR code added successfully",
            userId: userId,
            paymentId: paymentId,
            qrCodeUrl: qrUrl,
            NICnumber: NICnumber,

        });
    } catch (error) {
        // Handle duplicate entry error
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Duplicate entry error: " + error.message });
        }

        // Generic error response
        console.error("Error during bank details creation:", error);
        res.status(500).json({ error: "An unexpected error occurred: " + error.message });
    }
};



exports.createQrCode = async (userId, callback) => {
    try {
        const qrData = {
            userInfo: {
                id: userId,
            },
        };
        console.log('QR Data:', qrData);
        const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrData));
        console.log('QR Code Base64:', qrCodeBase64);

        const qrCodeBuffer = Buffer.from(
            qrCodeBase64.replace(/^data:image\/png;base64,/, ""),
            'base64'
        );
        const fileName = `qrCode_${userId}.png`;
        const qrUrl = await uploadFileToS3(qrCodeBuffer, fileName, "users/farmerQr");

        await farmerDao.updateQrCodePath(userId, qrUrl);

        // Return QR code details
        return qrUrl;
    } catch (err) {
        return callback(err);
    }
};




exports.getRegisteredFarmerDetails = async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        // Fetch the raw farmer data from the DAO layer
        const rows = await farmerDao.getFarmerDetailsById(userId);

        console.log('rows:', rows);

        // If no user found, return a 404 response
        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        // Extract the first user
        const user = rows[0];
        console.log('user:', user);

        // Prepare the response data
        const response = {
            firstName: user.firstName,
            lastName: user.lastName,
            NICnumber: user.NICnumber,
            qrCode: user.farmerQr, // Send raw QR code (no Base64 conversion)
            phoneNumber: user.phoneNumber,
            language: user.language,
        };

        console.log('response:', response);

        // Send the response
        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching farmer details:', error.message);
        res.status(500).json({ error: "Failed to fetch farmer details: " + error.message });
    }
};




exports.getUserWithBankDetails = async (req, res) => {

    console.log('route: /report-user-details/:id');
    const userId = req.params.id;
    const centerId = req.user.centerId;
    const companyId = req.user.companyId;

    console.log('userId:', userId);
    console.log('centerId:', centerId);
    console.log('companyId:', companyId);

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    try {
        // Fetch the raw user data with bank details from the DAO layer
        const rows = await farmerDao.getUserWithBankDetailsById(userId, centerId, companyId);
        console.log('rows:', rows);

        // If no user found, return a 404 response
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = rows[0];

        // Convert the QR code from binary data (BLOB) to Base64
        let qrCodeBase64 = '';
        if (user.farmerQr) {
            // Convert the binary BLOB data directly to Base64 using `toString('base64')`
            qrCodeBase64 = `data:image/png;base64,${user.farmerQr.toString('base64')}`;
            const qrCodePath = user.farmerQr.toString();
            console.log('QR Code Path:', qrCodePath);

            try {
                if (fs.existsSync(qrCodePath)) {
                    const qrCodeData = fs.readFileSync(qrCodePath);
                    qrCodeBase64 = `data:image/png;base64,${qrCodeData.toString('base64')}`;
                    console.log('QR Code Base64:', qrCodeBase64);
                } else {
                    console.warn('QR code file not found at:', qrCodePath);
                }
            } catch (err) {
                console.error('Error processing QR code file:', err.message);
            }
        }

        // Prepare the response data with company and center details
        const response = {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            NICnumber: user.NICnumber,
            profileImage: user.profileImage,
            qrCode: qrCodeBase64,  // Base64 QR code image
            address: user.address,
            accNumber: user.accNumber,
            accHolderName: user.accHolderName,
            bankName: user.bankName,
            branchName: user.branchName,
            companyNameEnglish: user.companyNameEnglish,
            centerName: user.centerName,
            createdAt: user.createdAt
        };

        console.log('response:', response);
        // Send the response
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user with bank details: " + error.message });
    }
};





exports.signupChecker = async (req, res) => {
    console.log("signupChecker");
    try {
        const { phoneNumber, NICnumber } = req.body;
        console.log("phoneNumber", phoneNumber);

        const results = await farmerDao.checkSignupDetails(phoneNumber, NICnumber);

        let phoneNumberExists = false;
        let NICnumberExists = false;

        results.forEach((user) => {
            if (user.phoneNumber === `+${String(phoneNumber).replace(/^\+/, "")}`) {
                phoneNumberExists = true;
            }
            if (user.NICnumber === NICnumber) {
                NICnumberExists = true;
            }
        });

        if (phoneNumberExists && NICnumberExists) {
            return res
                .status(200)
                .json({ message: "This Phone Number and NIC already exist." });
        } else if (phoneNumberExists) {
            return res
                .status(200)
                .json({ message: "This Phone Number already exists." });
        } else if (NICnumberExists) {
            return res.status(200).json({ message: "This NIC already exists." });
        }

        res.status(200).json({ message: "Both fields are available!" });
    } catch (err) {
        console.error("Error in signupChecker:", err);

        if (err.isJoi) {
            return res.status(400).json({
                status: "error",
                message: err.details[0].message,
            });
        }

        res.status(500).json({ message: "Internal Server Error!" });
    }
};



exports.addFarmer = asyncHandler(async (req, res) => {
    const {
        firstName,
        lastName,
        NICnumber,
        phoneNumber,
        district,
    } = req.body;

    // Validation: Check if all fields are filled
    if (!firstName || !lastName || !NICnumber || !phoneNumber || !district) {
        return res.status(400).json({ error: "All fields are required" });
    }

    const formattedPhoneNumber = `+${String(phoneNumber).replace(/^\+/, "")}`;
    console.log("Formatted Phone Number:", formattedPhoneNumber);

    try {
        const userResult = await farmerDao.createUser(firstName, lastName, NICnumber, formattedPhoneNumber, district);
        const userId = userResult.insertId;

        // Success response (Removed QR code and paymentId)
        res.status(200).json({
            message: "User added successfully",
            userId: userId,
            NICnumber: NICnumber,
        });
    } catch (error) {
        // Handle duplicate entry error
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "Duplicate entry error: " + error.message });
        }

        // Generic error response
        console.error("Error during user creation:", error);
        res.status(500).json({ error: "An unexpected error occurred: " + error.message });
    }
});

exports.sendSMSToFarmers = asyncHandler(async (req, res) => {
    console.log("sendSMSToFarmers");
    try {
        // Fetch farmers from the database
        const farmers = await farmerDao.getFarmersForSms(); // A method in the DAO that fetches farmer details

        // Loop over each farmer and send SMS
        for (const farmer of farmers) {
            const message = generateSmsMessage(farmer.language); // Generate message based on the farmer's language
            const formattedPhone = farmer.phoneNumber;

            const apiUrl = "https://api.getshoutout.com/coreservice/messages";
            const headers = {
                Authorization: `Apikey ${process.env.SHOUTOUT_API_KEY}`,
                "Content-Type": "application/json",
            };

            const body = {
                source: "AgroWorld",
                destinations: [formattedPhone],
                content: { sms: message },
                transports: ["sms"],
            };

            // Send SMS
            const response = await axios.post(apiUrl, body, { headers });

            // Check if the API response is valid and log success
            if (response && response.status === 200) {
                console.log(`SMS sent to: ${formattedPhone}`);
            } else {
                console.log(`Error sending SMS to ${formattedPhone}:`, response);
            }
        }

        res.status(200).json({ message: 'SMS notifications sent successfully!' });
    } catch (error) {
    }
});

// Helper function to generate SMS message based on language
const generateSmsMessage = (language) => {
    let message = '';
    if (language === 'English') {
        message = "As per your order, we will send a vehicle tomorrow for your produce collection. Driver will contact you.";
    } else if (language === 'Sinhala') {
        message = "ඇණවුම පරිදි, ඔබගේ නිෂ්පාදන එකතු කිරීම සඳහා අපි හෙට දින වාහනයක් එවන්නෙමු. රියදුරු ඔබව සම්බන්ධ කර ගනු ඇත.";
    } else if (language === 'Tamil') {
        message = "உங்கள் உத்தரவின்படி, உங்கள் விளைபொருட்களை சேகரிப்பதற்காக நாளை வாகனத்தை அனுப்புவோம். ஓட்டுநர் உங்களைத் தொடர்புகொள்வார்.";
    }
    return message;
};
