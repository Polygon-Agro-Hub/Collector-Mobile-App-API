const { plantcare, collectionofficer, marketPlace, dash } = require('../startup/database');

exports.getOfficerDailyTargets = (officerId) => {
    return new Promise((resolve, reject) => {
        if (!officerId) {
            return reject(new Error("Officer ID is required"));
        }

        const sql = `
          SELECT
              ot.id AS officerTargetId,
              dt.id AS dailyTargetId,
              dt.companyCenterId AS centerId,
              dt.varietyId,
              cv.varietyNameEnglish,
              cv.varietyNameSinhala,
              cv.varietyNameTamil,
              dt.grade,
              dt.target AS dailyTarget,
              ot.target AS officerTarget,
              ot.complete,
              (CAST(COALESCE(ot.target, '0') AS DECIMAL(15,2)) - 
              CAST(COALESCE(ot.complete, '0') AS DECIMAL(15,2))) AS todo,
              DATE_FORMAT(dt.date, '%Y-%m-%d') AS targetDate,
              dt.assignStatus
          FROM
              officertarget ot
          INNER JOIN
              dailytarget dt ON ot.dailyTargetId = dt.id
          INNER JOIN
              plant_care.cropvariety cv ON dt.varietyId = cv.id
          WHERE
              ot.officerId = ?
              AND DATE(dt.date) = CURDATE()
               AND NOT (ot.target = 0 AND COALESCE(ot.complete, 0) = 0)
          ORDER BY
              dt.date DESC, dt.id DESC
      `;

        collectionofficer.query(sql, [officerId], (err, results) => {
            if (err) {
                console.error("Database error:", err);
                return reject(err);
            }

            // Format numeric values and return flat structure
            const formattedResults = results.map(target => ({
                officerTargetId: target.officerTargetId,
                dailyTargetId: target.dailyTargetId,
                centerId: target.centerId,
                varietyId: target.varietyId,
                varietyNameEnglish: target.varietyNameEnglish,
                varietyNameSinhala: target.varietyNameSinhala,
                varietyNameTamil: target.varietyNameTamil,
                grade: target.grade,
                dailyTarget: parseFloat(target.dailyTarget) || 0,
                officerTarget: parseFloat(target.officerTarget) || 0,
                complete: parseFloat(target.complete) || 0,
                todo: Math.max(0, parseFloat(target.todo) || 0),
                targetDate: target.targetDate,
                assignStatus: target.assignStatus
            }));

            resolve(formattedResults);
        });
    });
};


// exports.getCenterTarget = (centerId) => {
//   return new Promise((resolve, reject) => {
//       if (!centerId) {
//           return reject(new Error("Center ID is required"));
//       }

//       const sql = `
//           SELECT 
//               dt.varietyId,
//               cv.varietyNameEnglish,
//               cv.varietyNameSinhala,
//               cv.varietyNameTamil,
//               dt.grade,
//               dt.target,
//               COALESCE(dt.complete, 0) AS complete,  -- Ensure NULL becomes 0
//               (dt.target - COALESCE(dt.complete, 0)) AS todo
//           FROM 
//               dailytarget dt
//           JOIN
//               plant_care.cropvariety cv ON dt.varietyId = cv.id
//           JOIN
//               companycenter cc ON dt.companyCenterId = cc.id 
//           WHERE 
//               cc.centerId= ?
//               AND DATE(dt.date) = CURDATE()
//           ORDER BY
//               dt.varietyId, dt.grade
//       `;

//       collectionofficer.query(sql, [centerId], (error, results) => {
//           if (error) {
//               console.error("Database error in getCenterTarget:", error);
//               return reject(error);
//           }


