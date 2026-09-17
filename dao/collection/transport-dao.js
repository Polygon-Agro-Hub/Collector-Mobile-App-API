const { plantcare, collectionofficer } = require("../../startup/database");

exports.getSentProductsToday = (officerId) => {
    return new Promise((resolve, reject) => {
        if (!officerId) {
            return reject(new Error("Officer ID is required"));
        }

        const sql = `
      SELECT
          tl.id,
          tl.transferCode,
          tl.createdAt,
          COALESCE(SUM(lc.crateCount), 0) AS totalCrates,
          COALESCE(SUM(lc.qty), 0) AS totalWeight,
          dc.centerName AS destination,
          vr.vRegNo AS vehicleNo,
          driver.empId AS driverEmpId,
          CONCAT(COALESCE(driver.firstNameEnglish, ''), ' ', COALESCE(driver.lastNameEnglish, '')) AS driverName
      FROM transportload tl
      INNER JOIN companycenter cc ON cc.id = tl.comCenId
      INNER JOIN collectionofficer co
          ON co.centerId = cc.centerId AND co.companyId = cc.companyId
      LEFT JOIN collectionofficer driver ON driver.id = tl.driverId
      LEFT JOIN vehicleregistration vr ON vr.coId = driver.id
      LEFT JOIN distributedcompanycenter dcc ON dcc.id = tl.disComCenId
      LEFT JOIN distributedcenter dc ON dc.id = dcc.centerId
      LEFT JOIN loadeditems li ON li.transportId = tl.id
      LEFT JOIN loadedcrates lc ON lc.loadId = li.id
      WHERE co.id = ?
        AND DATE(tl.createdAt) = CURDATE()
      GROUP BY tl.id, vr.vRegNo, driver.empId, driver.firstNameEnglish, driver.lastNameEnglish, dc.centerName
      ORDER BY tl.createdAt ASC
    `;

        collectionofficer.query(sql, [officerId], (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return reject(err);
            }

            const formatted = results.map((row) => ({
                id: String(row.id),
                transferCode: row.transferCode || "",
                vehicleNo: row.vehicleNo || "N/A",
                driverEmpId: row.driverEmpId || "",
                driverName: (row.driverName || "").trim(),
                crates: parseInt(row.totalCrates, 10) || 0,
                weight: `${parseFloat(row.totalWeight || 0).toFixed(2)} kg`,
                destination: row.destination || "N/A",
                time: formatTime(row.createdAt),
            }));

            resolve(formatted);
        });
    });
};

exports.getReceivedProductsToday = (officerId) => {
    return new Promise((resolve, reject) => {
        if (!officerId) {
            return reject(new Error("Officer ID is required"));
        }

        const sql = `
      SELECT
          tl.id,
          tl.transferCode,
          tl.createdAt,
          COALESCE(SUM(lc.crateCount), 0) AS totalCrates,
          COALESCE(SUM(lc.qty), 0) AS totalWeight,
          COALESCE(clc.centerName, 'N/A') AS origin,
          vr.vRegNo AS vehicleNo,
          driver.empId AS driverEmpId,
          CONCAT(COALESCE(driver.firstNameEnglish, ''), ' ', COALESCE(driver.lastNameEnglish, '')) AS driverName
      FROM transportload tl
      INNER JOIN distributedcompanycenter dcc ON dcc.id = tl.disComCenId
      INNER JOIN collectionofficer co
          ON (co.distributedCenterId IS NULL AND co.companyId = dcc.companyId)
          OR (co.distributedCenterId = dcc.centerId AND (co.companyId = dcc.companyId OR co.companyId IS NULL))
          OR (co.distributedCenterId = dcc.id)
      LEFT JOIN companycenter cc ON cc.id = tl.comCenId
      LEFT JOIN collectioncenter clc ON clc.id = cc.centerId
      LEFT JOIN collectionofficer driver ON driver.id = tl.driverId
      LEFT JOIN vehicleregistration vr ON vr.coId = driver.id
      LEFT JOIN loadeditems li ON li.transportId = tl.id
      LEFT JOIN loadedcrates lc ON lc.loadId = li.id
      WHERE co.id = ?
        AND DATE(tl.createdAt) = CURDATE()
      GROUP BY tl.id, vr.vRegNo, driver.empId, driver.firstNameEnglish, driver.lastNameEnglish, clc.centerName
      ORDER BY tl.createdAt DESC
    `;

        collectionofficer.query(sql, [officerId], (err, results) => {
            if (err) {
                console.error("Database error in getReceivedProductsToday:", err);
                return reject(err);
            }

            const formatted = results.map((row) => ({
                id: String(row.id),
                transferCode: row.transferCode || "",
                vehicleNo: row.vehicleNo || "N/A",
                driverEmpId: row.driverEmpId || "",
                driverName: (row.driverName || "").trim(),
                crates: parseInt(row.totalCrates, 10) || 0,
                weight: `${parseFloat(row.totalWeight || 0).toFixed(2)} kg`,
                origin: row.origin || "N/A",
                time: formatTime(row.createdAt),
            }));

            resolve(formatted);
        });
    });
};

