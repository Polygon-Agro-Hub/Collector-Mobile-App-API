const db = require('../startup/database');

// Function to fetch employee ID based on collectionOfficerId
const getEmpIdFromCollectionOfficerCompanyDetails = async (userId) => {
    const [empIdResult] = await db.collectionofficer.promise().query(
        `SELECT id AS empId FROM collectionofficer WHERE id = ?`, [userId]
    );
    return empIdResult.length > 0 ? empIdResult[0].empId : null;
};

// Function to fetch centerId based on empId
const getCenterIdFromCollectionOfficer = async (empId) => {
    const [centerResult] = await db.collectionofficer.promise().query(
        `SELECT centerId FROM collectionofficer WHERE id = ?`, [empId]
    );
    return centerResult.length > 0 ? centerResult[0].centerId : null;
};

// Function to fetch market price for a variety and grade
const getMarketPrice = async (varietyId, grade) => {
    const [marketPriceResult] = await db.collectionofficer.promise().query(
        `SELECT price FROM marketprice WHERE varietyId = ? AND grade = ?`, [varietyId, grade]
    );
    return marketPriceResult.length > 0 ? marketPriceResult[0].price : null;
};

// Function to fetch market price ID for a variety and grade
const getMarketPriceId = async (varietyId, grade) => {
    const [marketPriceIdResult] = await db.collectionofficer.promise().query(
        `SELECT id FROM marketprice WHERE varietyId = ? AND grade = ?`, [varietyId, grade]
    );
    return marketPriceIdResult.length > 0 ? marketPriceIdResult[0].id : null;
};

// Function to insert price requests
const insertPriceRequests = async (priceRequests) => {
    const [insertResult] = await db.collectionofficer.promise().query(
        `INSERT INTO marketpricerequest (marketPriceId, centerId, requestPrice, status, empId) VALUES ?`, [priceRequests]
    );
    return insertResult;
};

// Function to get companyCenterId from companycenter table based on centerId
const getCompanyCenterIdFromCompanyCenter = async (centerId) => {
    const [result] = await db.collectionofficer.promise().query(
        `SELECT id FROM companycenter WHERE centerId = ?`, [centerId]
    );
    return result.length > 0 ? result[0].id : null;
};

// Function to update updatedPrice in marketpriceserve table
const updateMarketPriceServe = async (marketPriceId, companyCenterId, updatedPrice) => {
    const [result] = await db.collectionofficer.promise().query(
        `UPDATE marketpriceserve 
         SET updatedPrice = ? 
         WHERE marketPriceId = ? AND companyCenterId = ?`,
        [updatedPrice, marketPriceId, companyCenterId]
    );
    return result;
};

// Function to check if record exists in marketpriceserve
const checkMarketPriceServeExists = async (marketPriceId, companyCenterId) => {
    const [result] = await db.collectionofficer.promise().query(
        `SELECT id FROM marketpriceserve 
         WHERE marketPriceId = ? AND companyCenterId = ?`,
        [marketPriceId, companyCenterId]
    );
    return result.length > 0;
};

// Update module.exports
module.exports = {
    getEmpIdFromCollectionOfficerCompanyDetails,
    getCenterIdFromCollectionOfficer,
    getMarketPrice,
    getMarketPriceId,
    insertPriceRequests,
    getCompanyCenterIdFromCompanyCenter,
    updateMarketPriceServe,
    checkMarketPriceServeExists,
};