//           const formattedResults = results.map(target => ({
//               varietyId: target.varietyId,
//               varietyNameEnglish: target.varietyNameEnglish,
//               varietyNameSinhala: target.varietyNameSinhala,
//               varietyNameTamil: target.varietyNameTamil,
//               grade: target.grade,
//               target: parseFloat(target.target).toFixed(2),
//               complete: parseFloat(target.complete || 0).toFixed(2), // Double safety
//               todo: parseFloat(target.todo || 0).toFixed(2) // Double safety
//           }));

//           resolve(formattedResults.length === 0 ? [] : formattedResults);
//       });
//   });
// };

exports.getCenterTarget = (centerId) => {
    return new Promise((resolve, reject) => {
        if (!centerId) {
            return reject(new Error("Center ID is required"));
        }

        const sql = `
          SELECT 
              dt.varietyId,
              cv.varietyNameEnglish,
              cv.varietyNameSinhala,
              cv.varietyNameTamil,
              dt.grade,
              dt.target,
              COALESCE(dt.complete, 0) AS complete,  -- Ensure NULL becomes 0
              (dt.target - COALESCE(dt.complete, 0)) AS todo
          FROM 
              dailytarget dt
          JOIN
              plant_care.cropvariety cv ON dt.varietyId = cv.id
          JOIN
              companycenter cc ON dt.companyCenterId = cc.id 
          WHERE 
              cc.centerId= ?
              AND DATE(dt.date) = CURDATE()
               AND NOT (dt.target = 0 AND COALESCE(dt.complete, 0) = 0)
          ORDER BY
              dt.varietyId, dt.grade
      `;

        collectionofficer.query(sql, [centerId], (error, results) => {
            if (error) {
                console.error("Database error in getCenterTarget:", error);
                return reject(error);
            }


            const formattedResults = results.map(target => ({
                varietyId: target.varietyId,
                varietyNameEnglish: target.varietyNameEnglish,
                varietyNameSinhala: target.varietyNameSinhala,
                varietyNameTamil: target.varietyNameTamil,
                grade: target.grade,
                target: parseFloat(target.target).toFixed(2),
                complete: parseFloat(target.complete || 0).toFixed(2), // Double safety
                todo: parseFloat(target.todo || 0).toFixed(2) // Double safety
            }));

            resolve(formattedResults.length === 0 ? [] : formattedResults);
        });
    });
};



