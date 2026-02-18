const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify connection
transporter.verify((error) => {
  if (error) {
    console.error('❌ Error with email configuration:', error);
  } else {
    console.log('✅ Email server is ready');
  }
});

// Register Handlebars helpers
handlebars.registerHelper('safe', function (obj, key) {
  return obj && obj[key] ? obj[key] : '';
});

handlebars.registerHelper('formatCurrency', function (amount) {
  return Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
});

handlebars.registerHelper('formatDate', function (date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
});

handlebars.registerHelper('isEqual', function (a, b) {
  return a === b;
});

const sendEmail = async (to, subject, templateName, templateData, attachments = []) => {
  try {
    const templatePath = path.join(__dirname, '../email-templates', `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    const htmlContent = template(templateData);

    const mailOptions = {
      from: `"Polygon Agro" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent,
      attachments: attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    throw error;
  }
};

module.exports = { sendEmail };