const db = require("../startup/database");
const QRCode = require("qrcode");

exports.getDailyReport = (collectionOfficerId, fromDate, toDate) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        DATE(rfp.createdAt) AS date,
        COUNT(DISTINCT rfp.id) AS totalPayments,
        SUM(IFNULL(fpc.gradeAquan, 0) + IFNULL(fpc.gradeBquan, 0) + IFNULL(fpc.gradeCquan, 0)) AS totalWeight
      FROM 
        registeredfarmerpayments rfp
      LEFT JOIN 
        farmerpaymentscrops fpc ON rfp.id = fpc.registerFarmerId
      WHERE 
        rfp.collectionOfficerId = ? 
        AND rfp.createdAt BETWEEN ? AND ?
      GROUP BY 
        DATE(rfp.createdAt)
      ORDER BY 
        date ASC;
    `;

    const params = [collectionOfficerId, fromDate, toDate];

    db.query(query, params, (err, results) => {
      if (err) {
        return reject(err);
      }

      const reportData = results.map((row) => ({
        date: row.date,
        totalPayments: row.totalPayments,
        totalWeight: row.totalWeight ? parseFloat(row.totalWeight) : 0,
      }));

      resolve(reportData);
    });
  });
};

exports.checkNICExist = (nic) => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT COUNT(*) AS count 
          FROM collectionofficer 
          WHERE nic = ?
      `;

    db.collectionofficer.query(sql, [nic], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0);
    });
  });
};
exports.checkEmailExist = (email) => {
  return new Promise((resolve, reject) => {
    const sql = `
          SELECT COUNT(*) AS count 
          FROM collectionofficer 
          WHERE email = ?
      `;

    db.collectionofficer.query(sql, [email], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results[0].count > 0);
    });
  });
};

exports.generateEmpId = (jobRole) => {
  return new Promise((resolve, reject) => {
    try {
      let prefix = "";
      let searchPattern = "";

      if (jobRole === "Collection Officer") {
        prefix = "COO";
        searchPattern = "COO%";
      } else if (
        jobRole === "Distribution Officer" ||
        jobRole === "Distribution Centre Manager"
      ) {
        prefix = "DIO";
        searchPattern = "DIO%";
      } else {
        prefix = "EMP";
        searchPattern = "EMP%";
      }

      const sql = `
        SELECT empId 
        FROM collectionofficer 
        WHERE empId LIKE ? 
        ORDER BY CAST(SUBSTRING(empId, 4) AS UNSIGNED) DESC 
        LIMIT 1
      `;

      db.collectionofficer.query(sql, [searchPattern], (err, results) => {
        if (err) {
          console.error("Database query error in generateEmpId:", err);
          return reject(new Error("Failed to generate empId"));
        }

        let nextNumber = 1;

        if (results && results.length > 0) {
          const lastEmpId = results[0].empId;

          const numericPart = lastEmpId.substring(3);
          const lastNumber = parseInt(numericPart, 10);

          if (!isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
          }
        }

        const formattedNumber = nextNumber.toString().padStart(5, "0");
        const newEmpId = `${prefix}${formattedNumber}`;

        resolve(newEmpId);
      });
    } catch (error) {
      console.error("Unexpected error in generateEmpId:", error);
      reject(error);
    }
  });
};

