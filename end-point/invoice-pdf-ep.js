const targetDDao = require("../dao/distribution-manager-dao");
const invoicePdfService = require("../services/invoicePdfService");
const emailService = require("../services/emailService");

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
        
        let emailAddress =
          order.customerEmail ||
          order.customerInfo?.email ||
          order.email ||
          null;
        if (!emailAddress) {
          emailAddress = "hashinikadilrukshi15@gmail.com";
        }

        const customerName =
          order.customerInfo?.fullName ||
          order.fullName ||
          order.customerName ||
          "Valued Customer";

        const firstName = customerName.split(" ")[0] || "Valued";
        const lastName =
          customerName.split(" ").length > 1
            ? customerName.split(" ").slice(1).join(" ")
            : "Customer";

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
          subject: `Your GoViMart Invoice - ${invoiceNo}`,
          fileName: `Post_Invoice_${invoiceNo}.pdf`,
          pdfBuffer,
          customerName,
          firstName,
          lastName,
          invoiceNo,
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
