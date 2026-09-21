const targetDDao = require("../../dao/distribution/distribution-manager-dao");
const invoicePdfService = require("../../services/invoicePdfService");
const emailService = require("../../services/emailService");

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

    const extractFee = (charge) => {
      if (charge === null || charge === undefined) return 0;
      if (typeof charge === "number") return charge;
      if (typeof charge === "string")
        return parseFloat(charge.replace(/[^\d.]/g, "")) || 0;
      return 0;
    };

    // Process orders
    for (const orderId of orderIds) {
      try {
        const order = await targetDDao.getOrderById(orderId);
        if (!order || order.message) {
          throw new Error(order?.message || `Order ${orderId} not found`);
        }

        const invoiceNo =
          order.invoiceNo ||
          order.invoiceNumber ||
          order.orderStatus?.invoiceNumber ||
          order.orderId ||
          orderId;

        // Calculate delivery fee
        let deliveryFee = 0;
        const isFreeDelivery =
          order.isCoupon === 1 && order.couponType === "Free Delivery";

        if (!isFreeDelivery && order.delivaryMethod !== "Pickup") {
          let cityFromAddress = null;
          if (order.fullAddress && typeof order.fullAddress === "string") {
            const addressParts = order.fullAddress
              .split(",")
              .map((part) => part.trim());
            if (addressParts.length > 0) {
              cityFromAddress = addressParts[addressParts.length - 1];
            }
          }

          if (!cityFromAddress || cityFromAddress.trim() === "") {
            const customerInfo = order.customerInfo || {};
            cityFromAddress = customerInfo.city || order.city || null;
          }

          if (cityFromAddress && cityFromAddress.trim() !== "") {
            const searchCityName = cityFromAddress.toLowerCase().trim();
            const cityData = cities.find((c) => {
              if (!c.city) return false;
              return c.city.toLowerCase().trim() === searchCityName;
            });

            if (cityData) {
              deliveryFee = extractFee(cityData.charge);
            } else {
              const partialMatch = cities.find((c) => {
                if (!c.city) return false;
                const dbCityName = c.city.toLowerCase().trim();
                return (
                  dbCityName.includes(searchCityName) ||
                  searchCityName.includes(dbCityName)
                );
              });
              deliveryFee = partialMatch ? extractFee(partialMatch.charge) : 0;
            }
          }
        }

        // Generate PDF buffer
        const pdfBuffer = await invoicePdfService.generateOrderPDF(order, deliveryFee);

        // email lives inside customerInfo in getOrderById return shape
        let emailAddress =
          order.customerInfo?.email ||
          order.customerEmail ||
          order.email ||
          null;

        if (!emailAddress) {
          console.warn(`[processDeliveryInvoices] No email for orderId=${orderId} — skipping this order`);
          errors.push({ orderId, error: "No customer email found" });
          continue;
        }

        const customerName =
          order.customerInfo?.fullName ||
          order.fullName ||
          order.customerName ||
          "Valued Customer";

        const nameParts = customerName.trim().split(" ");
        const firstName = nameParts[0] || "Valued";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Customer";

        // Resolve invoiceNo from the correct nested path
        const resolvedInvoiceNo =
          order.orderStatus?.invoiceNumber ||
          invoiceNo ||
          orderId;

        // Calculate totalAmount matching frontend
        let calculatedTotal = 0;

        if (order.packages && Array.isArray(order.packages)) {
          order.packages.forEach((pkg) => {
            calculatedTotal +=
              parseFloat(pkg.productPrice || 0) +
              parseFloat(pkg.packingFee || 0) +
              parseFloat(pkg.serviceFee || 0);
          });
        }

        if (order.additionalItems && Array.isArray(order.additionalItems)) {
          order.additionalItems.forEach((item) => {
            calculatedTotal +=
              parseFloat(item.price || 0) + parseFloat(item.discount || 0);
          });
        }

        if (!isFreeDelivery && order.delivaryMethod !== "Pickup") {
          calculatedTotal += deliveryFee;
        }

        if (
          order.orderApp === "Dash" &&
          order.isPackage === 0 &&
          !order.couponValue &&
          !order.serviceFee
        ) {
          calculatedTotal += 180;
        }

        calculatedTotal -= parseFloat(order.discount || 0);

        if (
          order.orderApp === "Marketplace" &&
          parseFloat(order.couponValue || 0) > 0 &&
          !order.serviceFee
        ) {
          calculatedTotal -= parseFloat(order.couponValue || 0);
        }

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
        console.error(`Failed to send email to ${emailItem.email} for order ${emailItem.invoiceNo}:`, emailErr);
        errors.push({ orderId: emailItem.invoiceNo, error: `Email send failed: ${emailErr.message}` });
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
    const [poRows] = await db.collectionofficer.promise().query(resolveMasterOrderSql, [orderIdInput]);
    if (poRows && poRows.length > 0 && poRows[0].orderId) {
      masterOrderId = poRows[0].orderId;
    }
    console.log(`${tag} Resolved masterOrderId=${masterOrderId}`);

    const order = await targetDDao.getOrderById(masterOrderId);
    if (!order || order.message) {
      console.warn(`${tag} Order not found for masterOrderId=${masterOrderId}. Skipping email.`);
      return { success: false, message: "Order not found" };
    }

    // ── 1. Resolve email ──────────────────────────────────────────────────────
    // email lives inside customerInfo (from getOrderById return shape).
    // Fall back to a direct DB lookup on marketplaceusers if still missing.
    let emailAddress =
      order.customerInfo?.email ||
      order.email ||
      order.customerEmail ||
      null;

    if (!emailAddress && order.userId) {
      try {
        const [uRows] = await db.collectionofficer.promise().query(
          "SELECT email FROM marketplaceusers WHERE id = ? LIMIT 1",
          [order.userId]
        );
        if (uRows && uRows.length > 0 && uRows[0].email) {
          emailAddress = uRows[0].email;
          console.log(`${tag} Resolved email from marketplaceusers: ${emailAddress}`);
        }
      } catch (uErr) {
        console.error(`${tag} Error looking up email from marketplaceusers:`, uErr);
      }
    }

    if (!emailAddress) {
      console.warn(`${tag} No customer email found. Cannot send invoice email.`);
      return { success: false, message: "No customer email found" };
    }

    // ── 2. Resolve invoiceNo ──────────────────────────────────────────────────
    // invoiceNumber is inside order.orderStatus, not at root level.
    const invoiceNo =
      order.orderStatus?.invoiceNumber ||
      order.invoiceNo ||
      order.invoiceNumber ||
      masterOrderId;

    // ── 3. Resolve customer name ──────────────────────────────────────────────
    const customerName =
      order.customerInfo?.fullName ||
      order.fullName ||
      order.customerName ||
      "Valued Customer";

    const nameParts = customerName.trim().split(" ");
    const firstName = nameParts[0] || "Valued";
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Customer";
    const fullName = `${firstName} ${lastName}`.trim();

    // ── 4. Delivery fee ───────────────────────────────────────────────────────
    const cities = await targetDDao.getAllCity();
    const extractFee = (charge) => {
      if (charge === null || charge === undefined) return 0;
      if (typeof charge === "number") return charge;
      if (typeof charge === "string")
        return parseFloat(charge.replace(/[^\d.]/g, "")) || 0;
      return 0;
    };

    let deliveryFee = 0;
    const isFreeDelivery = order.isCoupon === 1 && order.couponType === "Free Delivery";
    const isPickup = (order.delivaryMethod || "").toLowerCase().includes("pickup");

    if (!isFreeDelivery && !isPickup) {
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
      if (cityFromAddress && cityFromAddress.trim() !== "") {
        const searchCityName = cityFromAddress.toLowerCase().trim();
        const cityData = cities.find((c) => c.city && c.city.toLowerCase().trim() === searchCityName);
        if (cityData) {
          deliveryFee = extractFee(cityData.charge);
        } else {
          const partialMatch = cities.find((c) => c.city && (
            c.city.toLowerCase().trim().includes(searchCityName) ||
            searchCityName.includes(c.city.toLowerCase().trim())
          ));
          deliveryFee = partialMatch ? extractFee(partialMatch.charge) : 0;
        }
      }
    }

    // ── 5. Generate PDF ───────────────────────────────────────────────────────
    let pdfBuffer;
    try {
      pdfBuffer = await invoicePdfService.generateOrderPDF(order, deliveryFee);
    } catch (pdfErr) {
      console.error(`${tag} Failed to generate PDF:`, pdfErr.message);
      return { success: false, message: `PDF generation failed: ${pdfErr.message}` };
    }

    // ── 6. Calculate total ────────────────────────────────────────────────────
    let calculatedTotal = 0;
    if (order.packages && Array.isArray(order.packages)) {
      order.packages.forEach((pkg) => {
        calculatedTotal += parseFloat(pkg.productPrice || 0) + parseFloat(pkg.packingFee || 0) + parseFloat(pkg.serviceFee || 0);
      });
    }
    if (order.additionalItems && Array.isArray(order.additionalItems)) {
      order.additionalItems.forEach((item) => {
        calculatedTotal += parseFloat(item.price || 0) + parseFloat(item.discount || 0);
      });
    }
    if (!isFreeDelivery && !isPickup) {
      calculatedTotal += deliveryFee;
    }
    if (order.orderApp === "Dash" && order.isPackage === 0 && !order.couponValue && !order.serviceFee) {
      calculatedTotal += 180;
    }
    calculatedTotal -= parseFloat(order.discount || 0);
    if (order.orderApp === "Marketplace" && parseFloat(order.couponValue || 0) > 0 && !order.serviceFee) {
      calculatedTotal -= parseFloat(order.couponValue || 0);
    }

    // ── 7. Send email (retry logic is inside emailService.sendEmail) ──────────
    console.log(`${tag} Sending invoice email to "${emailAddress}" for invoice ${invoiceNo}`);
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
      ]
    );

    console.log(`✅ ${tag} Post Invoice email sent to "${emailAddress}" for invoice ${invoiceNo} (isPickup: ${isPickup})`);
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

