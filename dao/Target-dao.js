const {
    plantcare,
    collectionofficer,
    marketPlace,
    dash,
} = require("../startup/database");

exports.getAllCropNameDAO = () => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT cg.id AS cropId, cv.id AS varietyId, cg.cropNameEnglish, cv.varietyNameEnglish AS varietyEnglish 
            FROM cropvariety cv, cropgroup cg
            WHERE cg.id = cv.cropGroupId
        `;

        plantcare.query(sql, (err, results) => {
            if (err) {
                return reject(err);
            }

            const groupedData = {};

            results.forEach((item) => {
                const { cropNameEnglish, varietyEnglish, varietyId, cropId } = item;

                if (!groupedData[cropNameEnglish]) {
                    groupedData[cropNameEnglish] = {
                        cropId: cropId,
                        variety: [],
                    };
                }

                groupedData[cropNameEnglish].variety.push({
                    id: varietyId,
                    varietyEnglish: varietyEnglish,
                });
            });

            const formattedResult = Object.keys(groupedData).map((cropName) => ({
                cropId: groupedData[cropName].cropId,
                cropNameEnglish: cropName,
                variety: groupedData[cropName].variety,
            }));

            resolve(formattedResult);
        });
    });
};

exports.createDailyTargetDao = (target, companyId, userId) => {
    return new Promise((resolve, reject) => {
        const sql = `
           INSERT INTO dailytarget (companyId, fromDate, toDate, fromTime, toTime, createdBy)
           VALUES (?, ?, ?, ?, ?, ?)
        `;
        collectionofficer.query(
            sql,
            [
                companyId,
                target.fromDate,
                target.toDate,
                target.fromTime,
                target.toTime,
                userId,
            ],
            (err, results) => {
                if (err) {
                    return reject(err);
                }
                resolve(results.insertId);
            },
        );
    });
};

exports.createDailyTargetItemsDao = (data, targetId) => {
    return new Promise((resolve, reject) => {
        const sql = `
           INSERT INTO dailytargetitems (targetId, varietyId, qtyA, qtyB, qtyC)
           VALUES (?, ?, ?, ?, ?)
        `;
        collectionofficer.query(
            sql,
            [targetId, data.varietyId, data.qtyA, data.qtyB, data.qtyC],
            (err, results) => {
                if (err) {
                    return reject(err);
                }
                resolve(results.insertId);
            },
        );
    });
};

exports.getAllDailyTargetDAO = (companyId, searchText) => {
    return new Promise((resolve, reject) => {
        let targetSql = `
           SELECT CG.cropNameEnglish, CV.varietyNameEnglish, DTI.qtyA, DTI.qtyB, DTI.qtyC, DT.toDate, DT.toTime, DT.fromTime
           FROM dailytarget DT, dailytargetitems DTI, \`plant_care\`.cropvariety CV, \`plant_care\`.cropgroup CG
           WHERE DT.id = DTI.targetId AND DTI.varietyId = CV.id AND CV.cropGroupId = CG.id AND DT.companyId = ?
        `;
        const sqlParams = [companyId];

        if (searchText) {
            const searchCondition = ` AND  CV.varietyNameEnglish LIKE ? `;
            targetSql += searchCondition;
            const searchValue = `%${searchText}%`;
            sqlParams.push(searchValue);
        }

        collectionofficer.query(targetSql, sqlParams, (err, results) => {
            if (err) {
                return reject(err);
            }
            const transformedTargetData = results.flatMap((item) => [
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    toDate: item.toDate,
                    toTime: item.toTime,
                    toTime: item.fromTime,
                    qtyA: item.qtyA,
                    grade: "A",
                },
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    toDate: item.toDate,
                    toTime: item.toTime,
                    toTime: item.fromTime,
                    qtyB: item.qtyB,
                    grade: "B",
                },
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    toDate: item.toDate,
                    toTime: item.toTime,
                    toTime: item.fromTime,
                    qtyC: item.qtyC,
                    grade: "C",
                },
            ]);
            resolve(transformedTargetData);
        });
    });
};

