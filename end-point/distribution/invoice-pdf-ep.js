const targetDDao = require("../../dao/distribution/distribution-manager-dao");
const invoicePdfService = require("../../services/invoicePdfService");
const emailService = require("../../services/emailService");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const extractFee = (charge) => {
  if (charge === null || charge === undefined) return 0;
  if (typeof charge === "number") return charge;
  if (typeof charge === "string")
    return parseFloat(charge.replace(/[^\d.]/g, "")) || 0;
  return 0;
};

const isPickupOrder = (order) =>
  (order.delivaryMethod || "").toLowerCase().includes("pickup");

const isFreeDeliveryOrder = (order) =>
  order.isCoupon === 1 && order.couponType === "Free Delivery";

// Works out the delivery fee from the city at the end of the address.
const resolveDeliveryFee = (order, cities) => {
  if (isFreeDeliveryOrder(order) || isPickupOrder(order)) return 0;

  let cityFromAddress = null;
  if (order.fullAddress && typeof order.fullAddress === "string") {
    const addressParts = order.fullAddress.split(",").map((part) => part.trim());
    if (addressParts.length > 0) {
      cityFromAddress = addressParts[addressParts.length - 1];
    }
  }

  if (!cityFromAddress || cityFromAddress.trim() === "") {
    cityFromAddress = order.customerInfo?.city || order.city || null;
  }

  if (!cityFromAddress || cityFromAddress.trim() === "") return 0;

  const searchCityName = cityFromAddress.toLowerCase().trim();

  const exact = cities.find(
    (c) => c.city && c.city.toLowerCase().trim() === searchCityName,
  );
  if (exact) return extractFee(exact.charge);

  const partial = cities.find((c) => {
    if (!c.city) return false;
    const dbCityName = c.city.toLowerCase().trim();
    return (
      dbCityName.includes(searchCityName) ||
      searchCityName.includes(dbCityName)
    );
  });
  return partial ? extractFee(partial.charge) : 0;
};

// Price of one package, matching the invoice PDF:
//   reviewValue != 0 / NULL -> SUM(orderpackageitems.price) + Packing Fee + Service Fee
//   reviewValue = 0 / NULL  -> marketplacepackages.productPrice + Packing Fee + Service Fee
const calculatePackageAmount = (pkg) => {
  const itemsSum = (Array.isArray(pkg.packageItems) ? pkg.packageItems : []).reduce(
    (sum, item) => sum + (parseFloat(item.price) || 0),
    0,
  );
  const packingFee = parseFloat(pkg.packingFee ?? pkg.packagePackingFee ?? 0) || 0;
  const serviceFee = parseFloat(pkg.serviceFee ?? pkg.packageServiceFee ?? 0) || 0;
  const packagePrice = parseFloat(pkg.productPrice ?? pkg.packagePrice ?? 0) || 0;

  const reviewValue = parseFloat(pkg.reviewValue);
  const isReviewed = !isNaN(reviewValue) && reviewValue !== 0;

  if (isReviewed || packagePrice <= 0) {
    return itemsSum + packingFee + serviceFee;
  }
  return packagePrice + packingFee + serviceFee;
};

// Grand total, kept in line with the invoice PDF.
const calculateInvoiceTotal = (order, deliveryFee) => {
  const isFreeDelivery = isFreeDeliveryOrder(order);
  const isPickup = isPickupOrder(order);
  const effectiveDeliveryFee = !isFreeDelivery && !isPickup ? deliveryFee : 0;

  let total = 0;

  if (order.packages && Array.isArray(order.packages)) {
    order.packages.forEach((pkg) => {
      total += calculatePackageAmount(pkg);
    });
  }

  if (order.additionalItems && Array.isArray(order.additionalItems)) {
    order.additionalItems.forEach((item) => {
      total += parseFloat(item.price || 0) + parseFloat(item.discount || 0);
    });
  }

  total += effectiveDeliveryFee;

  // Non-package orders: service fee = fullTotal - additional items - delivery
  if (order.isPackage === 0) {
    const sumAdditionalPrice = (order.additionalItems || []).reduce(
      (sum, item) => sum + (parseFloat(item.price || 0) || 0),
      0,
    );
    const poFullTotal = parseFloat(
      order.fullTotal || order.orderStatus?.fullTotal || 0,
    );
    let serviceFee = 0;
    if (poFullTotal > 0) {
      serviceFee = Math.max(
        0,
        poFullTotal - sumAdditionalPrice - effectiveDeliveryFee,
      );
    } else if (order.serviceFee !== undefined && order.serviceFee !== null) {
      serviceFee = parseFloat(order.serviceFee) || 0;
    }
    total += serviceFee;
  }

  total -= parseFloat(order.discount || 0);

  if (
    order.orderApp === "Marketplace" &&
    parseFloat(order.couponValue || 0) > 0 &&
    !order.serviceFee
  ) {
    total -= parseFloat(order.couponValue || 0);
  }

  return total;
};

