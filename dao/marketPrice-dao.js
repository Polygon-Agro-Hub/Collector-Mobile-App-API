const db = require("../startup/database");

const getEmpIdFromCollectionOfficerCompanyDetails = async (userId) => {
    const [empIdResult] = await db.collectionofficer
        .promise()
        .query(`SELECT id AS empId FROM collectionofficer WHERE id = ?`, [userId]);
    return empIdResult.length > 0 ? empIdResult[0].empId : null;
};

const getCenterIdFromCollectionOfficer = async (empId) => {
    const [centerResult] = await db.collectionofficer
        .promise()
        .query(`SELECT centerId FROM collectionofficer WHERE id = ?`, [empId]);
    return centerResult.length > 0 ? centerResult[0].centerId : null;
};

const getMarketPrice = async (varietyId, grade) => {
    const [marketPriceResult] = await db.collectionofficer
        .promise()
        .query(`SELECT price FROM marketprice WHERE varietyId = ? AND grade = ?`, [
            varietyId,
            grade,
        ]);
    return marketPriceResult.length > 0 ? marketPriceResult[0].price : null;
};

const getMarketPriceId = async (varietyId, grade) => {
    const [marketPriceIdResult] = await db.collectionofficer
        .promise()
        .query(`SELECT id FROM marketprice WHERE varietyId = ? AND grade = ?`, [
            varietyId,
            grade,
        ]);
    return marketPriceIdResult.length > 0 ? marketPriceIdResult[0].id : null;
};

const insertPriceRequests = async (priceRequests) => {
    const [insertResult] = await db.collectionofficer
        .promise()
        .query(
            `INSERT INTO marketpricerequest (marketPriceId, centerId, requestPrice, status, empId) VALUES ?`,
            [priceRequests],
        );
    return insertResult;
};

const getCompanyCenterIdFromCompanyCenter = async (centerId) => {
    const [result] = await db.collectionofficer
        .promise()
        .query(`SELECT id FROM companycenter WHERE centerId = ?`, [centerId]);
    return result.length > 0 ? result[0].id : null;
};

const updateMarketPriceServe = async (
    marketPriceId,
    companyCenterId,
    updatedPrice,
) => {
    const [result] = await db.collectionofficer.promise().query(
        `UPDATE marketpriceserve 
         SET updatedPrice = ?, updateAt = NOW() 
         WHERE marketPriceId = ? AND companyCenterId = ?`,
        [updatedPrice, marketPriceId, companyCenterId],
    );
    return result;
};

const checkMarketPriceServeExists = async (marketPriceId, companyCenterId) => {
    const [result] = await db.collectionofficer.promise().query(
        `SELECT id FROM marketpriceserve 
         WHERE marketPriceId = ? AND companyCenterId = ?`,
        [marketPriceId, companyCenterId],
    );
    return result.length > 0;
};

const updateMarketPriceRequestStatus = async (
    marketPriceId,
    centerId,
    requestPrice,
) => {
    const [findRecords] = await db.collectionofficer.promise().query(
        `SELECT id, status FROM marketpricerequest 
         WHERE marketPriceId = ? AND centerId = ? AND requestPrice = ?`,
        [marketPriceId, centerId, requestPrice],
    );

    const [result] = await db.collectionofficer.promise().query(
        `UPDATE marketpricerequest 
         SET status = 'Approved' 
         WHERE marketPriceId = ? AND centerId = ? AND requestPrice = ? AND status = 'Pending'`,
        [marketPriceId, centerId, requestPrice],
    );

    return result;
};

module.exports = {
    getEmpIdFromCollectionOfficerCompanyDetails,
    getCenterIdFromCollectionOfficer,
    getMarketPrice,
    getMarketPriceId,
    insertPriceRequests,
    getCompanyCenterIdFromCompanyCenter,
    updateMarketPriceServe,
    checkMarketPriceServeExists,
    updateMarketPriceRequestStatus,
};
