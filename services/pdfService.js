const puppeteer = require("puppeteer");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");

handlebars.registerHelper("safe", function (obj, key) {
    return obj && obj[key] ? obj[key] : "";
});

handlebars.registerHelper("formatCurrency", function (amount) {
    return Number(amount).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
});

handlebars.registerHelper("formatDate", function (date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
});

handlebars.registerHelper("isEqual", function (a, b) {
    return a === b;
});

const generateInvoicePDF = async (orderData) => {
    let browser;
    try {
        const templatePath = path.join(
            __dirname,
            "../email-templates",
            "welcom.hbs",
        );
        const templateContent = fs.readFileSync(templatePath, "utf8");
        const template = handlebars.compile(templateContent);
        const htmlContent = template(orderData);

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
        console.error("Error generating PDF:", error);
        throw error;
    }
};

module.exports = { generateInvoicePDF };