const splitCustomerName = (customerName) => {
  const nameParts = customerName.trim().split(" ");
  const firstName = nameParts[0] || "Valued";
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Customer";
  return { firstName, lastName };
};

// ─── Bulk: generate + email invoices for a list of orders ─────────────────────

exports.processDeliveryInvoices = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or empty order IDs list",
      });
    }

    const emailsData = [];
    const errors = [];

    // Fetch delivery city list once to avoid repeated DB calls
    const cities = await targetDDao.getAllCity();

    for (const orderId of orderIds) {
      try {
        const order = await targetDDao.getOrderById(orderId);
        if (!order || order.message) {
          throw new Error(order?.message || `Order ${orderId} not found`);
        }

        const deliveryFee = resolveDeliveryFee(order, cities);

        // Generate PDF buffer
        const pdfBuffer = await invoicePdfService.generateOrderPDF(
          order,
          deliveryFee,
        );

        // email lives inside customerInfo in getOrderById return shape
        const emailAddress =
          order.customerInfo?.email ||
          order.customerEmail ||
          order.email ||
          null;

        if (!emailAddress) {
          console.warn(
            `[processDeliveryInvoices] No email for orderId=${orderId} — skipping this order`,
          );
          errors.push({ orderId, error: "No customer email found" });
          continue;
        }

        const customerName =
          order.customerInfo?.fullName ||
          order.fullName ||
          order.customerName ||
          "Valued Customer";

        const { firstName, lastName } = splitCustomerName(customerName);

        // Resolve invoiceNo from the correct nested path
        const resolvedInvoiceNo =
          order.orderStatus?.invoiceNumber ||
          order.invoiceNo ||
          order.invoiceNumber ||
          order.orderId ||
          orderId;

        const calculatedTotal = calculateInvoiceTotal(order, deliveryFee);

        emailsData.push({
          email: emailAddress,
          subject: `Your Polygon Invoice - ${resolvedInvoiceNo}`,
          fileName: `Post_Invoice_${resolvedInvoiceNo}.pdf`,
          pdfBuffer,
          customerName,
          firstName,
          lastName,
          invoiceNo: resolvedInvoiceNo,
          totalAmount: calculatedTotal,
        });
      } catch (err) {
        console.error(`Error processing order ${orderId}:`, err);
        errors.push({ orderId, error: err.message });
      }
    }

    let emailsSent = 0;
    for (const emailItem of emailsData) {
      try {
        const resolvedFirstName = emailItem.firstName || "Valued Customer";
        const resolvedLastName = emailItem.lastName || "";
        const fullName = `${resolvedFirstName} ${resolvedLastName}`.trim();

        await emailService.sendEmail(
          emailItem.email,
          emailItem.subject,
          "welcom",
          {
            firstName: resolvedFirstName,
            lastName: resolvedLastName,
            fullName,
            invoiceNumber: emailItem.invoiceNo || "N/A",
            totalAmount: parseFloat(emailItem.totalAmount) || 0,
            message: "Thank you for your order!",
          },
          [
            {
              filename: emailItem.fileName || "invoice.pdf",
              content: emailItem.pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        );
        emailsSent++;
      } catch (emailErr) {
        console.error(
          `Failed to send email to ${emailItem.email} for order ${emailItem.invoiceNo}:`,
          emailErr,
        );
        errors.push({
          orderId: emailItem.invoiceNo,
          error: `Email send failed: ${emailErr.message}`,
        });
      }
    }

    res.status(200).json({
      success: true,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in processDeliveryInvoices endpoint:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while processing delivery invoices",
      error: error.message,
    });
  }
};

// ─── Single: generate + email the post invoice for one order ──────────────────

/**
 * Automatically generates and sends Post Invoice PDF to the customer's registered email
 * for a specific orderId (or processOrderId).
 */
