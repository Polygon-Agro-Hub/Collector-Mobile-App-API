const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// ─── Transient SMTP error codes that are safe to retry ────────────────────────
const RETRYABLE_SMTP_CODES = new Set([421, 450, 451, 452]);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// ─── SMTP transporter (matches Polygon project config) ────────────────────────
let transporter = null;

function createTransporter() {
  const t = nodemailer.createTransport({
    pool: true, // Reuse open SMTP connections across requests
    maxConnections: 5, // Concurrent socket connections
    maxMessages: 100, // Max messages per connection before recycling
    rateDelta: 1000, // Rate limiting: 1 second
    rateLimit: 5, // Max 5 messages/sec to prevent provider throttling
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  t.verify((error) => {
    if (error) {
      console.error("❌ [EmailService] SMTP configuration error:", {
        message: error.message,
        code: error.code,
        command: error.command,
      });
    } else {
      console.log("✅ [EmailService] SMTP server verified and ready");
    }
  });

  return t;
}

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}


// ─── Handlebars helpers ───────────────────────────────────────────────────────
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

// ─── Core send with retry ─────────────────────────────────────────────────────
const sendEmail = async (
  to,
  subject,
  templateName,
  templateData,
  attachments = [],
) => {
  const startTime = Date.now();
  console.log(`\n================== 📤 [EMAIL DISPATCH START] ==================`);
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);
  console.log(`🎯 Recipient: ${to}`);
  console.log(`📝 Subject: "${subject}"`);
  console.log(`📄 Template: ${templateName}`);
  console.log(`📎 Attachments: ${attachments.length} file(s) ${attachments.map(a => `[${a.filename || 'attachment'}]`).join(', ')}`);

  // 1. Resolve template
  const templatePath = path.join(
    __dirname,
    "../email-templates",
    `${templateName}.hbs`,
  );

  if (!fs.existsSync(templatePath)) {
    const err = new Error(`[EmailService] Template not found: ${templatePath}`);
    console.error(`❌ [EmailService] Template Error: ${err.message}`);
    console.log(`================== ❌ [EMAIL DISPATCH FAILED] ==================\n`);
    throw err;
  }

  const templateContent = fs.readFileSync(templatePath, "utf8");
  const template = handlebars.compile(templateContent);
  const htmlContent = template(templateData);

  const mailOptions = {
    from: `"Polygon Agro" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html: htmlContent,
    attachments,
  };

  // 2. Send with retry on transient SMTP errors
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const attemptStartTime = Date.now();
    try {
      console.log(
        `🚀 [EmailService] Attempt ${attempt}/${MAX_RETRIES} → Dispatching to "${to}"...`
      );

      const t = getTransporter();
      const info = await t.sendMail(mailOptions);
      const attemptDuration = Date.now() - attemptStartTime;
      const totalDuration = Date.now() - startTime;

      console.log(
        `✅ [EmailService] Email successfully sent!`,
        `\n   • Message ID: ${info.messageId}`,
        `\n   • Response: ${info.response || 'OK'}`,
        `\n   • Attempt Time: ${attemptDuration}ms`,
        `\n   • Total Elapsed: ${totalDuration}ms`
      );
      console.log(`================== 🏁 [EMAIL DISPATCH SUCCESS] ==================\n`);
      return { success: true, messageId: info.messageId, durationMs: totalDuration };
    } catch (error) {
      lastError = error;
      const attemptDuration = Date.now() - attemptStartTime;
      const smtpCode = error.responseCode || error.code;

      console.error(
        `❌ [EmailService] Attempt ${attempt}/${MAX_RETRIES} failed after ${attemptDuration}ms:`,
        {
          recipient: to,
          errorMessage: error.message,
          code: error.code,
          responseCode: error.responseCode,
          command: error.command,
          response: error.response,
        }
      );

      const isTransient =
        RETRYABLE_SMTP_CODES.has(smtpCode) ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ECONNREFUSED" ||
        error.code === "ESOCKET";

      if (isTransient && attempt < MAX_RETRIES) {
        if (
          error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ESOCKET"
        ) {
          console.warn(
            `⚠️  [EmailService] Connection dropped/stale — refreshing SMTP connection pool...`
          );
          try { transporter.close(); } catch (_) {}
          transporter = createTransporter();
        }

        const delay = RETRY_DELAY_MS * attempt;
        console.log(`⏳ [EmailService] Waiting ${delay}ms before attempt ${attempt + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      break;
    }
  }

  const totalDuration = Date.now() - startTime;
  console.error(
    `💀 [EmailService] All ${MAX_RETRIES} attempts failed for "${to}" after ${totalDuration}ms`,
    {
      finalError: lastError?.message,
      smtpCode: lastError?.responseCode || lastError?.code,
    }
  );
  console.log(`================== ❌ [EMAIL DISPATCH EXHAUSTED] ==================\n`);
  throw lastError;
};

module.exports = { sendEmail };