exports.getTransportLoadDetails = (transportId) => {
    return new Promise((resolve, reject) => {
        if (!transportId) {
            return reject(new Error("Transport ID is required"));
        }

        const headerSql = `
          SELECT 
              tl.id,
              tl.transferCode,
              tl.createdAt,
              tl.driverId,
              COALESCE(dc.centerName, dc_direct.centerName, 'N/A') AS destination,
              driver.empId AS driverEmpId,
              CONCAT(COALESCE(driver.firstNameEnglish, ''), ' ', COALESCE(driver.lastNameEnglish, '')) AS driverName,
              vr.vRegNo AS vehicleNo,
              vr.vType,
              vr.vCapacity
          FROM transportload tl
          LEFT JOIN collectionofficer driver ON driver.id = tl.driverId
          LEFT JOIN vehicleregistration vr ON vr.coId = driver.id
          LEFT JOIN distributedcompanycenter dcc ON dcc.id = tl.disComCenId
          LEFT JOIN distributedcenter dc ON dc.id = dcc.centerId
          LEFT JOIN distributedcenter dc_direct ON dc_direct.id = tl.disComCenId
          WHERE tl.id = ? OR tl.transferCode = ?
          LIMIT 1
        `;

        collectionofficer.query(headerSql, [transportId, transportId], (err, headerResults) => {
            if (err) {
                console.error("Database error fetching transport load header:", err);
                return reject(err);
            }

            if (headerResults.length === 0) {
                return resolve(null);
            }

            const loadHeader = headerResults[0];

            const itemsSql = `
              SELECT 
                  li.id AS loadedItemId,
                  li.varietyId,
                  cv.varietyNameEnglish,
                  cv.image AS varietyImage,
                  cg.id AS cropId,
                  cg.cropNameEnglish,
                  cg.image AS cropImage,
                  lc.id AS crateId,
                  lc.grade,
                  lc.crateCount,
                  lc.crateIndex,
                  lc.qty
              FROM loadeditems li
              LEFT JOIN plant_care.cropvariety cv ON li.varietyId = cv.id
              LEFT JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
              LEFT JOIN loadedcrates lc ON lc.loadId = li.id
              WHERE li.transportId = ?
              ORDER BY li.id ASC, lc.grade ASC, lc.crateIndex ASC
            `;

            collectionofficer.query(itemsSql, [loadHeader.id], (err2, itemRows) => {
                if (err2) {
                    console.error("Database error fetching transport load items:", err2);
                    return reject(err2);
                }

                // Group by loadedItem / variety
                const itemsMap = new Map();

                (itemRows || []).forEach((row) => {
                    const itemId = String(row.loadedItemId);
                    if (!itemsMap.has(itemId)) {
                        itemsMap.set(itemId, {
                            id: String(row.varietyId || row.loadedItemId),
                            loadedItemId: row.loadedItemId,
                            varietyId: row.varietyId ? String(row.varietyId) : undefined,
                            varietyLabel: row.varietyNameEnglish || "",
                            cropId: row.cropId ? String(row.cropId) : undefined,
                            cropLabel: row.cropNameEnglish || "",
                            cropName: row.varietyNameEnglish || row.cropNameEnglish || "Crop Item",
                            imageUri: row.varietyImage || row.cropImage || "",
                            totalWeightKg: 0,
                            totalCrates: 0,
                            gradeSets: [],
                        });
                    }

                    const itemObj = itemsMap.get(itemId);

                    if (row.crateId) {
                        const crateCount = parseInt(row.crateCount, 10) || 0;
                        const weightKg = parseFloat(row.qty) || 0;
                        const gradeLetter = (row.grade || "A").trim().toUpperCase();

                        itemObj.totalCrates += crateCount;
                        itemObj.totalWeightKg += weightKg;

                        itemObj.gradeSets.push({
                            grade: `Grade ${gradeLetter}`,
                            gradeKey: gradeLetter,
                            set: parseInt(row.crateIndex, 10) || 1,
                            crates: crateCount,
                            weightKg: weightKg,
                        });
                    }
                });

                const formattedItems = Array.from(itemsMap.values());

                resolve({
                    transportId: String(loadHeader.id),
                    transferCode: loadHeader.transferCode || "",
                    vehicleNo: loadHeader.vehicleNo || "N/A",
                    driverEmpId: loadHeader.driverEmpId || "",
                    driverName: (loadHeader.driverName || "").trim(),
                    centreName: loadHeader.destination || "N/A",
                    createdAt: loadHeader.createdAt,
                    items: formattedItems,
                });
            });
        });
    });
};