exports.createCollectionOfficerPersonal = (
  officerData,
  centerId,
  companyId,
  irmId,
  jobRole,
) => {
  return new Promise((resolve, reject) => {
    try {
      let sql = `
        INSERT INTO collectionofficer (
          centerId, companyId, irmId, firstNameEnglish, firstNameSinhala, firstNameTamil, lastNameEnglish,
          lastNameSinhala, lastNameTamil, jobRole, empId, empType, phoneCode01, phoneNumber01, phoneCode02, phoneNumber02,
          nic, email, houseNumber, streetName, city, district, province, country,
          languages, accHolderName, accNumber, bankName, branchName, image, status, passwordUpdated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Approved', 0)
      `;

      if (
        jobRole === "Distribution Centre Manager" ||
        jobRole === "Distribution Officer"
      ) {
        sql = `
          INSERT INTO collectionofficer (
            distributedCenterId, companyId, irmId, firstNameEnglish, firstNameSinhala, firstNameTamil, lastNameEnglish,
            lastNameSinhala, lastNameTamil, jobRole, empId, empType, phoneCode01, phoneNumber01, phoneCode02, phoneNumber02,
            nic, email, houseNumber, streetName, city, district, province, country,
            languages, accHolderName, accNumber, bankName, branchName, image, status, passwordUpdated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Not Approved', 0)
        `;
      }

      db.collectionofficer.query(
        sql,
        [
          centerId,
          companyId,
          irmId,
          officerData.firstNameEnglish,
          officerData.firstNameSinhala || null,
          officerData.firstNameTamil || null,
          officerData.lastNameEnglish,
          officerData.lastNameSinhala || null,
          officerData.lastNameTamil || null,
          officerData.jobRole,
          officerData.empId,
          officerData.empType,
          officerData.phoneCode01,
          officerData.phoneNumber01,
          officerData.phoneCode02 || null,
          officerData.phoneNumber02 || null,
          officerData.nic,
          officerData.email,
          officerData.houseNumber,
          officerData.streetName,
          officerData.city,
          officerData.district,
          officerData.province,
          officerData.country,
          officerData.languages,
          officerData.accHolderName || null,
          officerData.accNumber || null,
          officerData.bankName || null,
          officerData.branchName || null,
          officerData.profileImageUrl || null,
        ],
        (err, results) => {
          if (err) {
            console.error("Database query error:", err);
            return reject(
              new Error(
                "Failed to insert collection officer into the database.",
              ),
            );
          }
          resolve(results);
        },
      );
    } catch (error) {
      console.error(
        "Unexpected error in createCollectionOfficerPersonal:",
        error,
      );
      reject(error);
    }
  });
};

exports.getIrmDetails = async (irmId, jobRole) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT companyId, centerId
      FROM collectionofficer
      WHERE id = ?;
    `;

    if (
      jobRole === "Distribution Centre Manager" ||
      jobRole === "Distribution Officer"
    ) {
      sql = `
        SELECT companyId, distributedCenterId AS centerId
        FROM collectionofficer
        WHERE id = ?;
      `;
    }

    db.collectionofficer.query(sql, [irmId], (err, results) => {
      if (err) {
        console.error("Error fetching IRM details:", err);
        return reject(err);
      }
      resolve(results[0]);
    });
  });
};

exports.getForCreateId = (role) => {
  return new Promise((resolve, reject) => {
    const sql =
      "SELECT empId FROM collectionofficer WHERE empId LIKE ? ORDER BY empId DESC LIMIT 1";
    db.collectionofficer.query(sql, [`${role}%`], (err, results) => {
      if (err) {
        return reject(err);
      }

      if (results.length > 0) {
        const numericPart = parseInt(results[0].empId.substring(3), 10);

        const incrementedValue = numericPart + 1;

        results[0].empId = incrementedValue.toString().padStart(5, "0");
      }

      resolve(results);
    });
  });
};

exports.getFarmerListByCollectionOfficerAndDate = (
  collectionOfficerId,
  date,
) => {
  return new Promise((resolve, reject) => {
    const query = `
          SELECT DISTINCT
              RFP.id AS registeredFarmerId,
              U.id AS userId,
              U.firstName,
              U.lastName,
              U.phoneNumber,
              U.profileImage,
              CONCAT_WS(', ', U.houseNo, U.streetName, U.city, U.district) AS address,
              U.NICnumber,
              COALESCE(
                  (SELECT 
                      SUM(gradeAprice * gradeAquan) + 
                      SUM(gradeBprice * gradeBquan) + 
                      SUM(gradeCprice * gradeCquan)
                   FROM farmerpaymentscrops 
                   WHERE registerFarmerId = RFP.id), 0
              ) AS totalAmount,
              (SELECT accNumber FROM plant_care.userbankdetails WHERE userId = U.id LIMIT 1) AS accountNumber,
              (SELECT accHolderName FROM plant_care.userbankdetails WHERE userId = U.id LIMIT 1) AS accountHolderName,
              (SELECT bankName FROM plant_care.userbankdetails WHERE userId = U.id LIMIT 1) AS bankName,
              (SELECT branchName FROM plant_care.userbankdetails WHERE userId = U.id LIMIT 1) AS branchName,
              CO.empId
          FROM registeredfarmerpayments RFP
          INNER JOIN plant_care.users U ON RFP.userId = U.id
          INNER JOIN collectionofficer CO ON RFP.collectionOfficerId = CO.id
          WHERE RFP.collectionOfficerId = ? 
            AND DATE(RFP.createdAt) = ?
          ORDER BY RFP.id
      `;

    db.collectionofficer.query(
      query,
      [collectionOfficerId, date],
      (error, results) => {
        if (error) {
          return reject(error);
        }

        resolve(results);
      },
    );
  });
};

exports.getClaimOfficer = (empID, jobRole, OfficercompanyId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        c.*, 
        comp.companyNameEnglish,
        comp.companyNameSinhala,
        comp.companyNameTamil
      FROM 
        collectionofficer c 
      INNER JOIN 
        company comp 
      ON 
        c.companyId = comp.id 
      WHERE 
        c.empId = ? 
        AND c.jobRole = ? 
        AND c.centerId IS NULL 
        AND c.irmId IS NULL
        AND c.companyId = ?
    `;

    db.collectionofficer.query(
      sql,
      [empID, jobRole, OfficercompanyId],
      (err, results) => {
        if (err) {
          return reject(err);
        }

        resolve(results);
      },
    );
  });
};

