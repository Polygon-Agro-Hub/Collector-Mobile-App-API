const jwt = require("jsonwebtoken");
const db = require("../startup/database");

exports.insertFarmerPayment = (farmerId, userId, invoiceNumber) => {
  return new Promise((resolve, reject) => {
    const paymentQuery = `
            INSERT INTO registeredfarmerpayments (userId, collectionOfficerId, InvNo) 
            VALUES (?, ?, ?)
        `;
    const paymentValues = [farmerId, userId, invoiceNumber];

    db.collectionofficer.query(paymentQuery, paymentValues, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result.insertId);
    });
  });
};

exports.insertCropDetails = (registeredFarmerId, crop, officerId, centerId) => {
  return new Promise((resolve, reject) => {
    const {
      varietyId,
      gradeAprice,
      gradeBprice,
      gradeCprice,
      gradeAquan,
      gradeBquan,
      gradeCquan,
      imageAUrl,
      imageBUrl,
      imageCUrl,
    } = crop;

    const cropQuery = `
      INSERT INTO farmerpaymentscrops (
        registerFarmerId, cropId, gradeAprice, gradeBprice, gradeCprice,
        gradeAquan, gradeBquan, gradeCquan, imageA, imageB, imageC
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const cropValues = [
      registeredFarmerId,
      varietyId,
      gradeAprice || 0,
      gradeBprice || 0,
      gradeCprice || 0,
      gradeAquan || 0,
      gradeBquan || 0,
      gradeCquan || 0,
      imageAUrl,
      imageBUrl,
      imageCUrl,
    ];

    db.collectionofficer.getConnection((err, connection) => {
      if (err) {
        return reject(err);
      }

      connection.beginTransaction((transactionErr) => {
        if (transactionErr) {
          connection.release();
          return reject(transactionErr);
        }

        connection.query(cropQuery, cropValues, (insertErr, insertResult) => {
          if (insertErr) {
            return connection.rollback(() => {
              connection.release();
              reject(insertErr);
            });
          }

          const updateOfficerQuery = `
          UPDATE officertarget ot
JOIN dailytarget dt ON ot.dailyTargetId = dt.id
SET ot.complete = CAST(
  CAST(ot.complete AS DECIMAL(15,2)) + 
    CASE dt.grade
      WHEN 'A' THEN ?
      WHEN 'B' THEN ?
      WHEN 'C' THEN ?
      ELSE 0
    END
  AS CHAR
)
WHERE dt.varietyId = ?
AND ot.officerId = ?
AND DATE(dt.date) = CURDATE()

        `;

          const updateOfficerValues = [
            gradeAquan || 0,
            gradeBquan || 0,
            gradeCquan || 0,
            varietyId,
            officerId,
          ];

          connection.query(
            updateOfficerQuery,
            updateOfficerValues,
            (updateOfficerErr, updateOfficerResult) => {
              if (updateOfficerErr) {
                return connection.rollback(() => {
                  connection.release();
                  reject(updateOfficerErr);
                });
              }

              const updateCenterQuery = `
            UPDATE dailytarget dt
JOIN companycenter cc ON dt.companyCenterId = cc.id 
SET dt.complete = CAST(
  CAST(dt.complete AS DECIMAL(15,2)) + 
    CASE dt.grade
      WHEN 'A' THEN ?
      WHEN 'B' THEN ?
      WHEN 'C' THEN ?
      ELSE 0
    END
  AS CHAR
)
WHERE dt.varietyId = ?
AND cc.centerId = ? 
AND DATE(dt.date) = CURDATE()
AND EXISTS (
  SELECT 1 FROM officertarget ot 
  WHERE ot.dailyTargetId = dt.id
  AND ot.officerId = ?
)
          `;

              const updateCenterValues = [
                gradeAquan || 0,
                gradeBquan || 0,
                gradeCquan || 0,
                varietyId,
                centerId,
                officerId,
              ];

              connection.query(
                updateCenterQuery,
                updateCenterValues,
                (updateCenterErr, updateCenterResult) => {
                  if (updateCenterErr) {
                    return connection.rollback(() => {
                      connection.release();
                      reject(updateCenterErr);
                    });
                  }

                  connection.commit((commitErr) => {
                    if (commitErr) {
                      return connection.rollback(() => {
                        connection.release();
                        reject(commitErr);
                      });
                    }

                    connection.release();
                    resolve({
                      cropInserted: true,
                      officerTargetUpdated:
                        updateOfficerResult.affectedRows > 0,
                      centerTargetUpdated: updateCenterResult.affectedRows > 0,
                      cropId: insertResult.insertId,
                      officerUpdatedRows: updateOfficerResult.affectedRows,
                      centerUpdatedRows: updateCenterResult.affectedRows,
                    });
                  });
                },
              );
            },
          );
        });
      });
    });
  });
};

exports.getCropDetailsByUserAndFarmerId = async (
  userId,
  registeredFarmerId,
) => {
  const query = `
    SELECT 
      fpc.id AS id, 
      cg.cropNameEnglish AS cropName,
      cg.cropNameSinhala AS cropNameSinhala,
      cg.cropNameTamil AS cropNameTamil,
      cv.varietyNameEnglish AS variety,
      cv.varietyNameSinhala AS varietyNameSinhala,
      cv.varietyNameTamil AS varietyNameTamil,
      fpc.gradeAprice AS unitPriceA,
      fpc.gradeAquan AS weightA,
      fpc.gradeBprice AS unitPriceB,
      fpc.gradeBquan AS weightB,
      fpc.gradeCprice AS unitPriceC,
      fpc.gradeCquan AS weightC,
      rfp.InvNo AS invoiceNumber
    FROM 
      farmerpaymentscrops fpc
    INNER JOIN 
      plant_care.cropvariety cv ON fpc.cropId = cv.id
    INNER JOIN 
      plant_care.cropgroup cg ON cv.cropGroupId = cg.id
    INNER JOIN 
      registeredfarmerpayments rfp ON fpc.registerFarmerId = rfp.id
    WHERE 
      rfp.userId = ? AND fpc.registerFarmerId = ?
    ORDER BY 
      fpc.createdAt DESC
  `;

  return new Promise((resolve, reject) => {
    db.collectionofficer.query(
      query,
      [userId, registeredFarmerId],
      (error, results) => {
        if (error) return reject(error);

        const transformedResults = results.flatMap((row) => {
          const entries = [];

          if (row.weightA > 0)
            entries.push({
              id: row.id,
              cropName: row.cropName,
              cropNameSinhala: row.cropNameSinhala,
              cropNameTamil: row.cropNameTamil,
              variety: row.variety,
              varietyNameSinhala: row.varietyNameSinhala,
              varietyNameTamil: row.varietyNameTamil,
              grade: "A",
              unitPrice: row.unitPriceA,
              quantity: row.weightA,
              subTotal: (row.unitPriceA * row.weightA).toFixed(2),
              invoiceNumber: row.invoiceNumber,
            });

          if (row.weightB > 0)
            entries.push({
              id: row.id,
              cropName: row.cropName,
              cropNameSinhala: row.cropNameSinhala,
              cropNameTamil: row.cropNameTamil,
              variety: row.variety,
              varietyNameSinhala: row.varietyNameSinhala,
              varietyNameTamil: row.varietyNameTamil,
              grade: "B",
              unitPrice: row.unitPriceB,
              quantity: row.weightB,
              subTotal: (row.unitPriceB * row.weightB).toFixed(2),
              invoiceNumber: row.invoiceNumber,
            });

          if (row.weightC > 0)
            entries.push({
              id: row.id,
              cropName: row.cropName,
              cropNameSinhala: row.cropNameSinhala,
              cropNameTamil: row.cropNameTamil,
              varietyNameSinhala: row.varietyNameSinhala,
              varietyNameTamil: row.varietyNameTamil,
              variety: row.variety,
              grade: "C",
              unitPrice: row.unitPriceC,
              quantity: row.weightC,
              subTotal: (row.unitPriceC * row.weightC).toFixed(2),
              invoiceNumber: row.invoiceNumber,
            });

          return entries;
        });

        resolve(transformedResults);
      },
    );
  });
};

exports.getAllCropNames = (officerId, startDate = null, endDate = null) => {
  return new Promise((resolve, reject) => {
    if (!officerId) {
      return reject(new Error("Officer ID is required"));
    }

    let cropQuery = `
      SELECT DISTINCT
        cg.id,
        cg.cropNameEnglish,
        cg.cropNameSinhala,
        cg.cropNameTamil
      FROM 
        collection_officer.officertarget ot
      INNER JOIN
        collection_officer.dailytarget dt ON ot.dailyTargetId = dt.id
      INNER JOIN
        plant_care.cropvariety cv ON dt.varietyId = cv.id
      INNER JOIN
        plant_care.cropgroup cg ON cv.cropGroupId = cg.id
      WHERE
        ot.officerId = ?
    `;

    const params = [officerId];

    if (startDate) {
      cropQuery += ` AND DATE(dt.date) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      cropQuery += ` AND DATE(dt.date) <= ?`;
      params.push(endDate);
    }

    cropQuery += `
      ORDER BY
        cg.cropNameEnglish,
        cg.cropNameSinhala,
        cg.cropNameTamil
    `;

    db.collectionofficer.query(cropQuery, params, (error, results) => {
      if (error) {
        console.error("Error fetching officer crop details:", error);
        return reject(error);
      }
      console.log("Crop details fetched successfully:", results);
      resolve(results);
    });
  });
};

