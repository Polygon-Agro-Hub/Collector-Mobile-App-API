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
  // 1. Resolve template
  const templatePath = path.join(
    __dirname,
    "../email-templates",
    `${templateName}.hbs`,
  );

  if (!fs.existsSync(templatePath)) {
    const err = new Error(`[EmailService] Template not found: ${templatePath}`);
    console.error(err.message);
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
    try {
      console.log(
        `📧 [EmailService] Sending email to "${to}" | subject: "${subject}" | attempt ${attempt}/${MAX_RETRIES}`
      );

      const t = getTransporter();
      const info = await t.sendMail(mailOptions);

      console.log(
        `✅ [EmailService] Email sent to "${to}" | messageId: ${info.messageId} | attempt ${attempt}`
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      lastError = error;
      const smtpCode = error.responseCode || error.code;

      console.error(
        `❌ [EmailService] Attempt ${attempt}/${MAX_RETRIES} failed to send email to "${to}":`,
        {
          message: error.message,
          smtpCode,
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
        // Recreate transporter on connection errors to clear stale pool
        if (
          error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ESOCKET"
        ) {
          console.warn(
            `⚠️  [EmailService] Connection error detected — recreating SMTP transporter`
          );
          try { transporter.close(); } catch (_) {}
          transporter = createTransporter();
        }

        const delay = RETRY_DELAY_MS * attempt;
        console.log(`⏳ [EmailService] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable or exhausted retries — break immediately
      break;
    }
  }

  // All retries exhausted or non-retryable error
  console.error(
    `💀 [EmailService] All ${MAX_RETRIES} attempts failed for email to "${to}" | subject: "${subject}"`,
    {
      finalError: lastError?.message,
      smtpCode: lastError?.responseCode || lastError?.code,
    }
  );
  throw lastError;
};

module.exports = { sendEmail };