function formatTime(dateValue) {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const mm = minutes < 10 ? `0${minutes}` : minutes;
    return `At ${hours}:${mm} ${ampm}`;
}

const { DRIVER_ROLES } = require("../../constants/user-roles");
const HEAVY_WEIGHT_DRIVER_ROLE = DRIVER_ROLES.HEAVY_WEIGHT_DRIVER;

exports.getDriverByQRCode = (qrData, extractedEmpId = null) => {
    return new Promise((resolve, reject) => {
        if (!qrData && !extractedEmpId) {
            return reject(new Error("QR data is required"));
        }

        const searchParams = [qrData, qrData];
        let whereClause = "(co.QRcode = ? OR co.empId = ?";

        if (extractedEmpId) {
            whereClause += " OR co.empId = ? OR co.QRcode = ?";
            searchParams.push(extractedEmpId, extractedEmpId);
        }
        whereClause += ")";

        const sql = `
      SELECT
          co.id,
          co.empId,
          co.firstNameEnglish,
          co.lastNameEnglish,
          co.jobRole,
          co.status,
          co.claimStatus,
          vr.id AS vehicleId,
          vr.vRegNo,
          vr.vType,
          vr.vCapacity,
          vr.licNo,
          vr.insNo
      FROM collectionofficer co
      LEFT JOIN vehicleregistration vr ON vr.coId = co.id
      WHERE ${whereClause}
      LIMIT 1
    `;

        collectionofficer.query(sql, searchParams, (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return reject(err);
            }

            if (results.length === 0) {
                return resolve(null); // not found -> invalid QR
            }

            resolve(results[0]);
        });
    });
};