exports.getAllDailyTargetCompleteDAO = (companyId, searchText) => {
    return new Promise((resolve, reject) => {
        let completeSql = `
            SELECT CG.cropNameEnglish, CV.varietyNameEnglish, SUM(FPC.gradeAquan) AS totA, SUM(FPC.gradeBquan) AS totB, SUM(FPC.gradeCquan) AS totC, FPC.createdAt
            FROM registeredfarmerpayments RFP, farmerpaymentscrops FPC, collectionofficer CO, \`plant_care\`.cropvariety CV, \`plant_care\`.cropgroup CG
            WHERE RFP.id = FPC.registerFarmerId AND RFP.collectionOfficerId = CO.id AND FPC.cropId = CV.id AND CV.cropGroupId = CG.id AND CO.companyId = ?
            GROUP BY CG.cropNameEnglish, CV.varietyNameEnglish

        `;

        const sqlParams = [companyId];

        if (searchText) {
            const searchCondition = ` AND  CV.varietyNameEnglish LIKE ? `;
            completeSql += searchCondition;
            const searchValue = `%${searchText}%`;
            sqlParams.push(searchValue);
        }

        collectionofficer.query(completeSql, sqlParams, (err, results) => {
            if (err) {
                return reject(err);
            }

            const transformedCompleteData = results.flatMap((item) => [
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    totA: item.totA,
                    grade: "A",
                    buyDate: item.createdAt,
                },
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    totB: item.totB,
                    grade: "B",
                    buyDate: item.createdAt,
                },
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    totC: item.totC,
                    grade: "C",
                    buyDate: item.createdAt,
                },
            ]);

            resolve(transformedCompleteData);
        });
    });
};

exports.downloadAllDailyTargetDao = (companyId, fromDate, toDate) => {
    return new Promise((resolve, reject) => {
        let targetSql = `
           SELECT CG.cropNameEnglish, CV.varietyNameEnglish, DTI.qtyA, DTI.qtyB, DTI.qtyC, DT.toDate, DT.toTime, DT.fromTime
           FROM dailytarget DT, dailytargetitems DTI, \`plant_care\`.cropvariety CV, \`plant_care\`.cropgroup CG
           WHERE DT.id = DTI.targetId AND DTI.varietyId = CV.id AND CV.cropGroupId = CG.id AND DT.companyId = ? AND DATE(DT.fromDate) >= ? AND DATE(DT.toDate) <= ?
        `;
        const sqlParams = [companyId, fromDate, toDate];

        collectionofficer.query(targetSql, sqlParams, (err, results) => {
            if (err) {
                return reject(err);
            }
            const transformedTargetData = results.flatMap((item) => [
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    toDate: item.toDate,
                    toTime: item.toTime,
                    toTime: item.fromTime,
                    qtyA: item.qtyA,
                    grade: "A",
                },
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    toDate: item.toDate,
                    toTime: item.toTime,
                    toTime: item.fromTime,
                    qtyB: item.qtyB,
                    grade: "B",
                },
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    toDate: item.toDate,
                    toTime: item.toTime,
                    toTime: item.fromTime,
                    qtyC: item.qtyC,
                    grade: "C",
                },
            ]);

            resolve(transformedTargetData);
        });
    });
};

