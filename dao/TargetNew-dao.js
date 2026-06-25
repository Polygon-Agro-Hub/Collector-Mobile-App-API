const { collectionofficer } = require("../startup/database");

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

      const formattedResults = results.map((target) => ({
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
        assignStatus: target.assignStatus,
      }));

      resolve(formattedResults);
    });
  });
};

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

      const formattedResults = results.map((target) => ({
        varietyId: target.varietyId,
        varietyNameEnglish: target.varietyNameEnglish,
        varietyNameSinhala: target.varietyNameSinhala,
        varietyNameTamil: target.varietyNameTamil,
        grade: target.grade,
        target: parseFloat(target.target).toFixed(2),
        complete: parseFloat(target.complete || 0).toFixed(2),
        todo: parseFloat(target.todo || 0).toFixed(2),
      }));

      resolve(formattedResults.length === 0 ? [] : formattedResults);
    });
  });
};

exports.transferTargetDAO = (
  fromOfficerId,
  toOfficerId,
  varietyId,
  grade,
  amount,
) => {
  return new Promise((resolve, reject) => {
    const validGrades = ["A", "B", "C"];
    if (!validGrades.includes(grade)) {
      return reject(new Error(`Invalid grade: ${grade}`));
    }

    const getSenderDailyTargetIdSql = `
      SELECT ot.dailyTargetId
      FROM officertarget ot
      JOIN dailytarget dt ON ot.dailyTargetId = dt.id
      WHERE ot.officerId = ?
        AND dt.varietyId = ?
        AND dt.grade = ?
      ORDER BY dt.date DESC
      LIMIT 1;
    `;

    const decrementSql = `
      UPDATE officertarget
      SET target = target - ?
      WHERE dailyTargetId = ?
        AND officerId = ?
        AND target >= ?;
    `;

    const checkReceiverSql = `
      SELECT COUNT(*) as recordExists
      FROM officertarget
      WHERE dailyTargetId = ? AND officerId = ?;
    `;

    const incrementSql = `
      UPDATE officertarget
      SET target = target + ?
      WHERE dailyTargetId = ? AND officerId = ?;
    `;

    const createNewRecordSql = `
      INSERT INTO officertarget (dailyTargetId, officerId, target, complete)
      VALUES (?, ?, ?, 0);
    `;

    collectionofficer.getConnection((err, connection) => {
      if (err) return reject(err);

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return reject(err);
        }

        connection.query(
          getSenderDailyTargetIdSql,
          [fromOfficerId, varietyId, grade],
          (err, results) => {
            if (err || results.length === 0) {
              return connection.rollback(() => {
                connection.release();
                reject(
                  err ||
                  new Error(
                    `No target record found for sender officer ${fromOfficerId} with varietyId ${varietyId} grade ${grade}`,
                  ),
                );
              });
            }

            const dailyTargetId = results[0].dailyTargetId;
            console.log("Resolved dailyTargetId:", dailyTargetId);

            connection.query(
              decrementSql,
              [amount, dailyTargetId, fromOfficerId, amount],
              (err, result) => {
                if (err || result.affectedRows === 0) {
                  return connection.rollback(() => {
                    connection.release();
                    reject(
                      err ||
                      new Error(
                        `Insufficient target balance or sender record not found (dailyTargetId=${dailyTargetId}, officer=${fromOfficerId}, amount=${amount})`,
                      ),
                    );
                  });
                }

                connection.query(
                  checkReceiverSql,
                  [dailyTargetId, toOfficerId],
                  (err, results) => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        reject(err);
                      });
                    }

                    const receiverHasRecord = results[0].recordExists > 0;

                    if (receiverHasRecord) {
                      connection.query(
                        incrementSql,
                        [amount, dailyTargetId, toOfficerId],
                        (err, result) => {
                          if (err || result.affectedRows === 0) {
                            return connection.rollback(() => {
                              connection.release();
                              reject(
                                err ||
                                new Error(
                                  "Failed to increment receiver target",
                                ),
                              );
                            });
                          }

                          connection.commit((err) => {
                            if (err) {
                              return connection.rollback(() => {
                                connection.release();
                                reject(err);
                              });
                            }
                            connection.release();
                            resolve({
                              message: "Target transferred successfully",
                            });
                          });
                        },
                      );
                    } else {
                      connection.query(
                        createNewRecordSql,
                        [dailyTargetId, toOfficerId, amount],
                        (err) => {
                          if (err) {
                            return connection.rollback(() => {
                              connection.release();
                              reject(err);
                            });
                          }

                          connection.commit((err) => {
                            if (err) {
                              return connection.rollback(() => {
                                connection.release();
                                reject(err);
                              });
                            }
                            connection.release();
                            resolve({
                              message:
                                "Target transferred successfully with new record creation",
                            });
                          });
                        },
                      );
                    }
                  },
                );
              },
            );
          },
        );
      });
    });
  });
};