exports.verifyLoadQR = (qrData, officerId = null) => {
    return new Promise((resolve, reject) => {
        if (!qrData) {
            return resolve({
                success: false,
                code: "INVALID_QR",
                message: "Invalid QR code.\nPlease scan a valid Load QR code.",
            });
        }

        let cleanCode = qrData.trim();
        try {
            const parsed = JSON.parse(qrData);
            if (parsed && typeof parsed === "object") {
                const codeVal = parsed.transferCode || parsed.loadCode || parsed.code;
                if (codeVal && typeof codeVal === "string") {
                    cleanCode = codeVal.trim();
                }
            }
        } catch (e) {
            // Raw string
        }

        // Must match format "L-DRV00001260912001" -> ^L-DRV\d+$
        if (!cleanCode || !/^L-DRV\d+$/i.test(cleanCode)) {
            return resolve({
                success: false,
                code: "INVALID_QR",
                message: "Invalid QR code.\nPlease scan a valid Load QR code.",
            });
        }

        const sql = `
          SELECT 
              tl.id,
              tl.transferCode,
              tl.disComCenId,
              tl.comCenId,
              tl.driverId,
              tl.createdAt,
              dcc.companyId AS dccCompanyId,
              dcc.centerId AS dccCenterId
          FROM transportload tl
          LEFT JOIN distributedcompanycenter dcc ON dcc.id = tl.disComCenId
          WHERE tl.transferCode = ?
          LIMIT 1
        `;

        collectionofficer.query(sql, [cleanCode], (err, loadResults) => {
            if (err) {
                console.error("Database error in verifyLoadQR:", err);
                return reject(err);
            }

            if (!loadResults || loadResults.length === 0) {
                return resolve({
                    success: false,
                    code: "INVALID_QR",
                    message: "Invalid QR code.\nPlease scan a valid Load QR code.",
                });
            }

            const load = loadResults[0];

            // If officerId is provided, check relevancy to officer's distribution center
            if (officerId) {
                const officerSql = `
                  SELECT id, centerId, distributedCenterId, companyId, jobRole
                  FROM collectionofficer
                  WHERE id = ?
                  LIMIT 1
                `;

                collectionofficer.query(officerSql, [officerId], async (err2, officerResults) => {
                    if (err2) {
                        console.error("Database error checking officer in verifyLoadQR:", err2);
                        return reject(err2);
                    }

                    if (officerResults && officerResults.length > 0) {
                        const officer = officerResults[0];

                        // Check if officer matches the load's disComCenId
                        let isAuthorized = false;

                        if (load.disComCenId == null) {
                            if (officer.companyId && load.dccCompanyId && officer.companyId === load.dccCompanyId) {
                                isAuthorized = true;
                            } else {
                                isAuthorized = true;
                            }
                        } else {
                            if (
                                (officer.distributedCenterId == null && officer.companyId && officer.companyId === load.dccCompanyId) ||
                                (officer.distributedCenterId === load.dccCenterId && (officer.companyId === load.dccCompanyId || officer.companyId == null)) ||
                                (officer.distributedCenterId === load.disComCenId) ||
                                (officer.companyId && load.dccCompanyId && officer.companyId === load.dccCompanyId)
                            ) {
                                isAuthorized = true;
                            }
                        }

                        if (!isAuthorized) {
                            return resolve({
                                success: false,
                                code: "DISTRIBUTION_CENTER_MISMATCH",
                                message: "This load is assigned to a different distribution center.",
                            });
                        }
                    }

                    try {
                        const loadDetails = await exports.getTransportLoadDetails(load.id);
                        return resolve({
                            success: true,
                            data: loadDetails,
                            message: "Load QR verified successfully.",
                        });
                    } catch (detailErr) {
                        return reject(detailErr);
                    }
                });
            } else {
                exports.getTransportLoadDetails(load.id)
                    .then((loadDetails) => {
                        resolve({
                            success: true,
                            data: loadDetails,
                            message: "Load QR verified successfully.",
                        });
                    })
                    .catch(reject);
            }
        });
    });
};

