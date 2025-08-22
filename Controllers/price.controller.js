const db = require('../startup/database'); // Import the database connection


exports.insertMarketPriceRequestBatch = async (req, res) => {
    try {
        const { prices } = req.body; // prices is an array of price update objects
        console.log(prices);

        if (!prices || prices.length === 0) {
            return res.status(400).json({ message: 'No prices provided for update.' });
        }

        const userId = req.user.id; // Get the user ID from the authenticated user
        console.log(userId); // For debugging purposes

        const status = 'requested'; // Default status

        // Step 1: Get the empId from collectionofficercompanydetails based on req.user.id
        const [empIdResult] = await db.promise().query(
            `SELECT id AS empId FROM collectionofficercompanydetails WHERE collectionOfficerId = ?`, [userId]
        );

        if (empIdResult.length === 0) {
            return res.status(404).json({ message: 'Employee not found in collectionofficercompanydetails.' });
        }

        const empId = empIdResult[0].empId; // Retrieve the empId (which is the id from collectionofficercompanydetails table)
        console.log(empId); // For debugging purposes

        // Step 2: Get the centerId of the employee (empId) from collectionofficer table
        const [centerResult] = await db.promise().query(
            `SELECT centerId FROM collectionofficer WHERE id = ?`, [empId]
        );

        if (centerResult.length === 0) {
            return res.status(404).json({ message: 'Employee not found in collectionofficer.' });
        }

        const centerId = centerResult[0].centerId;

        // Step 3: Prepare the price update data and fetch the corresponding marketPriceId for each grade
        const priceRequests = [];
        for (const price of prices) {
            const { varietyId, grade, requestPrice } = price;

            // Get the original price for the varietyId and grade from the marketprice table
            const [marketPriceResult] = await db.promise().query(
                `SELECT price FROM marketprice WHERE varietyId = ? AND grade = ?`, [varietyId, grade]
            );

            if (marketPriceResult.length === 0) {
                return res.status(404).json({ message: `Market price for varietyId ${varietyId} and grade ${grade} not found.` });
            }

            const originalPrice = marketPriceResult[0].price;

            // Compare the original price with the requestPrice
            if (parseFloat(originalPrice) !== parseFloat(requestPrice)) {
                // Get the marketPriceId for each price (varietyId and grade)
                const [marketPriceIdResult] = await db.promise().query(
                    `SELECT id FROM marketprice WHERE varietyId = ? AND grade = ?`, [varietyId, grade]
                );

                if (marketPriceIdResult.length === 0) {
                    return res.status(404).json({ message: `Market price ID for varietyId ${varietyId} and grade ${grade} not found.` });
                }

                const marketPriceId = marketPriceIdResult[0].id;

                // Prepare the price request data only if the price has changed
                priceRequests.push([
                    marketPriceId, centerId, requestPrice, status, empId
                ]);
            }
        }

        // Step 4: Insert all the price requests in one query (batch insert)
        if (priceRequests.length > 0) {
            const [insertResult] = await db.promise().query(
                `INSERT INTO marketpricerequest (marketPriceId, centerId, requestPrice, status, empId) VALUES ?`, [priceRequests]
            );

            return res.status(201).json({
                message: 'Market price requests created successfully.',
                requestId: insertResult.insertId
            });
        } else {
            return res.status(400).json({ message: 'No valid price data to insert (no price changes).' });
        }

    } catch (error) {
        console.error('Error inserting market price request:', error);
        return res.status(500).json({ message: 'An error occurred while processing your request.' });
    }
};