exports.receiveTargetDAO = (
  fromOfficerId,
  toOfficerId,
  varietyId,
  grade,
  amount,
) => {
  return new Promise((resolve, reject) => {
    const validGrades = ["A", "B", "C"];
    if (!validGrades.includes(grade)) {
      return reject(new Error(`Invalid grade: ${grade}`));
    }

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

    collectionofficer.getConnection((err, connection) => {
      if (err) return reject(err);

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          return reject(err);
        }

        connection.query(
          decrementSql,
          [amount, fromOfficerId, varietyId, grade, amount],
          (err, result) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                reject(err);
              });
            }

            if (result.affectedRows === 0) {
              return connection.rollback(() => {
                connection.release();
                reject(
                  new Error(
                    "Insufficient target balance or sender record not found",
                  ),
                );
              });
            }

            connection.query(
              checkReceiverSql,
              [toOfficerId, varietyId, grade],
              (err, results) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    reject(err);
                  });
                }

                if (results.length > 0) {
                  connection.query(
                    incrementSql,
                    [amount, toOfficerId, varietyId, grade],
                    (err, result) => {
                      if (err) {
                        return connection.rollback(() => {
                          connection.release();
                          reject(err);
                        });
                      }

                      if (result.affectedRows === 0) {
                        return connection.rollback(() => {
                          connection.release();
                          reject(
                            new Error("Failed to update receiver's target"),
                          );
                        });
                      }

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
                    },
                  );
                } else {
                  connection.query(
                    createReceiverRecordSql,
                    [toOfficerId, amount, varietyId, grade],
                    (err, result) => {
                      if (err) {
                        return connection.rollback(() => {
                          connection.release();
                          reject(err);
                        });
                      }

                      if (result.affectedRows === 0) {
                        return connection.rollback(() => {
                          connection.release();
                          reject(
                            new Error(
                              "No daily target found to create receiver record",
                            ),
                          );
                        });
                      }

                      connection.commit((err) => {
                        if (err) {
                          return connection.rollback(() => {
                            connection.release();
                            reject(err);
                          });
                        }

                        connection.release();
                        resolve({
                          message: "Target received with new record creation",
                        });
                      });
                    },
                  );
                }
              },
            );
          },
        );
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

    collectionofficer.query(
      sql,
      [officerId, varietyId, grade],
      (err, results) => {
        if (err) {
          console.error("Error in getDailyTargetByOfficerAndVariety:", err);
          return reject(err);
        }

        const formattedResults = results.map((target) => ({
          id: target.id,
          dailyTargetId: target.dailyTargetId,
          varietyId: target.varietyId,
          officerId: target.officerId,
          grade: target.grade,
          target: parseFloat(target.target).toFixed(2),
          complete: parseFloat(target.complete).toFixed(2),
          createdAt: target.createdAt ? target.createdAt.toISOString() : null,
        }));

        resolve(formattedResults.length > 0 ? formattedResults[0] : null);
      },
    );
  });
};

exports.getOfficerSummaryDao = async (officerId) => {
  return new Promise((resolve, reject) => {
    const query = `
         SELECT 
              COUNT(ot.id) AS totalTasks,
              SUM(CASE WHEN ot.target <= ot.complete AND ot.complete > 0 THEN 1 ELSE 0 END) AS completedTasks,
              SUM(ot.target) AS totalTarget,
              SUM(
                  CASE 
                      WHEN ot.complete > ot.target THEN ot.target
                      ELSE COALESCE(ot.complete, 0)
                  END
              ) AS totalComplete,
              (SUM(ot.target) - SUM(
                  CASE 
                      WHEN ot.complete > ot.target THEN ot.target
                      ELSE COALESCE(ot.complete, 0)
                  END
              )) AS remainingTarget
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
      resolve(
        results[0] || {
          totalTasks: 0,
          completedTasks: 0,
          totalTarget: 0,
          totalComplete: 0,
          remainingTarget: 0,
        },
      );
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
          SUM(
              CASE 
                  WHEN ot.complete > ot.target THEN ot.target  
                  ELSE COALESCE(ot.complete, 0)
              END
          ) AS totalComplete,
          (SUM(ot.target) - SUM(
              CASE 
                  WHEN ot.complete > ot.target THEN ot.target  
                  ELSE COALESCE(ot.complete, 0)
              END
          )) AS remainingTarget,
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
        gradesAssigned: "",
      };

      summary.totalTasks = Number(summary.totalTasks);
      summary.completedTasks = Number(summary.completedTasks);
      summary.totalTarget = Number(summary.totalTarget);
      summary.totalComplete = Number(summary.totalComplete);
      summary.remainingTarget = Number(summary.remainingTarget);

      resolve(summary);
    });
  });
};