exports.downloadAllDailyTargetCompleteDAO = (companyId, fromDate, toDate) => {
    return new Promise((resolve, reject) => {
        let completeSql = `
            SELECT CG.cropNameEnglish, CV.varietyNameEnglish, SUM(FPC.gradeAquan) AS totA, SUM(FPC.gradeBquan) AS totB, SUM(FPC.gradeCquan) AS totC, FPC.createdAt
            FROM registeredfarmerpayments RFP, farmerpaymentscrops FPC, collectionofficer CO, \`plant_care\`.cropvariety CV, \`plant_care\`.cropgroup CG
            WHERE RFP.id = FPC.registerFarmerId AND RFP.collectionOfficerId = CO.id AND FPC.cropId = CV.id AND CV.cropGroupId = CG.id AND CO.companyId = ? AND DATE(RFP.createdAt) BETWEEN DATE(?) AND DATE(?)
            GROUP BY CG.cropNameEnglish, CV.varietyNameEnglish

        `;

        const sqlParams = [companyId, fromDate, toDate];

        collectionofficer.query(completeSql, sqlParams, (err, results) => {
            if (err) {
                return reject(err);
            }

            const transformedCompleteData = results.flatMap((item) => [
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    totA: item.totA,
                    grade: "A",
                    buyDate: item.createdAt,
                },
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    totB: item.totB,
                    grade: "B",
                    buyDate: item.createdAt,
                },
                {
                    cropNameEnglish: item.cropNameEnglish,
                    varietyNameEnglish: item.varietyNameEnglish,
                    totC: item.totC,
                    grade: "C",
                    buyDate: item.createdAt,
                },
            ]);

            resolve(transformedCompleteData);
        });
    });
};

exports.deleteTargetByIdDao = (targetId) => {
    return new Promise((resolve, reject) => {
        const sqlDeleteItems = `DELETE FROM dailytargetitems WHERE targetId = ?`;
        const sqlDeleteTarget = `DELETE FROM dailytarget WHERE id = ?`;

        collectionofficer.beginTransaction((err) => {
            if (err) return reject(err);

            collectionofficer.query(sqlDeleteItems, [targetId], (err) => {
                if (err) {
                    return collectionofficer.rollback(() => reject(err));
                }

                collectionofficer.query(sqlDeleteTarget, [targetId], (err, results) => {
                    if (err) {
                        return collectionofficer.rollback(() => reject(err));
                    }

                    collectionofficer.commit((err) => {
                        if (err) {
                            return collectionofficer.rollback(() => reject(err));
                        }
                        resolve(results);
                    });
                });
            });
        });
    });
};

