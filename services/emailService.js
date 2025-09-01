const transporter = require('../config/emailConfig');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');

// Register Handlebars helpers

handlebars.registerHelper('isEqual', function (a, b, options) {
  if (a === b) {
    return options.fn(this);
  }
  return options.inverse ? options.inverse(this) : '';
});

handlebars.registerHelper('safe', function (obj, prop) {
  return obj && obj[prop] ? obj[prop] : '';
});

handlebars.registerHelper('formatCurrency', function (value) {
  if (!value) return '0.00';
  return parseFloat(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
});

handlebars.registerHelper('formatDate', function (dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace(/ /g, '-');
});

class EmailService {
  constructor() {
    this.templates = {};
    this.loadTemplates();
  }

  loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../email-templates');

      if (!fs.existsSync(templatesDir)) {
        throw new Error(`Templates directory not found: ${templatesDir}`);
      }

      fs.readdirSync(templatesDir).forEach(file => {
        if (file.endsWith('.hbs')) {
          try {
            const templateName = file.replace('.hbs', '');
            const templatePath = path.join(templatesDir, file);
            const templateContent = fs.readFileSync(templatePath, 'utf8');
            this.templates[templateName] = handlebars.compile(templateContent);
          } catch (err) {
            console.error(`Error loading template ${file}:`, err);
          }
        }
      });

      if (Object.keys(this.templates).length === 0) {
        console.warn('No templates loaded from directory:', templatesDir);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      throw err;
    }
  }

  async sendEmail(to, subject, templateName, context = {}, attachments = []) {

    try {
      const html = this.templates[templateName](context);

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'no-reply@example.com',
        to,
        subject,
        attachments
      };

      const info = await transporter.sendMail(mailOptions);

      return info;
    } catch (error) {
      console.error('Error sending email:', {
        to,
        subject,
        error: error.message
      });
      throw error;
    }
  }

}

module.exports = new EmailService();