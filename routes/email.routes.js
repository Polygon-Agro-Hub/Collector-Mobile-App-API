const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// Send test email
router.post('/send-test-email', async (req, res) => {
  try {
    const { email } = req.body;
    console.log(email)
    
    await emailService.sendEmail(
      email,
      'Welcome to AgroWorld',
      'welcom',
      {
        name: 'New User',
        message: 'Thank you for registering with AgroWorld!',
        year: new Date().getFullYear(),
        title: 'Welcome Email'
      }
    );
    
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});

// Send PDF email
// router.post('/send-pdf-email', async (req, res) => {
//   try {
//     const { email } = req.body;
//       const sampleData = {
//             order: {
//                 customerInfo: {
//                     title: 'Mr',
//                     firstName: 'John',
//                     lastName: 'Doe',
//                     phoneNumber: '771234567',
//                     buildingType: 'House'
//                 },
//                 createdAt: new Date(),
//                 scheduleDate: new Date(Date.now() + 86400000), // Tomorrow
//                 paymentMethod: 'Cash On Delivery'
//             },
//             customerData: {
//                 email: 'customer@example.com',
//                 buildingDetails: {
//                     houseNo: '123',
//                     streetName: 'Main Street',
//                     city: 'Colombo'
//                 }
//             },
//             invoiceNumber: 'INV-2023-001',
//             totalAmount: 1250.50,
//             name: 'John Doe',
//             message: 'Thank you for your purchase! Please find your invoice attached.',
//             year: new Date().getFullYear(),
//             title: 'Purchase Invoice'
//         };
    
//     await emailService.sendEmailWithPdf(
//       email,
//       'Your AgroWorld Report',
//       'welcom', // Using same template for example
//      sampleData,
//       {
//         format: 'A4',
//         border: '10mm'
//       }
//     );
    
//     res.json({ success: true, message: 'Email with PDF sent successfully' });
//   } catch (error) {
//     console.error('Error sending PDF email:', error);
//     res.status(500).json({ success: false, message: 'Failed to send email with PDF' });
//   }
// });

router.post('/send-pdf-email', async (req, res) => {
  try {
    const { email, pdfBase64, fileName } = req.body;
    console.log(email)

    if (!pdfBase64) {
      return res.status(400).json({ success: false, message: 'Missing PDF data' });
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    await emailService.sendEmail(
      email,
      'Your AgroWorld Invoice',
      'welcom',
      { message: 'Thank you for your order!' },
      [{
        filename: fileName || 'invoice.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    );

    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending PDF email:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});


module.exports = router;