exports.transferTargetDAO = (fromOfficerId, toOfficerId, varietyId, grade, amount) => {
    return new Promise((resolve, reject) => {
        const validGrades = ["A", "B", "C"];
        if (!validGrades.includes(grade)) {
            return reject(new Error(`Invalid grade: ${grade}`));
        }

        // SQL queries updated for new table structure
        const decrementSql = `
          UPDATE officertarget ot
          JOIN dailytarget dt ON ot.dailyTargetId = dt.id
          SET ot.target = ot.target - ?
          WHERE ot.officerId = ? 
          AND dt.varietyId = ? 
          AND dt.grade = ? 
          AND ot.target >= ?;
      `;

        const checkReceiverSql = `
          SELECT COUNT(*) as recordExists
          FROM officertarget ot
          JOIN dailytarget dt ON ot.dailyTargetId = dt.id
          WHERE ot.officerId = ? 
          AND dt.varietyId = ? 
          AND dt.grade = ?;
      `;

        const incrementSql = `
          UPDATE officertarget ot
          JOIN dailytarget dt ON ot.dailyTargetId = dt.id
          SET ot.target = ot.target + ?
          WHERE ot.officerId = ? 
          AND dt.varietyId = ? 
          AND dt.grade = ?;
      `;

        const getFromOfficerDetailsSql = `
          SELECT ot.dailyTargetId
          FROM officertarget ot
          JOIN dailytarget dt ON ot.dailyTargetId = dt.id
          WHERE ot.officerId = ? 
          AND dt.varietyId = ? 
          AND dt.grade = ?
          LIMIT 1;
      `;

        const createNewRecordSql = `
          INSERT INTO officertarget
          (dailyTargetId, officerId, target, complete)
          VALUES (?, ?, ?, 0);
      `;

        const getDailyTargetIdSql = `
          SELECT id FROM dailytarget
          WHERE varietyId = ? AND grade = ? AND DATE(date) = CURDATE()
          LIMIT 1;
      `;

        // Get a connection from the pool
        collectionofficer.getConnection((err, connection) => {
            if (err) return reject(err);

            connection.beginTransaction((err) => {
                if (err) {
                    connection.release();
                    return reject(err);
                }

                // Step 1: Deduct target from the transferring officer
                connection.query(decrementSql, [amount, fromOfficerId, varietyId, grade, amount], (err, result) => {
                    if (err || result.affectedRows === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            reject(err || new Error("Insufficient target balance or record not found"));
                        });
                    }

                    console.log(`✅ Deducted ${amount} from officer ${fromOfficerId}'s target`);

                    // Step 2: Check if receiving officer has a record for this variety and grade
                    connection.query(checkReceiverSql, [toOfficerId, varietyId, grade], (err, results) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                reject(err);
                            });
                        }

                        const receiverHasRecord = results[0].recordExists > 0;

                        if (receiverHasRecord) {
                            // Step 3A: If record exists, just update it
                            connection.query(incrementSql, [amount, toOfficerId, varietyId, grade], (err, result) => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        reject(err);
                                    });
                                }

                                console.log(`✅ Added ${amount} to officer ${toOfficerId}'s target`);

                                // Commit transaction
                                connection.commit((err) => {
                                    if (err) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            reject(err);
                                        });
                                    }

                                    connection.release();
                                    resolve({ message: "Target transferred successfully" });
                                });
                            });
                        } else {
                            // Step 3B: Get the dailyTargetId from source officer's record
                            connection.query(getFromOfficerDetailsSql, [fromOfficerId, varietyId, grade], (err, results) => {
                                if (err || results.length === 0) {
                                    // If source record not found, try to find the daily target directly
                                    connection.query(getDailyTargetIdSql, [varietyId, grade], (err, dailyTargetResults) => {
                                        if (err || dailyTargetResults.length === 0) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                reject(err || new Error("No daily target found for this variety and grade"));
                                            });
                                        }

                                        const dailyTargetId = dailyTargetResults[0].id;

                                        // Step 3C: Create a new record for the receiving officer
                                        connection.query(createNewRecordSql, [dailyTargetId, toOfficerId, amount], (err, result) => {
                                            if (err) {
                                                return connection.rollback(() => {
                                                    connection.release();
                                                    reject(err);
                                                });
                                            }

                                            console.log(`✅ Created new record for officer ${toOfficerId} with target ${amount}`);

                                            // Commit transaction
                                            connection.commit((err) => {
                                                if (err) {
                                                    return connection.rollback(() => {
                                                        connection.release();
                                                        reject(err);
                                                    });
                                                }

                                                connection.release();
                                                resolve({ message: "Target transferred successfully with new record creation" });
                                            });
                                        });
                                    });
                                } else {
                                    const dailyTargetId = results[0].dailyTargetId;

                                    // Step 3C: Create a new record for the receiving officer
                                    connection.query(createNewRecordSql, [dailyTargetId, toOfficerId, amount], (err, result) => {
                                        if (err) {
                                            return connection.rollback(() => {
                                                connection.release();
                                                reject(err);
                                            });
                                        }

                                        console.log(`✅ Created new record for officer ${toOfficerId} with target ${amount}`);

                                        // Commit transaction
                                        connection.commit((err) => {
                                            if (err) {
                                                return connection.rollback(() => {
                                                    connection.release();
                                                    reject(err);
                                                });
                                            }

                                            connection.release();
                                            resolve({ message: "Target transferred successfully with new record creation" });
                                        });
                                    });
                                }
                            });
                        }
                    });
                });
            });
        });
    });
};