exports.finishUnloading = (transportId, loadCode, officerId, unloadedItems = []) => {
    return new Promise((resolve, reject) => {
        if (!officerId) {
            return reject(new Error("Officer ID is required"));
        }
        if (!transportId && !loadCode) {
            return reject(new Error("Transport ID or Load Code is required"));
        }

        collectionofficer.getConnection(async (connErr, connection) => {
            if (connErr) {
                return reject(connErr);
            }

            try {
                await connection.promise().beginTransaction();

                // 1. Find transport load
                const [loadRows] = await connection.promise().query(
                    "SELECT id, transferCode FROM transportload WHERE id = ? OR transferCode = ? LIMIT 1",
                    [transportId || null, loadCode || null]
                );

                if (loadRows.length === 0) {
                    await connection.promise().rollback();
                    connection.release();
                    return resolve({
                        success: false,
                        message: "Transport load not found",
                    });
                }

                const actualTransportId = loadRows[0].id;

                // 2. Update transportload with officer and timestamp
                await connection.promise().query(
                    "UPDATE transportload SET unloadOfficerId = ?, unloadTime = NOW() WHERE id = ?",
                    [officerId, actualTransportId]
                );

                // 3. Save into unloadedcrates if unloadedItems are provided
                if (Array.isArray(unloadedItems) && unloadedItems.length > 0) {
                    // Fetch existing loadeditems for this transport
                    const [existingLoadedItems] = await connection.promise().query(
                        "SELECT id, varietyId FROM loadeditems WHERE transportId = ?",
                        [actualTransportId]
                    );

                    const loadedItemByVariety = new Map();
                    const loadedItemById = new Map();
                    existingLoadedItems.forEach((li) => {
                        loadedItemById.set(li.id, li.id);
                        if (li.varietyId) {
                            loadedItemByVariety.set(String(li.varietyId), li.id);
                        }
                    });

                    for (const item of unloadedItems) {
                        // Determine loadId (the id in loadeditems)
                        let targetLoadId = null;
                        if (item.loadedItemId && loadedItemById.has(parseInt(item.loadedItemId, 10))) {
                            targetLoadId = parseInt(item.loadedItemId, 10);
                        } else if (item.varietyId && loadedItemByVariety.has(String(item.varietyId))) {
                            targetLoadId = loadedItemByVariety.get(String(item.varietyId));
                        } else if (item.id && loadedItemByVariety.has(String(item.id))) {
                            targetLoadId = loadedItemByVariety.get(String(item.id));
                        } else if (item.id && loadedItemById.has(parseInt(item.id, 10))) {
                            targetLoadId = parseInt(item.id, 10);
                        }

                        if (!targetLoadId && item.varietyId) {
                            const [newLi] = await connection.promise().query(
                                "INSERT INTO loadeditems (transportId, varietyId) VALUES (?, ?)",
                                [actualTransportId, item.varietyId]
                            );
                            targetLoadId = newLi.insertId;
                            loadedItemById.set(targetLoadId, targetLoadId);
                            loadedItemByVariety.set(String(item.varietyId), targetLoadId);
                        }

                        if (targetLoadId && Array.isArray(item.grades) && item.grades.length > 0) {
                            // Delete previous unloadedcrates for this loadId if any
                            await connection.promise().query(
                                "DELETE FROM unloadedcrates WHERE loadId = ?",
                                [targetLoadId]
                            );

                            for (const g of item.grades) {
                                const rawGrade = (g.grade || g.gradeKey || "A").trim().toUpperCase();
                                const cleanGrade = rawGrade.replace(/^GRADE\s*/i, "");
                                const validGrade = ["A", "B", "C"].includes(cleanGrade) ? cleanGrade : "A";

                                const crateCount = parseInt(g.crateCount ?? g.crates, 10) || 0;
                                const crateIndex = parseInt(g.crateIndex ?? g.set ?? g.setIndex, 10) || 1;
                                const qty = parseFloat(g.qty ?? g.weightKg ?? g.weight) || 0;

                                await connection.promise().query(
                                    "INSERT INTO unloadedcrates (loadId, grade, crateCount, crateIndex, qty) VALUES (?, ?, ?, ?, ?)",
                                    [targetLoadId, validGrade, crateCount, crateIndex, qty]
                                );
                            }
                        }
                    }
                }

                await connection.promise().commit();
                connection.release();

                resolve({
                    success: true,
                    message: "Transport load marked as unloaded successfully",
                });
            } catch (txError) {
                await connection.promise().rollback();
                connection.release();
                console.error("Database error in finishUnloading:", txError);
                reject(txError);
            }
        });
    });
};

exports.HEAVY_WEIGHT_DRIVER_ROLE = HEAVY_WEIGHT_DRIVER_ROLE;

exports.getAllDistributionCentres = (officerId = null) => {
    return new Promise((resolve, reject) => {
        let sql;
        let params = [];

        if (officerId) {
            sql = `
              SELECT
                  dc.id,
                  COALESCE(
                      (SELECT dcc1.id FROM distributedcompanycenter dcc1 
                       WHERE dcc1.centerId = dc.id 
                         AND dcc1.companyId = (SELECT companyId FROM collectionofficer WHERE id = ? LIMIT 1) 
                       LIMIT 1),
                      (SELECT dcc2.id FROM distributedcompanycenter dcc2 
                       WHERE dcc2.centerId = dc.id 
                       LIMIT 1)
                  ) AS disComCenId,
                  dc.centerName,
                  dc.city,
                  dc.district,
                  dc.province,
                  dc.country,
                  dc.longitude,
                  dc.latitude
              FROM distributedcenter dc
              ORDER BY dc.centerName ASC
            `;
            params = [officerId];
        } else {
            sql = `
              SELECT
                  dc.id,
                  (SELECT dcc2.id FROM distributedcompanycenter dcc2 WHERE dcc2.centerId = dc.id LIMIT 1) AS disComCenId,
                  dc.centerName,
                  dc.city,
                  dc.district,
                  dc.province,
                  dc.country,
                  dc.longitude,
                  dc.latitude
              FROM distributedcenter dc
              ORDER BY dc.centerName ASC
            `;
        }

        collectionofficer.query(sql, params, (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return reject(err);
            }

            const formatted = results.map((row) => ({
                id: String(row.id),
                disComCenId: row.disComCenId ? String(row.disComCenId) : null,
                name: row.centerName,
                code: [row.city, row.district].filter(Boolean).join(", "),
            }));

            resolve(formatted);
        });
    });
};