exports.createClaimOfficer = (officerId, irmId, centerId, mangerJobRole) => {
  return new Promise((resolve, reject) => {
    let sql = `
      UPDATE collectionofficer 
      SET 
        irmId = ?,
        centerId = ?,
        claimStatus = 1
      WHERE 
        id = ?
    `;

    if (mangerJobRole === "Distribution Centre Manager") {
      sql = `
      UPDATE collectionofficer 
      SET 
        irmId = ?,
        distributedCenterId = ?,
        claimStatus = 1
      WHERE 
        id = ?
    `;
    }

    db.collectionofficer.query(
      sql,
      [irmId, centerId, officerId],
      (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      },
    );
  });
};

exports.disclaimOfficer = (collectionOfficerId, jobRole) => {
  return new Promise((resolve, reject) => {
    let sql = `
      UPDATE collectionofficer 
      SET 
        irmId = NULL,
        centerId = NULL,
        claimStatus = 0
      WHERE 
        id = ?
    `;
    if (jobRole === "Distribution Officer") {
      sql = `
        UPDATE collectionofficer 
      SET 
        irmId = NULL,
        distributedCenterId = NULL,
        claimStatus = 0
      WHERE 
        id = ?
      `;
    }
    db.collectionofficer.query(sql, [collectionOfficerId], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.GetFarmerReportDetailsDao = async (
  userId,
  createdAtDate,
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
      rfp.userId = ? 
      AND fpc.registerFarmerId = ?
      AND DATE(fpc.createdAt) = ?
    ORDER BY
      fpc.createdAt DESC
  `;
  return new Promise((resolve, reject) => {
    db.collectionofficer.query(
      query,
      [userId, registeredFarmerId, createdAtDate],
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
              variety: row.variety,
              varietyNameSinhala: row.varietyNameSinhala,
              varietyNameTamil: row.varietyNameTamil,
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

exports.getCollectionOfficers = async (managerId) => {
  const sql = `
    SELECT 
      empId, 
      CONCAT(firstNameEnglish, ' ', lastNameEnglish) AS fullNameEnglish,
      CONCAT(firstNameSinhala, ' ', lastNameSinhala) AS fullNameSinhala,
      CONCAT(firstNameTamil, ' ', lastNameTamil) AS fullNameTamil,
      phoneNumber01 AS phoneNumber1,
      phoneNumber02 AS phoneNumber2,
      id AS collectionOfficerId,
      jobRole,
      status,
      image
    FROM collectionofficer
    WHERE jobRole IN ('Collection Officer', 'Driver', 'Distribution Officer') 
      AND irmId = ?
      AND status = 'Approved'
  `;
  return db.collectionofficer.promise().query(sql, [managerId]);
};

exports.getCollectionOfficersReciever = async (
  managerId,
  companycenterId,
  varietyId,
  grade,
) => {
  const sql = `
    SELECT DISTINCT
      co.empId, 
      CONCAT(co.firstNameEnglish, ' ', co.lastNameEnglish) AS fullNameEnglish,
      CONCAT(co.firstNameSinhala, ' ', co.lastNameSinhala) AS fullNameSinhala,
      CONCAT(co.firstNameTamil, ' ', co.lastNameTamil) AS fullNameTamil,
      co.phoneNumber01 AS phoneNumber1,
      co.phoneNumber02 AS phoneNumber2,
      co.id AS collectionOfficerId,
      co.jobRole,
      co.status,
      co.image
    FROM collectionofficer co
    INNER JOIN officertarget ot ON co.id = ot.officerId
    INNER JOIN dailytarget dt ON ot.dailyTargetId = dt.id
    WHERE co.jobRole IN ('Collection Officer', 'Driver', 'Distribution Officer') 
      AND co.irmId = ?
      AND co.status = 'Approved'
      AND dt.companyCenterId = ?
      AND dt.varietyId = ?
      AND dt.grade = ?
      AND DATE(dt.date) = CURDATE()
      AND ot.target IS NOT NULL
      AND ot.target > 0
      AND ot.target > ot.complete
  `;
  return db.collectionofficer
    .promise()
    .query(sql, [managerId, companycenterId, varietyId, grade]);
};

exports.getCollectionOfficersList = async (managerId) => {
  const sql = `
    SELECT 
      empId, 
      CONCAT(firstNameEnglish, ' ', lastNameEnglish) AS fullNameEnglish,
      CONCAT(firstNameSinhala, ' ', lastNameSinhala) AS fullNameSinhala,
      CONCAT(firstNameTamil, ' ', lastNameTamil) AS fullNameTamil,
      phoneNumber01 AS phoneNumber1,
      phoneNumber02 AS phoneNumber2,
      id AS collectionOfficerId,
      jobRole,
      status,
      image
    FROM collectionofficer
    WHERE jobRole IN ('Collection Officer', 'Driver', 'Distribution Officer') AND irmId = ? 
  `;
  return db.collectionofficer.promise().query(sql, [managerId]);
};

exports.getOfficerDetails = async (empId) => {
  const sql = `
    SELECT 
      firstNameEnglish AS firstName, 
      lastNameEnglish AS lastName, 
      jobRole 
    FROM 
      collectionofficer
    WHERE 
      empId = ?;
  `;
  return db.collectionofficer.promise().query(sql, [empId]);
};

exports.getFarmerPaymentsSummary = async ({
  collectionOfficerId,
  fromDate,
  toDate,
}) => {
  const sql = `
    SELECT 
      DATE(CONVERT_TZ(fpc.createdAt, '+00:00', '+05:30')) AS date, 
      SUM(gradeAquan) + SUM(gradeBquan) + SUM(gradeCquan) AS total, 
      COUNT(fpc.registerFarmerId) AS TCount
    FROM 
      registeredfarmerpayments rfp
    JOIN 
      farmerpaymentscrops fpc ON rfp.id = fpc.registerFarmerId
    WHERE 
      rfp.collectionOfficerId = ? 
      AND DATE(CONVERT_TZ(fpc.createdAt, '+00:00', '+05:30')) BETWEEN ? AND ?
    GROUP BY 
      DATE(CONVERT_TZ(fpc.createdAt, '+00:00', '+05:30'));
  `;
  return db.collectionofficer
    .promise()
    .query(sql, [collectionOfficerId, fromDate, toDate]);
};

exports.getOfficerOnlineStatus = async (collectionOfficerId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        OnlineStatus
      FROM 
        collectionofficer
      WHERE 
        id = ?;
    `;

    db.collectionofficer.query(sql, [collectionOfficerId], (err, results) => {
      if (err) {
        reject(new Error("Database query failed"));
        return;
      }

      if (results.length > 0) {
        resolve(results[0]);
      } else {
        resolve(null);
      }
    });
  });
};
