const puppeteer = require("puppeteer-core");
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

const getLocalChromePath = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const possiblePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
    process.env.PROGRAMFILES ? `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe` : null,
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
};

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

    let launchArgs = {
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      defaultViewport: null,
      headless: "new",
    };

    const localChrome = getLocalChromePath();
    if (localChrome) {
      launchArgs.executablePath = localChrome;
    } else {
      try {
        const chromium = (await import("@sparticuz/chromium")).default;
        launchArgs.args = [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"];
        launchArgs.defaultViewport = chromium.defaultViewport;
        launchArgs.executablePath = await chromium.executablePath();
        launchArgs.headless = chromium.headless;
      } catch (e) {
        console.warn("Could not load @sparticuz/chromium fallback:", e.message);
      }
    }

    browser = await puppeteer.launch(launchArgs);

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