exports.receiveTargetDAO = (fromOfficerId, toOfficerId, varietyId, grade, amount) => {
    return new Promise((resolve, reject) => {
        const validGrades = ["A", "B", "C"];
        if (!validGrades.includes(grade)) {
            return reject(new Error(`Invalid grade: ${grade}`));
        }

        // Updated SQL queries for new table structure
        const decrementSql = `
          UPDATE officertarget ot
          JOIN dailytarget dt ON ot.dailyTargetId = dt.id
          SET ot.target = ot.target - ?
          WHERE ot.officerId = ? 
          AND dt.varietyId = ? 
          AND dt.grade = ? 
          AND ot.target >= ?;
      `;

        const incrementSql = `
          UPDATE officertarget ot
          JOIN dailytarget dt ON ot.dailyTargetId = dt.id
          SET ot.target = ot.target + ?
          WHERE ot.officerId = ? 
          AND dt.varietyId = ? 
          AND dt.grade = ?;
      `;

        const checkReceiverSql = `
          SELECT ot.id 
          FROM officertarget ot
          JOIN dailytarget dt ON ot.dailyTargetId = dt.id
          WHERE ot.officerId = ? 
          AND dt.varietyId = ? 
          AND dt.grade = ?;
      `;

        const createReceiverRecordSql = `
          INSERT INTO officertarget (dailyTargetId, officerId, target, complete)
          SELECT dt.id, ?, ?, 0
          FROM dailytarget dt
          WHERE dt.varietyId = ? 
          AND dt.grade = ?
          AND DATE(dt.date) = CURDATE()
          LIMIT 1;
      `;

        // Get a connection from the pool
        collectionofficer.getConnection((err, connection) => {
            if (err) return reject(err);

            connection.beginTransaction((err) => {
                if (err) {
                    connection.release();
                    return reject(err);
                }

                // Step 1: Deduct from the sender's target
                connection.query(decrementSql, [amount, fromOfficerId, varietyId, grade, amount], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            reject(err);
                        });
                    }

                    if (result.affectedRows === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            reject(new Error("Insufficient target balance or sender record not found"));
                        });
                    }

                    console.log(`✅ Deducted ${amount} from officer ${fromOfficerId}'s target`);

                    // Step 2: Check if receiver has an existing record
                    connection.query(checkReceiverSql, [toOfficerId, varietyId, grade], (err, results) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                reject(err);
                            });
                        }

                        if (results.length > 0) {
                            // Step 3A: Update existing receiver record
                            connection.query(incrementSql, [amount, toOfficerId, varietyId, grade], (err, result) => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        reject(err);
                                    });
                                }

                                if (result.affectedRows === 0) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        reject(new Error("Failed to update receiver's target"));
                                    });
                                }

                                console.log(`✅ Added ${amount} to officer ${toOfficerId}'s existing target`);

                                // Commit transaction
                                connection.commit((err) => {
                                    if (err) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            reject(err);
                                        });
                                    }

                                    connection.release();
                                    resolve({ message: "Target received successfully" });
                                });
                            });
                        } else {
                            // Step 3B: Create new record for receiver
                            connection.query(createReceiverRecordSql, [toOfficerId, amount, varietyId, grade], (err, result) => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        reject(err);
                                    });
                                }

                                if (result.affectedRows === 0) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        reject(new Error("No daily target found to create receiver record"));
                                    });
                                }

                                console.log(`✅ Created new target record for officer ${toOfficerId}`);

                                // Commit transaction
                                connection.commit((err) => {
                                    if (err) {
                                        return connection.rollback(() => {
                                            connection.release();
                                            reject(err);
                                        });
                                    }

                                    connection.release();
                                    resolve({ message: "Target received with new record creation" });
                                });
                            });
                        }
                    });
                });
            });
        });
    });
};