exports.getVarietiesByCropId = (
  officerId,
  cropId,
  startDate = null,
  endDate = null,
) => {
  return new Promise((resolve, reject) => {
    if (!officerId || !cropId) {
      return reject(new Error("Officer ID and Crop ID are required"));
    }

    let varietyQuery = `
      SELECT DISTINCT
          cv.id,
          cv.varietyNameEnglish,
          cv.varietyNameSinhala,
          cv.varietyNameTamil
      FROM 
          officertarget ot
      INNER JOIN
          dailytarget dt ON ot.dailyTargetId = dt.id
      INNER JOIN
          plant_care.cropvariety cv ON dt.varietyId = cv.id
      WHERE
          ot.officerId = ?
          AND cv.cropGroupId = ?
    `;

    const params = [officerId, cropId];

    if (startDate) {
      varietyQuery += ` AND DATE(dt.date) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      varietyQuery += ` AND DATE(dt.date) <= ?`;
      params.push(endDate);
    }

    varietyQuery += `
      ORDER BY
          cv.varietyNameEnglish,
          cv.varietyNameSinhala,
          cv.varietyNameTamil
    `;

    db.collectionofficer.query(varietyQuery, params, (error, results) => {
      if (error) {
        console.error("Error fetching varieties for officer and crop:", error);
        return reject(error);
      }

      const formattedResults = results.map((variety) => ({
        id: variety.id,
        varietyEnglish: variety.varietyNameEnglish,
        varietySinhala: variety.varietyNameSinhala,
        varietyTamil: variety.varietyNameTamil,
      }));

      resolve(formattedResults);
    });
  });
};

exports.getMarketPricesByVarietyId = (varietyId, companycenterId) => {
  return new Promise((resolve, reject) => {
    const query = `
          SELECT 
        mp.grade, 
        mps.updatedPrice AS price 
      FROM marketprice mp
      JOIN marketpriceserve mps ON mp.id = mps.marketPriceId  
      WHERE mp.varietyId = ? 
      AND mps.companyCenterId = ?;
    `;
    db.collectionofficer.query(
      query,
      [varietyId, companycenterId],
      (error, results) => {
        if (error) {
          return reject(error);
        }
        resolve(results);
      },
    );
  });
};

exports.getLatestInvoiceNumberDao = (empId, currentDate) => {
  return new Promise((resolve, reject) => {
    const query = `
        SELECT invNo 
        FROM registeredfarmerpayments 
        WHERE invNo LIKE ? 
        ORDER BY id DESC 
        LIMIT 1
      `;

    const searchPattern = `${empId}${currentDate}%`;

    db.collectionofficer.query(query, [searchPattern], (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results.length > 0 ? results[0] : null);
    });
  });
};

exports.createCollection = (
  crop,
  variety,
  loadIn,
  routeNumber,
  buildingNo,
  streetName,
  city,
) => {
  return new Promise((resolve, reject) => {
    const sql =
      "INSERT INTO geolocation (crop, variety, loadIn, , routeNumber, buildingNo, streetName, city, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Assigned')";

    const values = [
      crop,
      variety,
      loadIn,
      ,
      routeNumber,
      buildingNo,
      streetName,
      city,
    ];

    db.collectionofficer.query(sql, values, (err, result) => {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

exports.getAllCropNamesForCollection = () => {
  return new Promise((resolve, reject) => {
    const query =
      "SELECT id, cropNameEnglish, cropNameSinhala, cropNameTamil FROM cropgroup";

    db.plantcare.query(query, (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
};

exports.getVarietiesByCropIdCollection = (officerId, cropId) => {
  return new Promise((resolve, reject) => {
    if (!officerId || !cropId) {
      return reject(new Error("Officer ID and Crop ID are required"));
    }

    const varietyQuery = `
      SELECT DISTINCT
          cv.id,
          cv.varietyNameEnglish AS varietyEnglish,
          cv.varietyNameSinhala AS varietySinhala,
          cv.varietyNameTamil AS varietyTamil
      FROM 
          plant_care.cropvariety cv
      WHERE
          cv.cropGroupId = ?
      ORDER BY
          cv.varietyNameEnglish
    `;

    db.collectionofficer.query(varietyQuery, [cropId], (error, results) => {
      if (error) {
        console.error("Detailed Query Error:", {
          error: error,
          sqlMessage: error.sqlMessage,
          sqlState: error.sqlState,
          code: error.code,
        });
        return reject(error);
      }

      resolve(results);
    });
  });
};

exports.getAllUsers = (officerId, nicNumber = null) => {
  return new Promise((resolve, reject) => {
    let userQuery = `
      SELECT 
        id, 
        firstName, 
        phoneNumber, 
        NICnumber, 
        profileImage, 
        farmerQr, 
        membership, 
        activeStatus, 
        houseNo, 
        streetName, 
        city, 
        district, 
        route,
        created_at
      FROM plant_care.users 
      WHERE activeStatus = 'active'
    `;

    const queryParams = [];
    if (nicNumber) {
      userQuery += ` AND NICnumber = ?`;
      queryParams.push(nicNumber);
    }

    db.collectionofficer.query(userQuery, queryParams, (error, results) => {
      if (error) {
        console.error("Error fetching users:", error);
        return reject(error);
      }

      const formattedUsers = results.map((user) => ({
        id: user.id,
        firstName: user.firstName || "",
        phoneNumber: user.phoneNumber || "",
        nicNumber: user.NICnumber || "",
        profileImage: user.profileImage || null,
        farmerQr: user.farmerQr || null,
        membership: user.membership || "",
        activeStatus: user.activeStatus || "",
        address: {
          buildingNo: user.houseNo || null,
          streetName: user.streetName || null,
          city: user.city || null,
          district: user.district || null,
        },
        routeNumber: user.route || null,
        createdAt: user.created_at || null,
      }));

      resolve(formattedUsers);
    });
  });
};

exports.updateUserAddress = (
  userId,
  routeNumber,
  buildingNo,
  streetName,
  city,
) => {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE plant_care.users
      SET
        route = ?,
        houseNo = ?,
        streetName = ?,
        city = ?
      WHERE id = ?
    `;

    db.plantcare.query(
      sql,
      [routeNumber, buildingNo, streetName, city, userId],
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      },
    );
  });
};

