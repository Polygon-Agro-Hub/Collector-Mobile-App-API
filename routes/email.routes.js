const express = require("express");
const router = express.Router();
const emailService = require("../services/emailService");

router.post("/send-test-email", async (req, res) => {
  try {
    const { email } = req.body;

    await emailService.sendEmail(email, "Welcome to AgroWorld", "welcom", {
      name: "New User",
      message: "Thank you for registering with AgroWorld!",
      year: new Date().getFullYear(),
      title: "Welcome Email",
    });

    res.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
});

router.post("/send-pdf-email", async (req, res) => {
  try {
    const emailsData = req.body;

    if (!Array.isArray(emailsData) || emailsData.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No email data provided" });
    }

    for (const item of emailsData) {
      const { email, pdfBase64, fileName } = item;

      if (!email || !pdfBase64) {
        console.warn("Skipping invalid item:", item);
        continue;
      }

      const pdfBuffer = Buffer.from(pdfBase64, "base64");

      await emailService.sendEmail(
        email,
        "Your AgroWorld Invoice",
        "welcom",
        { message: "Thank you for your order!" },
        [
          {
            filename: fileName || "invoice.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      );
    }

    res.json({ success: true, message: "All emails sent successfully" });
  } catch (error) {
    console.error("Error sending PDF emails:", error);
    res.status(500).json({ success: false, message: "Failed to send emails" });
  }
});

module.exports = router;
