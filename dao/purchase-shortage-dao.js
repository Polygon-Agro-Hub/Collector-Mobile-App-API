const db = require("../startup/database");

exports.getShortagesForOfficer = async (officerId) => {
  const sql = `
    SELECT 
      sa.id AS srtAssignId,
      sa.status AS assignStatus,
      s.mpItemId,
      s.shortageQty,
      sa.qty,
      sa.ceilling AS ceilingPercent,
      mi.displayName AS name,
      cv.image,
      mp.price AS gradeAPrice,
      COALESCE(sp.totalPrchQty, 0) AS prchQty,
      sp.lastPrchPrice AS prchPrice,
      sp.lastSlip AS slip,
      sp.reqStatus
    FROM collection_officer.shortageassigned sa
    INNER JOIN collection_officer.shortage s ON sa.shortageassigned = s.id
    INNER JOIN market_place.marketplaceitems mi ON s.mpItemId = mi.id
    LEFT JOIN plant_care.cropvariety cv ON mi.varietyId = cv.id
    LEFT JOIN collection_officer.marketprice mp ON mp.id = (
      SELECT MAX(id) FROM collection_officer.marketprice 
      WHERE varietyId = mi.varietyId AND grade = 'A'
    )
    LEFT JOIN (
      SELECT 
        srtAssignId,
        SUM(prchQty) AS totalPrchQty,
        MAX(prchPrice) AS lastPrchPrice,
        MAX(slip) AS lastSlip,
        MAX(reqStatus) AS reqStatus
      FROM collection_officer.shortagepurchase
      GROUP BY srtAssignId
    ) sp ON sa.id = sp.srtAssignId
    WHERE sa.status = 'Finalize'
      AND sa.assignOfficerId = ?
      AND sa.assignOfficerId IS NOT NULL
      AND DATE(sa.finalizeAt) = CURDATE()
    ORDER BY sa.id DESC;
  `;

  const [rows] = await db.collectionofficer.promise().query(sql, [officerId]);

  return rows.map((row) => {
    const gradeAPrice = row.gradeAPrice ? parseFloat(row.gradeAPrice) : 200;
    const ceilingPercent = row.ceilingPercent ? parseFloat(row.ceilingPercent) : 0;
    const calculatedCeilingPrice = gradeAPrice + (gradeAPrice * (ceilingPercent / 100));

    const assignedQty = parseFloat(row.qty || 0);
    const prchQty = parseFloat(row.prchQty || 0);
    const remainingKg = Math.max(0, assignedQty - prchQty);

    const isCompleted = remainingKg === 0;

    return {
      srtAssignId: row.srtAssignId,
      mpItemId: row.mpItemId,
      name: row.name,
      assignedQty: assignedQty,
      kg: remainingKg,
      shortageQty: parseFloat(row.shortageQty || 0),
      ceilingPercent: ceilingPercent,
      ceilingPrice: parseFloat(calculatedCeilingPrice.toFixed(2)),
      gradeAPrice: gradeAPrice,
      image: row.image || "https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=200&auto=format&fit=crop&q=80",
      reqStatus: row.reqStatus || (isCompleted ? "Completed" : "Pending"),
      assignStatus: row.assignStatus,
      prchQty: prchQty,
      prchPrice: row.prchPrice ? parseFloat(row.prchPrice) : null,
      slip: row.slip || null,
    };
  });
};


exports.submitShortagePurchase = async ({
  srtAssignId,
  prchQty,
  prchPrice,
  slip,
  reqStatus = "Pending",
}) => {
  const checkSql = `
    SELECT 
      sa.qty AS assignedQty, 
      COALESCE(SUM(sp.prchQty), 0) AS existingPrchQty
    FROM collection_officer.shortageassigned sa
    LEFT JOIN collection_officer.shortagepurchase sp ON sa.id = sp.srtAssignId
    WHERE sa.id = ?
    GROUP BY sa.id;
  `;

  const [checkRows] = await db.collectionofficer.promise().query(checkSql, [srtAssignId]);

  if (checkRows.length === 0) {
    const err = new Error("Shortage assignment not found");
    err.statusCode = 404;
    throw err;
  }

  const assignedQty = parseFloat(checkRows[0].assignedQty || 0);
  const existingPrchQty = parseFloat(checkRows[0].existingPrchQty || 0);
  const remainingKg = Math.max(0, assignedQty - existingPrchQty);

  if (prchQty > remainingKg) {
    const err = new Error(
      `Purchased quantity (${prchQty} kg) exceeds remaining assigned shortage (${remainingKg} kg)`
    );
    err.statusCode = 400;
    throw err;
  }

  const sql = `
    INSERT INTO collection_officer.shortagepurchase 
      (srtAssignId, prchQty, prchPrice, slip, reqStatus)
    VALUES (?, ?, ?, ?, ?);
  `;

  const [result] = await db.collectionofficer.promise().query(sql, [
    srtAssignId,
    prchQty,
    prchPrice,
    slip || null,
    reqStatus || "Pending",
  ]);

  return result;
};