exports.sendSinglePostInvoiceEmail = async (orderIdInput) => {
  const tag = `[InvoiceEmail orderId=${orderIdInput}]`;
  try {
    const db = require("../../startup/database");
    let masterOrderId = orderIdInput;

    // Resolve master order ID if processOrderId was passed
    const resolveMasterOrderSql = `
      SELECT orderId FROM processorders 
      WHERE id = ? LIMIT 1
    `;
    let targetProcessOrderId = null;
    const [poRows] = await db.collectionofficer
      .promise()
      .query(resolveMasterOrderSql, [orderIdInput]);
    if (poRows && poRows.length > 0 && poRows[0].orderId) {
      masterOrderId = poRows[0].orderId;
      targetProcessOrderId = orderIdInput;
    }
    console.log(
      `${tag} Resolved masterOrderId=${masterOrderId}, targetProcessOrderId=${targetProcessOrderId}`,
    );

    const order = await targetDDao.getOrderById(
      masterOrderId,
      targetProcessOrderId,
    );
    if (!order || order.message) {
      console.warn(
        `${tag} Order not found for masterOrderId=${masterOrderId}. Skipping email.`,
      );
      return { success: false, message: "Order not found" };
    }

    // ── 1. Resolve email ────────────────────────────────────────────────────
    // email lives inside customerInfo (from getOrderById return shape).
    // Fall back to a direct DB lookup on marketplaceusers if still missing.
    let emailAddress =
      order.customerInfo?.email || order.email || order.customerEmail || null;

    if (!emailAddress && order.userId) {
      try {
        const [uRows] = await db.collectionofficer
          .promise()
          .query("SELECT email FROM marketplaceusers WHERE id = ? LIMIT 1", [
            order.userId,
          ]);
        if (uRows && uRows.length > 0 && uRows[0].email) {
          emailAddress = uRows[0].email;
          console.log(
            `${tag} Resolved email from marketplaceusers: ${emailAddress}`,
          );
        }
      } catch (uErr) {
        console.error(
          `${tag} Error looking up email from marketplaceusers:`,
          uErr,
        );
      }
    }

    if (!emailAddress) {
      console.warn(`${tag} No customer email found. Cannot send invoice email.`);
      return { success: false, message: "No customer email found" };
    }

    // ── 2. Resolve invoiceNo ────────────────────────────────────────────────
    // invoiceNumber is inside order.orderStatus, not at root level.
    const invoiceNo =
      order.orderStatus?.invoiceNumber ||
      order.invoiceNo ||
      order.invoiceNumber ||
      masterOrderId;

    // ── 3. Resolve customer name ────────────────────────────────────────────
    const customerName =
      order.customerInfo?.fullName ||
      order.fullName ||
      order.customerName ||
      "Valued Customer";

    const { firstName, lastName } = splitCustomerName(customerName);
    const fullName = `${firstName} ${lastName}`.trim();

    // ── 4. Delivery fee ─────────────────────────────────────────────────────
    const cities = await targetDDao.getAllCity();
    const deliveryFee = resolveDeliveryFee(order, cities);
    const isPickup = isPickupOrder(order);

    // ── 5. Generate PDF ─────────────────────────────────────────────────────
    let pdfBuffer;
    try {
      pdfBuffer = await invoicePdfService.generateOrderPDF(order, deliveryFee);
    } catch (pdfErr) {
      console.error(`${tag} Failed to generate PDF:`, pdfErr.message);
      return {
        success: false,
        message: `PDF generation failed: ${pdfErr.message}`,
      };
    }

    // ── 6. Calculate total ──────────────────────────────────────────────────
    const calculatedTotal = calculateInvoiceTotal(order, deliveryFee);

    // ── 7. Send email (retry logic is inside emailService.sendEmail) ────────
    console.log(
      `${tag} Sending invoice email to "${emailAddress}" for invoice ${invoiceNo}`,
    );
    await emailService.sendEmail(
      emailAddress,
      `Your Polygon Invoice - ${invoiceNo}`,
      "welcom",
      {
        firstName,
        lastName,
        fullName,
        invoiceNumber: invoiceNo || "N/A",
        totalAmount: parseFloat(calculatedTotal) || 0,
        message: "Thank you for your order!",
      },
      [
        {
          filename: `Post_Invoice_${invoiceNo}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    );

    console.log(
      `✅ ${tag} Post Invoice email sent to "${emailAddress}" for invoice ${invoiceNo} (isPickup: ${isPickup})`,
    );
    return { success: true };
  } catch (err) {
    console.error(`❌ ${tag} Failed to send post invoice email:`, {
      message: err.message,
      smtpCode: err.responseCode || err.code,
      stack: err.stack,
    });
    return { success: false, error: err.message };
  }
};