exports.getDailyTargetByOfficerAndVariety = (officerId, varietyId, grade) => {
    return new Promise((resolve, reject) => {
        const sql = `
          SELECT 
              ot.id,
              ot.dailyTargetId,
              dt.varietyId,
              ot.officerId,
              dt.grade,
              ot.target,
              ot.complete,
              dt.createdAt
          FROM 
              officertarget ot
          JOIN
              dailytarget dt ON ot.dailyTargetId = dt.id
          WHERE 
              ot.officerId = ? 
              AND dt.varietyId = ? 
              AND dt.grade = ?
              AND DATE(dt.date) = CURDATE();
      `;

        collectionofficer.query(sql, [officerId, varietyId, grade], (err, results) => {
            if (err) {
                console.error("Error in getDailyTargetByOfficerAndVariety:", err);
                return reject(err);
            }

            // Format numeric values to 2 decimal places
            const formattedResults = results.map(target => ({
                id: target.id,
                dailyTargetId: target.dailyTargetId,
                varietyId: target.varietyId,
                officerId: target.officerId,
                grade: target.grade,
                target: parseFloat(target.target).toFixed(2),
                complete: parseFloat(target.complete).toFixed(2),
                createdAt: target.createdAt ? target.createdAt.toISOString() : null
            }));

            resolve(formattedResults.length > 0 ? formattedResults[0] : null);
        });
    });
};


exports.getOfficerSummaryDao = async (officerId) => {
    return new Promise((resolve, reject) => {
        const query = `
         SELECT 
              COUNT(ot.id) AS totalTasks,
              SUM(CASE WHEN ot.target <= ot.complete AND ot.complete > 0 THEN 1 ELSE 0 END) AS completedTasks,
              SUM(ot.target) AS totalTarget,
              SUM(ot.complete) AS totalComplete,
              (SUM(ot.target) - SUM(COALESCE(ot.complete, 0))) AS remainingTarget
          FROM 
              officertarget ot
          JOIN 
              dailytarget dt ON ot.dailyTargetId = dt.id
          WHERE 
              ot.officerId = ?
              AND DATE(dt.date) = CURDATE();
      `;

        collectionofficer.query(query, [officerId], (error, results) => {
            if (error) {
                console.error("Database error in getOfficerSummaryDao:", error);
                return reject(error);
            }
            resolve(results[0] || {
                totalTasks: 0,
                completedTasks: 0,
                totalTarget: 0,
                totalComplete: 0,
                remainingTarget: 0
            });
        });
    });
};

exports.getOfficerSummaryDaoManager = async (collectionOfficerId) => {
    return new Promise((resolve, reject) => {
        const query = `
          SELECT 
              COUNT(ot.id) AS totalTasks,
            SUM(CASE WHEN ot.target <= ot.complete AND ot.complete > 0 THEN 1 ELSE 0 END) AS completedTasks,
              SUM(ot.target) AS totalTarget,
              SUM(ot.complete) AS totalComplete,
              (SUM(ot.target) - SUM(COALESCE(ot.complete, 0))) AS remainingTarget,
              GROUP_CONCAT(DISTINCT dt.grade) AS gradesAssigned
          FROM 
              officertarget ot
          JOIN 
              dailytarget dt ON ot.dailyTargetId = dt.id
          WHERE 
              ot.officerId = ?
              AND DATE(dt.date) = CURDATE();
      `;

        collectionofficer.query(query, [collectionOfficerId], (error, results) => {
            if (error) {
                console.error("Database error in getOfficerSummaryDaoManager:", error);
                return reject(error);
            }

            const summary = results[0] || {
                totalTasks: 0,
                completedTasks: 0,
                totalTarget: 0,
                totalComplete: 0,
                remainingTarget: 0,
                gradesAssigned: ''
            };

            // Convert string values to numbers
            summary.totalTasks = Number(summary.totalTasks);
            summary.completedTasks = Number(summary.completedTasks);
            summary.totalTarget = Number(summary.totalTarget);
            summary.totalComplete = Number(summary.totalComplete);
            summary.remainingTarget = Number(summary.remainingTarget);

            resolve(summary);
        });
    });
};