exports.getAllTargetsDao = () => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT dt.id AS targetId, dt.companyId, dt.fromDate, dt.toDate, dt.fromTime, dt.toTime, dt.createdBy, dt.createdAt,
                   dti.id AS itemId, dti.varietyId, dti.qtyA, dti.qtyB, dti.qtyC
            FROM dailytarget dt
            LEFT JOIN dailytargetitems dti ON dt.id = dti.targetId
        `;
        collectionofficer.query(sql, (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

exports.getTargetsByCompanyIdDao = (centerId) => {
    return new Promise((resolve, reject) => {
        const sql = `
        SELECT 
          dt.id AS targetId, 
          dt.centerId, 
          dt.fromDate, 
          dt.toDate, 
          dt.fromTime, 
          dt.toTime, 
          dt.createdBy, 
          dt.createdAt,
          dti.id AS itemId, 
          dti.varietyId, 
          dti.qtyA AS targetA,
          dti.qtyB AS targetB,
          dti.qtyC AS targetC,
          dti.complteQtyA, 
          dti.complteQtyB, 
          dti.complteQtyC,
          (dti.qtyA - dti.complteQtyA) AS todoQtyA,
          (dti.qtyB - dti.complteQtyB) AS todoQtyB,
          (dti.qtyC - dti.complteQtyC) AS todoQtyC
        FROM 
          dailytarget dt
        LEFT JOIN 
          dailytargetitems dti ON dt.id = dti.targetId
        WHERE 
          dt.centerId = ?
        GROUP BY 
          dti.id, dt.id
      `;
        collectionofficer.query(sql, [centerId], (err, results) => {
            if (err) {
                return reject(err);
            }
            resolve(results);
        });
    });
};

exports.getTargetForOfficerDao = (officerId) => {
    return new Promise((resolve, reject) => {
        if (!officerId) {
            return reject(new Error("Officer ID is missing or invalid"));
        }
        const sql = `
            SELECT
                dt.centerCropId AS varietyId,
                cv.varietyNameEnglish AS varietyNameEnglish,
                cv.varietyNameSinhala AS varietyNameSinhala,
                cv.varietyNameTamil AS varietyNameTamil,
                dt.grade AS grade,
                ot.target AS target,
                ot.complete AS complete,
                DATE(dt.date) AS fromDate,
                DATE(dt.date) AS toDate,
                '00:00:00' AS fromTime,
                '23:59:59' AS toTime,
                ot.createdAt AS createdAt
            FROM
                officertarget ot
            INNER JOIN
                dailytarget dt ON ot.dailyTargetId = dt.id
            INNER JOIN
                plant_care.cropvariety cv ON dt.centerCropId = cv.id
            WHERE
                ot.officerId = ?
                AND dt.date = CURDATE()
        `;
        collectionofficer.query(sql, [officerId], (err, results) => {
            if (err) {
                console.error("Error executing query:", err);
                return reject(err);
            }

            resolve(results);
        });
    });
};

exports.getCenterTargetDao = async (centerId, varietyId, grade) => {
    return new Promise((resolve, reject) => {
        const gradeMap = {
            A: "qtyA",
            B: "qtyB",
            C: "qtyC",
            completedA: "complteQtyA",
            completedB: "complteQtyB",
            completedC: "complteQtyC",
        };

        const columnName = gradeMap[grade.trim()];

        if (!columnName) {
            return reject(new Error(`Invalid grade parameter: ${grade}`));
        }

        const query = `
            SELECT 
                dt.centerId,
                dti.varietyId,
                SUM(dti.${columnName}) AS total_${columnName}
            FROM dailytargetitems dti
            JOIN dailytarget dt ON dti.targetId = dt.id
            WHERE dt.centerId = ? AND dti.varietyId = ?
            GROUP BY dt.centerId, dti.varietyId;
        `;

        collectionofficer.query(query, [centerId, varietyId], (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });
};

exports.getCenterTarget = async (centerId) => {
    return new Promise((resolve, reject) => {
        const query = `
        SELECT 
          dti.varietyId,
          cv.varietyNameEnglish AS varietyNameEnglish,
          cv.varietyNameSinhala AS varietyNameSinhala,
          cv.varietyNameTamil AS varietyNameTamil,
          SUM(dti.qtyA) AS qtyA,  
          SUM(dti.qtyB) AS qtyB, 
          SUM(dti.qtyC) AS qtyC,  
          SUM(dti.complteQtyA) AS complteQtyA,  
          SUM(dti.complteQtyB) AS complteQtyB, 
          SUM(dti.complteQtyC) AS complteQtyC 
        FROM dailytargetitems dti
        JOIN dailytarget dt ON dti.targetId = dt.id
        JOIN plant_care.cropvariety cv ON dti.varietyId = cv.id 
        WHERE dt.centerId = ?
          GROUP BY dti.varietyId, cv.varietyNameEnglish, cv.varietyNameSinhala, cv.varietyNameTamil;

      `;

        collectionofficer.query(query, [centerId], (error, results) => {
            if (error) {
                return reject(error);
            }

            if (results.length === 0) {
                resolve([]);
            } else {
                resolve(results);
            }
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

        const decrementSql = `
            UPDATE officerdailytarget
            SET target = target - ?
            WHERE officerId = ? AND varietyId = ? AND grade = ? AND target >= ?;
        `;

        const checkReceiverSql = `
            SELECT COUNT(*) as recordExists
            FROM officerdailytarget
            WHERE officerId = ? AND varietyId = ? AND grade = ?;
        `;

        const incrementSql = `
            UPDATE officerdailytarget
            SET target = target + ?
            WHERE officerId = ? AND varietyId = ? AND grade = ?;
        `;

        const getFromOfficerDetailsSql = `
            SELECT dailyTargetId
            FROM officerdailytarget
            WHERE officerId = ? AND varietyId = ? AND grade = ?
            LIMIT 1;
        `;

        const createNewRecordSql = `
            INSERT INTO officerdailytarget
            (dailyTargetId, varietyId, officerId, grade, target, complete)
            VALUES (?, ?, ?, ?, ?, 0);
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
                        if (err || result.affectedRows === 0) {
                            return connection.rollback(() => {
                                connection.release();
                                reject(
                                    err ||
                                    new Error(
                                        "Insufficient target balance or record not found",
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

                                const receiverHasRecord = results[0].recordExists > 0;

                                if (receiverHasRecord) {
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
                                        },
                                    );
                                } else {
                                    connection.query(
                                        getFromOfficerDetailsSql,
                                        [fromOfficerId, varietyId, grade],
                                        (err, results) => {
                                            if (err || results.length === 0) {
                                                return connection.rollback(() => {
                                                    connection.release();
                                                    reject(
                                                        err || new Error("Source officer record not found"),
                                                    );
                                                });
                                            }

                                            const dailyTargetId = results[0].dailyTargetId;

                                            connection.query(
                                                createNewRecordSql,
                                                [dailyTargetId, varietyId, toOfficerId, grade, amount],
                                                (err, result) => {
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
            UPDATE officerdailytarget 
            SET target = target - ?
            WHERE officerId = ? AND varietyId = ? AND grade = ? AND target >= ?;
        `;

        const incrementSql = `
            UPDATE officerdailytarget 
            SET target = target + ?
            WHERE officerId = ? AND varietyId = ? AND grade = ?;
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
                            connection.rollback(() => {
                                connection.release();
                                reject(err);
                            });
                        } else if (result.affectedRows === 0) {
                            connection.rollback(() => {
                                connection.release();
                                reject(
                                    new Error(
                                        "Insufficient target balance or sender record not found",
                                    ),
                                );
                            });
                        } else {
                            connection.query(
                                incrementSql,
                                [amount, toOfficerId, varietyId, grade],
                                (err, result) => {
                                    if (err) {
                                        connection.rollback(() => {
                                            connection.release();
                                            reject(err);
                                        });
                                    } else if (result.affectedRows === 0) {
                                        connection.rollback(() => {
                                            connection.release();
                                            reject(new Error("Receiving officer record not found"));
                                        });
                                    } else {
                                        connection.commit((err) => {
                                            if (err) {
                                                connection.rollback(() => {
                                                    connection.release();
                                                    reject(err);
                                                });
                                            } else {
                                                connection.release();
                                                resolve({ message: "Target received successfully" });
                                            }
                                        });
                                    }
                                },
                            );
                        }
                    },
                );
            });
        });
    });
};