exports.getOfficerCompanyCenter = (officerId) => {
    return new Promise((resolve, reject) => {
        const sql = `
      SELECT 
          co.id AS officerId,
          co.empId,
          co.centerId,
          co.companyId,
          cc.id AS companyCenterId
      FROM collectionofficer co
      INNER JOIN companycenter cc
          ON cc.centerId = co.centerId AND cc.companyId = co.companyId
      WHERE co.id = ?
      LIMIT 1
    `;

        collectionofficer.query(sql, [officerId], (err, results) => {
            if (err) {
                console.error("Database error getting officer company center:", err);
                return reject(err);
            }
            if (results.length === 0) {
                return resolve(null);
            }
            resolve(results[0]);
        });
    });
};

exports.getOfficerCompanyCenterId = (officerId) => {
    return new Promise((resolve, reject) => {
        const sql = `
      SELECT cc.id AS companyCenterId
      FROM collectionofficer co
      INNER JOIN companycenter cc
          ON cc.centerId = co.centerId AND cc.companyId = co.companyId
      WHERE co.id = ?
      LIMIT 1
    `;

        collectionofficer.query(sql, [officerId], (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return reject(err);
            }
            if (results.length === 0) {
                return resolve(null);
            }
            resolve(results[0].companyCenterId);
        });
    });
};

// Gets crops + varieties assigned to the login officer's company center (centercrops)
exports.getCropsAndVarietiesForCenter = (companyCenterId) => {
    return new Promise((resolve, reject) => {
        if (!companyCenterId) {
            return resolve({ crops: [], varieties: {} });
        }

        const sql = `
      SELECT
          cg.id AS cropId,
          cg.cropNameEnglish,
          cg.cropNameSinhala,
          cg.cropNameTamil,
          cg.image AS cropImage,
          cg.bgColor AS cropBgColor,
          cv.id AS varietyId,
          cv.varietyNameEnglish,
          cv.varietyNameSinhala,
          cv.varietyNameTamil,
          cv.image AS varietyImage,
          cv.bgColor AS varietyBgColor
      FROM centercrops ccr
      INNER JOIN plant_care.cropvariety cv ON ccr.varietyId = cv.id
      INNER JOIN plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      WHERE ccr.companyCenterId = ?
      ORDER BY cg.cropNameEnglish ASC, cv.varietyNameEnglish ASC
    `;

        const processResults = (results) => {
            const cropsMap = new Map();
            const varietiesByCrop = {};

            results.forEach((row) => {
                const cropValue = String(row.cropId);

                if (!cropsMap.has(cropValue)) {
                    cropsMap.set(cropValue, {
                        label: row.cropNameEnglish,
                        value: cropValue,
                        cropNameEnglish: row.cropNameEnglish,
                        cropNameSinhala: row.cropNameSinhala,
                        cropNameTamil: row.cropNameTamil,
                        image: row.cropImage,
                        bgColor: row.cropBgColor,
                    });
                    varietiesByCrop[cropValue] = [];
                }

                varietiesByCrop[cropValue].push({
                    label: row.varietyNameEnglish,
                    value: String(row.varietyId),
                    varietyNameEnglish: row.varietyNameEnglish,
                    varietyNameSinhala: row.varietyNameSinhala,
                    varietyNameTamil: row.varietyNameTamil,
                    image: row.varietyImage || row.cropImage,
                    bgColor: row.varietyBgColor,
                });
            });

            return {
                crops: Array.from(cropsMap.values()),
                varieties: varietiesByCrop,
            };
        };

        collectionofficer.query(sql, [companyCenterId], (err, results) => {
            if (err) {
                console.error("Database error fetching crops and varieties for center:", err);
                return reject(err);
            }

            resolve(processResults(results));
        });
    });
};