exports.createCollectionRequest = (
  farmerId,
  cmId,
  empId,
  crop,
  variety,
  loadIn,
  centerId,
  companyId,
  scheduleDate,
) => {
  return new Promise((resolve, reject) => {
    const today = new Date();
    const year = today.getFullYear().toString().substr(-2);
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    const sequenceSql = `
      SELECT COUNT(*) as count 
      FROM collection_officer.collectionrequest
      WHERE DATE(createdAt) = CURDATE()
    `;

    db.plantcare.query(sequenceSql, [], (err, countResults) => {
      if (err) return reject(err);

      const sequenceNumber = countResults[0].count + 1;
      const sequenceString = String(sequenceNumber).padStart(5, "0");
      const customId = `${empId}${year}${month}${day}${sequenceString}`;

      const checkSql = `
        SELECT id, requestId FROM collection_officer.collectionrequest
        WHERE farmerId = ? AND cmId = ? AND centerId = ? AND companyId = ? AND scheduleDate = ?
      `;

      db.plantcare.query(
        checkSql,
        [farmerId, cmId, centerId, companyId, scheduleDate],
        (err, results) => {
          if (err) return reject(err);

          if (results.length > 0) {
            resolve({
              requestIdItem: results[0].id,
              customId: results[0].requestId,
            });
          } else {
            const insertSql = `
            INSERT INTO collection_officer.collectionrequest
            (farmerId, cmId, centerId, companyId, requestId, requestStatus, scheduleDate,cancelStatus, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())
          `;

            db.plantcare.query(
              insertSql,
              [
                farmerId,
                cmId,
                centerId,
                companyId,
                customId,
                "Not Assigned",
                scheduleDate,
              ],
              (err, result) => {
                if (err) return reject(err);

                resolve({
                  requestIdItem: result.insertId,
                  customId: customId,
                });
              },
            );
          }
        },
      );
    });
  });
};

exports.createCollectionRequestItems = (
  requestId,
  cropId,
  varietyId,
  loadWeight,
) => {
  return new Promise((resolve, reject) => {
    if (!requestId) {
      return reject(
        new Error(
          "Invalid requestId: Cannot insert into collectionrequestitems.",
        ),
      );
    }

    const sql = `
      INSERT INTO collection_officer.collectionrequestitems
      (requestId, cropId, varietyId, loadWeight)
      VALUES (?, ?, ?, ?)
    `;

    db.plantcare.query(
      sql,
      [requestId, cropId, varietyId, loadWeight],
      (err, result) => {
        if (err) return reject(err);

        resolve(result);
      },
    );
  });
};