exports.getDailyTargetByOfficerAndVariety = (officerId, varietyId, grade) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT id, dailyTargetId, varietyId, officerId, grade, target, complete, createdAt
            FROM officerdailytarget
            WHERE officerId = ? AND varietyId = ? AND grade = ?;
        `;

        collectionofficer.query(
            sql,
            [officerId, varietyId, grade],
            (err, results) => {
                if (err) {
                    return reject(err);
                }
                resolve(results);
            },
        );
    });
};

exports.getOfficerSummaryDao = async (officerId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                COUNT(*) AS totalTasks,
                SUM(CASE WHEN complete >= target THEN 1 ELSE 0 END) AS completedTasks
            FROM officerdailytarget
            WHERE officerId = ?;
        `;

        collectionofficer.query(query, [officerId], (error, results) => {
            if (error) {
                console.error("Database error in getOfficerSummaryDao:", error);
                reject(error);
            } else {
                resolve(results[0]);
            }
        });
    });
};

exports.getOfficerSummaryDaoManager = async (collectionOfficerId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                COUNT(*) AS totalTasks,
                SUM(CASE WHEN complete >= target THEN 1 ELSE 0 END) AS completedTasks
            FROM officerdailytarget
            WHERE officerId = ?;
        `;

        collectionofficer.query(query, [collectionOfficerId], (error, results) => {
            if (error) {
                console.error("Database error in getOfficerSummaryDao:", error);
                reject(error);
            } else {
                resolve(results[0]);
            }
        });
    });
};
