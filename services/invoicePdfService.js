const puppeteer = require("puppeteer");
const { logoBase64 } = require("./logoBase64");

const calculatePackageTotal = (pkg) => {
  const productPrice = parseFloat(pkg.productPrice || 0);
  const packingFee = parseFloat(pkg.packingFee || 0);
  const serviceFee = parseFloat(pkg.serviceFee || 0);
  return productPrice + packingFee + serviceFee;
};

const formatCurrency = (amount) => {
  const numAmount = parseFloat(amount) || 0;
  return `Rs. ${numAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

const formatNumber = (amount) => {
  const numAmount = parseFloat(amount) || 0;
  return numAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatItemCount = (count) => String(count).padStart(2, "0");

function formatPaymentMethod(paymentMethod) {
  if (!paymentMethod) return "N/A";
  const map = { Cash: "Cash on Delivery", Card: "Debit / Credit Card" };
  return map[paymentMethod] || paymentMethod;
}

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");
  } catch (e) {
    return "N/A";
  }
};

const generateInvoiceHTML = (
  orderData,
  customerData = null,
  deliveryFee = 0,
  logoBase64Val = null,
) => {
  if (!orderData) throw new Error("Order data is required for PDF generation");
  if (typeof orderData !== "object") {
    throw new Error(
      `Invalid order data type. Expected object, received ${typeof orderData}`,
    );
  }

  let order = orderData;
  let invoiceNumber =
    orderData.orderStatus?.invoiceNumber ||
    orderData.invoiceNumber ||
    orderData.invoiceNo ||
    `INV-${orderData.orderId || Date.now()}`;

  let totalPackagePrice = 0;
  let totalPackingFee = 0;
  let totalServiceFee = 0;
  let additionalItemsTotal = 0;
  let totaldiscount = parseFloat(order.discount || 0);
  let couponDiscount = parseFloat(order.couponValue || 0);

  if (
    order.isPackage === 1 &&
    order.packages &&
    Array.isArray(order.packages) &&
    order.packages.length > 0
  ) {
    order.packages.forEach((pkg) => {
      totalPackagePrice += calculatePackageTotal(pkg);
      totalPackingFee += parseFloat(pkg.packingFee || 0);
      totalServiceFee += parseFloat(pkg.serviceFee || 0);
    });
  } else if (order.isPackage === 1) {
    console.warn(
      "Order marked as package but packages array is missing or empty",
    );
  } else {
    totalServiceFee = 0;
  }

  if (
    order.additionalItems &&
    Array.isArray(order.additionalItems) &&
    order.additionalItems.length > 0
  ) {
    additionalItemsTotal =
      order.additionalItems.reduce((sum, item) => {
        const price = parseFloat(item.price?.toString() || "0");
        const discount = parseFloat(item.discount?.toString() || "0");
        return sum + price + discount;
      }, 0) || 0;
  }

  const subtotal = totalPackagePrice + additionalItemsTotal;

  const formatCustomerName = (info) => {
    const title = info.title ? info.title.trim() : "";
    const name = info.fullName || "N/A";
    return title ? `${title}. ${name}` : name;
  };

  const isFreeDelivery =
    order.isCoupon === 1 && order.couponType === "Free Delivery";
  const deliveryFeeAmount = isFreeDelivery ? 0 : parseFloat(deliveryFee || 0);

  let totalAmount = subtotal + deliveryFeeAmount;

  const shouldAddServiceFee =
    order.orderApp === "Dash" &&
    order.isPackage === 0 &&
    !order.couponValue &&
    !order.serviceFee;

  if (shouldAddServiceFee) {
    totalAmount += 180;
    totalServiceFee = 180;
  }

  totalAmount -= totaldiscount;

  if (
    order.orderApp === "Marketplace" &&
    couponDiscount > 0 &&
    !order.serviceFee
  ) {
    totalAmount -= couponDiscount;
  }

  const shouldShowServiceFee = () => shouldAddServiceFee;
  const shouldShowCouponDiscount = () =>
    order.orderApp === "Marketplace" && couponDiscount > 0 && !order.serviceFee;

  const generatePackageSections = () => {
    if (
      !order.isPackage ||
      !order.packages ||
      !Array.isArray(order.packages) ||
      order.packages.length === 0
    ) {
      return "";
    }

    return order.packages
      .map((pkg, packageIndex) => {
        const packageTotal = calculatePackageTotal(pkg);
        const packageItemsCount =
          pkg.packageItems && Array.isArray(pkg.packageItems)
            ? pkg.packageItems.length
            : 0;

        let packageDetailsRows = "";
        if (pkg.packageItems && Array.isArray(pkg.packageItems)) {
          packageDetailsRows = pkg.packageItems
            .map((item, itemIndex) => {
              const itemTotal = parseFloat(item.price || 0);
              const itemQty = parseFloat(item.qty || 0);
              const itemUnitPrice = itemQty > 0 ? itemTotal / itemQty : 0;

              return `
              <tr>
                <td style="text-align: left" class="tabledata">${itemIndex + 1}</td>
                <td class="tabledata">${item.productTypeName || item.category || "N/A"}</td>
                <td class="tabledata">${item.productDisplayName || "N/A"}</td>
                <td class="tabledata">${formatNumber(itemUnitPrice)}</td>
                <td class="tabledata">${itemQty}${item.unit || ""}</td>
                <td class="tabledata">${formatNumber(itemTotal)}</td>
              </tr>`;
            })
            .join("");
        }

        return `
        <div class="section4">
          <div style="display:flex;justify-content:space-between;margin-bottom:20px;border-bottom:1px solid #ccc;padding-bottom:10px;margin-top:40px;">
            <div class="bold">${pkg.displayName || `Package ${packageIndex + 1}`} (${formatItemCount(packageItemsCount)} Items)</div>
            <div style="font-weight:550;font-size:16px">${formatCurrency(packageTotal)}</div>
          </div>
          <div style="border:1px solid #ddd;border-radius:10px">
            ${packageDetailsRows
            ? `<table class="table">
                  <tr>
                    <th style="text-align:left;border-top-left-radius:10px">Index</th>
                    <th style="text-align:left">Category</th>
                    <th style="text-align:left">Item Description</th>
                    <th style="text-align:left">Unit Price (Rs.)</th>
                    <th style="text-align:left">QTY (Kg)</th>
                    <th style="text-align:left;border-top-right-radius:10px">Amount (Rs.)</th>
                  </tr>
                  ${packageDetailsRows}
                </table>`
            : `<div style="padding:20px;text-align:center;color:#666;">Package items not available</div>`
          }
          </div>
        </div>`;
      })
      .join("");
  };

  let additionalItemsRows = "";
  if (order?.additionalItems && order.additionalItems.length > 0) {
    additionalItemsRows = order.additionalItems
      .map((item, index) => {
        const price = parseFloat(item.price?.toString() || "0");
        const discount = parseFloat(item.discount?.toString() || "0");
        const qty = parseFloat(item.qty?.toString() || "0");
        const unit = (item.unit || "kg").toLowerCase().trim();
        const actualAmount = price + discount;
        const unitPrice = parseFloat(item.normalPrice?.toString() || "0");

        const formattedQty = `${qty}${unit}`;

        return `
      <tr>
        <td style="text-align: left; padding: 12px 8px;" class="tabledata">${index + 1}</td>
        <td style="text-align: left; padding: 12px 8px;" class="tabledata">${item.displayName || item.name || "Item"}</td>
        <td style="text-align: left; padding: 12px 8px;" class="tabledata">${formatNumber(unitPrice)}</td>
        <td style="text-align: left; padding: 12px 8px;" class="tabledata">${formattedQty}</td>
        <td style="text-align: left; padding: 12px 8px;" class="tabledata">${formatCurrency(actualAmount)}</td>
      </tr>`;
      })
      .join("");
  }

  const customerInfo = order.customerInfo || {};

  const customerEmail =
    order.customerEmail ||
    order.email ||
    customerInfo.email ||
    customerData?.email ||
    "No email provided";

  const isPickup = order.delivaryMethod === "Pickup";
  const deliveryMethodLabel = isPickup ? "Instore Pickup" : "Home Delivery";

  const buildCentreBlock = () => {
    if (!isPickup) return "";

    const centreName = order.centerName || null;
    const city = order.centerCity || null;
    const district = order.centerDistrict || null;
    const province = order.centerProvince || null;
    const country = order.centerCountry || "Sri Lanka";

    if (!centreName && !city && !district && !province) return "";

    return `
    <div style="margin-top:16px;">
      <p class="bold">Centre : <span style="font-weight:550;">${centreName || ""}</span></p>
      ${city ? `<p class="headerp">${city}${district ? `, ${district}` : ""}</p>` : ""}
      ${province ? `<p class="headerp">${province}${country ? `, ${country}` : ""}</p>` : ""}
    </div>
  `;
  };

  const buildAddressBlock = () => {
    const buildingType = orderData.customerInfo?.buildingType;

    if (buildingType === "Apartment" && orderData.apartmentAddress) {
      const apt = orderData.apartmentAddress;
      const addressParts = [];
      if (apt.buildingNo) addressParts.push({ label: "No:", value: apt.buildingNo });
      if (apt.buildingName) addressParts.push({ label: "Name:", value: apt.buildingName });
      if (apt.unitNo) addressParts.push({ label: "Flat:", value: apt.unitNo });
      if (apt.floorNo) addressParts.push({ label: "Floor:", value: apt.floorNo });
      if (apt.houseNo) addressParts.push({ label: "House No:", value: apt.houseNo });
      if (apt.streetName) addressParts.push({ label: "Street Name:", value: apt.streetName });
      if (apt.city) addressParts.push({ label: "City:", value: apt.city });

      if (addressParts.length === 0) {
        return `<p class="addr-line" style="color:#999;">Address not provided</p>`;
      }

      const linesHtml = addressParts.map((part, index) => {
        const comma = index < addressParts.length - 1 ? "," : "";
        return `<p class="addr-line" style="margin:2px 0;"><span style="color:#666666;font-weight:550;">${part.label}</span> ${part.value}${comma}</p>`;
      }).join("\n");

      return `
        <p class="bold" style="margin-bottom:4px;">Apartment Address :</p>
        ${linesHtml}
      `;
    }

    const parts = (orderData.fullAddress || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const houseNo = parts[0] || null;
    const streetName = parts[1] || null;
    const city = parts[parts.length - 1] || null;

    if (!houseNo && !streetName && !city) {
      return `<p class="addr-line" style="color:#999;">Address not provided</p>`;
    }

    const addressParts = [];
    if (houseNo) addressParts.push({ label: "House No:", value: houseNo });
    if (streetName) addressParts.push({ label: "Street Name:", value: streetName });
    if (city) addressParts.push({ label: "City:", value: city });

    const linesHtml = addressParts.map((part, index) => {
      const comma = index < addressParts.length - 1 ? "," : "";
      return `<p class="addr-line" style="margin:2px 0;"><span style="color:#666666;font-weight:555;">${part.label}</span> ${part.value}${comma}</p>`;
    }).join("\n");

    return `
      <p class="bold" style="margin-bottom:4px;">House Address :</p>
      ${linesHtml}
    `;
  };

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Purchase Invoice</title>
    <style>
      @page { 
        margin-top: 20px;
        size: A4;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: Arial, sans-serif; 
        padding: 10px; 
        margin: 0; 
        background-color: #ffffff; 
      }
      .invoice-container { 
        width: 100%; 
        max-width: 730px; 
        margin: 0 auto; 
        background: white; 
        padding: 20px; 
      }
      .top h1 { 
        color: #3e206d; 
        font-size: 20px; 
        text-align: center; 
        margin: 0 0 10px 0;
      }
      .headerp { 
        font-size: 14px; 
        margin: 2px 0; 
        line-height: 1.4; 
      }
      .addr-line { 
        font-size: 14px; 
        margin: 2px 0; 
        line-height: 1.4; 
        color: #000; 
      }
      .addr-label { 
        color: #666666; 
        font-weight: 500; 
        min-width: 85px;
        display: inline-block;
      }
      .logo { width: 120px; height: auto; }
      .bold { font-weight: 550; font-size: 14px; margin: 6px 0 2px 0; }
      .table { width: 100%; border-collapse: collapse; margin-bottom: 0px; }
      .table th, .table td { border: none; padding: 12px 8px; }
      .table th { 
        background-color: #f8f8f8; 
        font-size: 14px; 
        font-weight: 600;
        border-bottom: 1px solid #ddd;
        text-align: left;
      }
      .tabledata { font-size: 14px; font-weight: normal; color: #666666; }
      .footer { text-align: center; font-size: 12px; margin-top: 60px; color: #8492A3; }
      .remarks-text p { margin: 8px 0; line-height: 1.6; }
      .section { page-break-inside: avoid; }
      .section4 { page-break-inside: avoid; margin-bottom: 20px; }
      .ptext { font-size: 14px; margin: 0px 0; padding: 6px 0; }
      @media print {
        body { padding: 0; margin: 0; }
        .invoice-container { padding: 10px; }
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <div class="top"><h1>INVOICE</h1></div>
      
      <!-- Company Header -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:10px;">
        <div>
          <p style="margin:0 0 4px 0;"><span style="font-weight:550;font-size:16px">Polygon Holdings (Private) Ltd</span></p>
          <p class="headerp">No. 42/46, Nawam Mawatha, Colombo 02.</p>
          <p class="headerp">Contact No : +94 770 111 999</p>
          <p class="headerp">Email Address : info@polygon.lk</p>
        </div>
        <div>
          ${logoBase64Val ? `<img src="${logoBase64Val}" alt="GoviMart Logo" class="logo" />` : ""}
        </div>
      </div>

      ${isPickup
      ? `
         <!-- Pickup Layout -->
  <div style="position:relative; margin-top:30px; min-height:80px;">
    <div style="display:inline-block; max-width:55%;">
      <p class="bold">Bill To :</p>
      <p class="headerp">${formatCustomerName(customerInfo)}</p>
      <p class="headerp">${customerEmail}</p>
      <p class="headerp">${customerInfo.phoneCode1 || "+94"} ${customerInfo.phone1 || ""}${customerInfo.phone2 ? ` / ${customerInfo.phoneCode2 || "+94"} ${customerInfo.phone2}` : ""}</p>
    </div>
    <div style="position:absolute; top:0; right:0; text-align:right; min-width:200px;">
      <p class="bold">Grand Total :</p>
      <p style="font-weight:550;font-size:18px;margin:2px 0 0 0;">${formatCurrency(totalAmount)}</p>
      <div style="margin-top:12px;">
        <p class="bold">Payment Method :</p>
        <p class="headerp" style="margin-bottom:8px;">${formatPaymentMethod(orderData.orderStatus?.paymentMethod)}</p>
      </div>
      <div style="margin-top:8px;">
        <p class="bold">Ordered Date :</p>
        <p class="headerp" style="margin-bottom:8px;">${formatDate(order.createdAt)}</p>
      </div>
      <div style="margin-top:8px;">
        <p class="bold">Scheduled Date :</p>
        <p class="headerp">${formatDate(order.scheduleDate)}</p>
      </div>
    </div>
  </div>

  <!-- Invoice No, Delivery Method, Centre -->
  <div style="margin-top:20px;">
    <p class="bold">Invoice No :</p>
    <p class="headerp">${invoiceNumber}</p>
  </div>
          <div style="margin-top:16px;">
            <p class="bold">Delivery Method :</p>
            <p class="headerp">${deliveryMethodLabel}</p>
          </div>
          ${buildCentreBlock()}
        `
      : `
          <!-- Delivery Layout -->
          <div style="display:flex;justify-content:space-between;margin-top:30px;">
            <div style="flex: 1;">
              <p class="bold">Bill To :</p>
             <p class="headerp">${formatCustomerName(customerInfo)}</p>
              <p class="headerp">${customerEmail}</p>
              <p class="headerp">${customerInfo.phoneCode1 || "+94"} ${customerInfo.phone1 || ""}${customerInfo.phone2 ? ` / ${customerInfo.phoneCode2 || "+94"} ${customerInfo.phone2}` : ""}</p>
              <div style="margin-top:16px;">
                ${buildAddressBlock()}
              </div>
            </div>
            <div style="text-align: right; min-width: 200px;">
              <p class="bold">Grand Total :</p>
              <p style="font-weight:550;font-size:18px;margin:2px 0 0 0;">${formatCurrency(totalAmount)}</p>
              <div style="margin-top:12px;">
                <p class="bold">Payment Method :</p>
                <p class="headerp" style="margin-bottom:8px;">${formatPaymentMethod(orderData.orderStatus?.paymentMethod)}</p>
              </div>
              <div style="margin-top:8px;">
                <p class="bold">Ordered Date :</p>
                <p class="headerp" style="margin-bottom:8px;">${formatDate(order.createdAt)}</p>
              </div>
              <div style="margin-top:8px;">
                <p class="bold">Scheduled Date :</p>
                <p class="headerp">${formatDate(order.scheduleDate)}</p>
              </div>
            </div>
          </div>

          <!-- Invoice No & Delivery Method -->
          <div style="margin-top:24px;">
            <p class="bold">Invoice No :</p>
            <p class="headerp">${invoiceNumber}</p>
          </div>
          <div style="margin-top:16px;">
            <p class="bold">Delivery Method :</p>
            <p class="headerp">${deliveryMethodLabel}</p>
          </div>
        `
    }

      ${generatePackageSections()}

      ${order.additionalItems &&
      Array.isArray(order.additionalItems) &&
      order.additionalItems.length > 0
      ? `<div class="section4">
            <div style="display:flex;justify-content:space-between;margin-bottom:20px;border-bottom:1px solid #ccc;padding-bottom:10px;margin-top:40px;">
              <div class="bold">Additional Items (${order.additionalItems.length} Items)</div>
              <div style="font-weight:550;font-size:16px">${formatCurrency(additionalItemsTotal)}</div>
            </div>
            <div style="border:1px solid #ddd;border-radius:10px;overflow-x:auto;">
              <table style="width:100%;border-collapse:collapse;" class="table">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:12px 8px;background-color:#f8f8f8;border-bottom:1px solid #ddd;">#</th>
                    <th style="text-align:left;padding:12px 8px;background-color:#f8f8f8;border-bottom:1px solid #ddd;">Item Description</th>
                    <th style="text-align:left;padding:12px 8px;background-color:#f8f8f8;border-bottom:1px solid #ddd;">Unit Price (Rs.)</th>
                    <th style="text-align:left;padding:12px 8px;background-color:#f8f8f8;border-bottom:1px solid #ddd;">QTY</th>
                    <th style="text-align:left;padding:12px 8px;background-color:#f8f8f8;border-bottom:1px solid #ddd;">Amount (Rs.)</th>
                  </tr>
                </thead>
                <tbody>
                  ${additionalItemsRows}
                </tbody>
              </table>
            </div>
          </div>`
      : ""
    }

      <!-- Totals Section -->
      <div class="section" style="margin-top:30px;">
        <div style="margin-bottom:20px;border-bottom:1px solid #ccc;padding-bottom:10px;">
          <div class="bold">Grand Total for all items</div>
        </div>
        ${order.isPackage === 1 && totalPackagePrice > 0
      ? `<div style="display:flex;justify-content:space-between;margin-right:20px;" class="ptext">
              <p>${order.packages?.length === 1 ? order.packages[0].displayName || "Package" : "Total Price for Packages"}</p>
              <p>${formatCurrency(totalPackagePrice)}</p>
            </div>`
      : ""
    }
        ${order.additionalItems &&
      Array.isArray(order.additionalItems) &&
      order.additionalItems.length > 0
      ? `<div style="display:flex;justify-content:space-between;margin-right:20px;" class="ptext">
              <p>${order?.isPackage === 1 ? "Additional Items" : "Custom Items"}</p>
              <p>Rs. ${additionalItemsTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</p>
            </div>`
      : ""
    }
        ${shouldShowServiceFee()
      ? `<div style="display:flex;justify-content:space-between;margin-right:20px;" class="ptext">
              <p>Service Fee</p><p>Rs. 180.00</p>
            </div>`
      : ""
    }
        ${!isFreeDelivery && deliveryFeeAmount > 0
      ? `<div style="display:flex;justify-content:space-between;margin-right:20px;" class="ptext">
              <p>Delivery Fee</p><p>${formatCurrency(deliveryFeeAmount)}</p>
            </div>`
      : ""
    }
        ${shouldShowCouponDiscount()
      ? `<div style="display:flex;justify-content:space-between;margin-right:20px;" class="ptext">
              <p>Coupon Discount</p><p>${formatCurrency(couponDiscount)}</p>
            </div>`
      : ""
    }
      </div>

      ${totaldiscount > 0
      ? `<div style="display:flex;justify-content:space-between;margin-right:20px;" class="ptext">
            <p>Discount</p><p>${formatCurrency(totaldiscount)}</p>
          </div>`
      : ""
    }

      <div style="margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:10px;"></div>

      <div style="margin-top:-10px;display:flex;justify-content:space-between;font-size:16px;font-weight:600;margin-right:20px;">
        <p>Grand Total</p>
        <p>${formatCurrency(totalAmount)}</p>
      </div>

      <!-- Remarks Section -->
      <div class="section">
        <p style="margin-top:50px;font-size:14px;font-weight:600;margin-bottom:12px;">Remarks :</p>
        <div class="remarks-text" style="color:#666666;font-size:12px;">
          <p style="margin-bottom:12px;">Kindly inspect all goods at the time of delivery to ensure accuracy and condition.</p>
          <p style="margin-bottom:12px;">Polygon does not accept returns under any circumstances.</p>
          <p style="margin-bottom:12px;">Please report any issues or discrepancies within 24 hours of delivery to ensure prompt attention.</p>
          <p style="margin-bottom:12px;">For any assistance, feel free to contact our customer service team.</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p style="margin-top:50px;font-size:16px;font-weight:600;color:#000;font-style:italic">Thank you for shopping with us!</p>
        <p style="margin-top:6px;font-size:14px;font-weight:500;color:#4B4B4B;font-style:italic">WE WILL SEND YOU MORE OFFERS, LOWEST PRICED VEGGIES FROM US.</p>
        <p style="margin-top:50px;font-style:italic">- THIS IS A COMPUTER GENERATED INVOICE, THUS NO SIGNATURE REQUIRED -</p>
      </div>
    </div>
  </body>
</html>`;
};

const generateOrderPDF = async (orderData, deliveryFee = 0) => {
  let browser;
  try {
    const htmlContent = generateInvoiceHTML(
      orderData,
      null,
      deliveryFee,
      logoBase64,
    );

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    await browser.close();
    return pdfBuffer;
  } catch (error) {
    if (browser) await browser.close();
    console.error("PDF generation error:", error);
    throw error;
  }
};

module.exports = { generateOrderPDF };