// Saves a complete transport load into transportload, loadeditems, and loadedcrates
exports.saveTransportLoad = ({ officerId, driverId, centreId, disComCenId, items }) => {
    return new Promise((resolve, reject) => {
        collectionofficer.getConnection(async (err, connection) => {
            if (err) {
                return reject(err);
            }

            try {
                await connection.promise().beginTransaction();

                // 1. Get companyCenterId and companyId for officer
                let comCenId = null;
                let companyId = null;
                let officerEmpId = null;

                const officerQuery = `
                  SELECT cc.id AS companyCenterId, co.companyId, co.empId
                  FROM collectionofficer co
                  INNER JOIN companycenter cc
                      ON cc.centerId = co.centerId AND cc.companyId = co.companyId
                  WHERE co.id = ?
                  LIMIT 1
                `;
                const [officerRows] = await connection.promise().query(officerQuery, [officerId]);
                if (officerRows.length > 0) {
                    comCenId = officerRows[0].companyCenterId;
                    companyId = officerRows[0].companyId;
                    officerEmpId = officerRows[0].empId;
                } else {
                    const [coRows] = await connection.promise().query(
                        "SELECT companyId, centerId, empId FROM collectionofficer WHERE id = ? LIMIT 1",
                        [officerId]
                    );
                    if (coRows.length > 0) {
                        companyId = coRows[0].companyId;
                        officerEmpId = coRows[0].empId;
                        const [ccFallback] = await connection.promise().query(
                            "SELECT id FROM companycenter WHERE companyId = ? LIMIT 1",
                            [companyId]
                        );
                        if (ccFallback.length > 0) {
                            comCenId = ccFallback[0].id;
                        }
                    }
                }

                if (!comCenId) {
                    throw new Error("Officer's company center not found");
                }

                // 2. Resolve distributedCompanyCenterId (disComCenId)
                let resolvedDisComCenId = null;

                // Step 2a: If disComCenId was passed, check if it exists in distributedcompanycenter
                if (disComCenId) {
                    const parsedId = parseInt(disComCenId, 10);
                    if (!isNaN(parsedId)) {
                        const [checkRows] = await connection.promise().query(
                            "SELECT id FROM distributedcompanycenter WHERE id = ? LIMIT 1",
                            [parsedId]
                        );
                        if (checkRows.length > 0) {
                            resolvedDisComCenId = checkRows[0].id;
                        }
                    }
                }

                // Step 2b: If not resolved yet, resolve using centreId or disComCenId as centerId
                const targetCenterId = parseInt(centreId || disComCenId, 10);
                if (!resolvedDisComCenId && !isNaN(targetCenterId)) {
                    // Check if matched with companyId
                    if (companyId) {
                        const [disCenterRows] = await connection.promise().query(
                            "SELECT id FROM distributedcompanycenter WHERE companyId = ? AND centerId = ? LIMIT 1",
                            [companyId, targetCenterId]
                        );
                        if (disCenterRows.length > 0) {
                            resolvedDisComCenId = disCenterRows[0].id;
                        }
                    }

                    // Fallback to any distributedcompanycenter matching centerId
                    if (!resolvedDisComCenId) {
                        const [anyDccRows] = await connection.promise().query(
                            "SELECT id FROM distributedcompanycenter WHERE centerId = ? LIMIT 1",
                            [targetCenterId]
                        );
                        if (anyDccRows.length > 0) {
                            resolvedDisComCenId = anyDccRows[0].id;
                        }
                    }

                    // If still not found, create new mapping in distributedcompanycenter
                    if (!resolvedDisComCenId) {
                        const [insertDcc] = await connection.promise().query(
                            "INSERT INTO distributedcompanycenter (companyId, centerId, createdAt) VALUES (?, ?, NOW())",
                            [companyId || 1, targetCenterId]
                        );
                        resolvedDisComCenId = insertDcc.insertId;
                    }
                }

                // Step 2c: Ultimate fallback
                if (!resolvedDisComCenId) {
                    const [firstDcc] = await connection.promise().query(
                        "SELECT id FROM distributedcompanycenter LIMIT 1"
                    );
                    if (firstDcc.length > 0) {
                        resolvedDisComCenId = firstDcc[0].id;
                    }
                }

                // 3. Generate transferCode: L-{driverEmpId}{YYMMDD}{seq3}
                let driverEmpId = "DRV00000";
                if (driverId) {
                    const [driverRows] = await connection.promise().query(
                        "SELECT empId FROM collectionofficer WHERE id = ? LIMIT 1",
                        [driverId]
                    );
                    if (driverRows.length > 0 && driverRows[0].empId) {
                        driverEmpId = driverRows[0].empId;
                    }
                }

                const now = new Date();
                const yy = String(now.getFullYear()).slice(-2);
                const mm = String(now.getMonth() + 1).padStart(2, "0");
                const dd = String(now.getDate()).padStart(2, "0");
                const yymmdd = `${yy}${mm}${dd}`;
                const prefix = `L-${driverEmpId}${yymmdd}`;

                // Find highest existing sequence for this prefix
                const [existingCodeRows] = await connection.promise().query(
                    "SELECT transferCode FROM transportload WHERE transferCode LIKE ? ORDER BY transferCode DESC LIMIT 1",
                    [`${prefix}%`]
                );

                let nextSeq = 1;
                if (existingCodeRows.length > 0 && existingCodeRows[0].transferCode) {
                    const lastCode = existingCodeRows[0].transferCode;
                    const lastSeqStr = lastCode.slice(prefix.length);
                    const parsedSeq = parseInt(lastSeqStr, 10);
                    if (!isNaN(parsedSeq)) {
                        nextSeq = parsedSeq + 1;
                    }
                }
                const seqStr = String(nextSeq).padStart(3, "0");
                const transferCode = `${prefix}${seqStr}`;

                // 4. Insert into transportload
                const insertLoadQuery = `
                  INSERT INTO transportload (
                    driverId,
                    comCenId,
                    disComCenId,
                    unloadOfficerId,
                    transferCode,
                    recomandation,
                    rcmdBy,
                    unloadTime,
                    createdAt
                  ) VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL, NOW())
                `;
                const [loadResult] = await connection.promise().query(insertLoadQuery, [
                    driverId || null,
                    comCenId,
                    resolvedDisComCenId,
                    transferCode,
                ]);

                const transportId = loadResult.insertId;

                // 5. Insert loadeditems and loadedcrates
                if (Array.isArray(items) && items.length > 0) {
                    for (const item of items) {
                        const varietyId = item.varietyId || item.id;
                        const insertItemQuery = `
                          INSERT INTO loadeditems (transportId, varietyId)
                          VALUES (?, ?)
                        `;
                        const [itemResult] = await connection.promise().query(insertItemQuery, [
                            transportId,
                            varietyId,
                        ]);
                        const loadId = itemResult.insertId;

                        if (Array.isArray(item.gradeSets) && item.gradeSets.length > 0) {
                            for (const gs of item.gradeSets) {
                                const grade = gs.gradeKey || (gs.grade ? gs.grade.replace(/Grade\s*/i, "").trim() : "A");
                                const crateCount = parseInt(gs.crates, 10) || 0;
                                const crateIndex = parseInt(gs.set, 10) || 1;
                                const qty = parseFloat(gs.weightKg ?? gs.weight) || 0;

                                const insertCrateQuery = `
                                  INSERT INTO loadedcrates (loadId, grade, crateCount, crateIndex, qty)
                                  VALUES (?, ?, ?, ?, ?)
                                `;
                                await connection.promise().query(insertCrateQuery, [
                                    loadId,
                                    grade,
                                    crateCount,
                                    crateIndex,
                                    qty,
                                ]);
                            }
                        }
                    }
                }

                await connection.promise().commit();
                connection.release();

                resolve({
                    success: true,
                    transportId,
                    transferCode,
                    disComCenId: resolvedDisComCenId,
                    message: "Transport load created successfully",
                });
            } catch (txError) {
                await connection.promise().rollback();
                connection.release();
                console.error("Transaction error saving transport load:", txError);
                reject(txError);
            }
        });
    });
};
