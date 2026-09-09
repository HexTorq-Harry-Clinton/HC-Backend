const express = require('express');
const router = express.Router();

const MAIL_SERVICE = require('../MAIL_SERVICE/services');

const emailService = new MAIL_SERVICE();

const sendMailHandler = async (req, res, next) => {
    try {
        const { to, subject, html, text } = req.body; // Destructure email details from request body

        // Validate required fields 
        if (!to || !subject || (!html && !text)) {
            return res.status(400).json({
                Status: '0',
                Message: 'Required fields missing (to, subject, body)',
                Response: null,
                ResponseCode: '400',
            });
        }

        // Send the email   
        const mailResult = await emailService.sendCustomEmail(to, subject, html, text);

        return res.json({
            Status: '1',
            Message: 'Email sent successfully',
            Response: mailResult,
            ResponseCode: '200',
        });
    } catch (err) {
        return res.status(500).json({
            Status: '0',
            Message: err.message,
            Response: null,
            ResponseCode: '500',
        });
    }
};

router.post('/SendMail', sendMailHandler);
router.post('/Send-Mail', sendMailHandler);

const sendOTPEmailHandler = async (req, res, next) => {
    let out = '';
    let Data = req.body ?? {};

    try {
        const OTP = Math.floor(1000 + Math.random() * 9000).toString();
        const toEmail = Data.email_id;

        if (!toEmail) {
            return res.status(405).json({
                Status: '0',
                Message: 'Required field missing (email_id)',
                Response: null,
                ResponseCode: '405',
            });
        }
        const subject = 'Your OTP Code';
        const text = `Your OTP code is: ${OTP}`;
        const html = `<p>Your OTP code is: <strong>${OTP}</strong></p>`;

        const mailResult = await emailService.sendCustomEmail(toEmail, subject, html, text);
        out = {
            Status: 1,
            Message: 'OTP Email sent successfully',
            Response: { mailResult, OTP },
            ResponseCode: '200',
        };
        return res.json(out);
    } catch (err) {
        out = {
            Status: '0',
            Message: err.message,
            Response: null,
            ResponseCode: '500',
        };
        return res.status(500).json(out);
    }
};

router.post('/SendOTPEmail', sendOTPEmailHandler);
router.post('/Send-OTP-Email', sendOTPEmailHandler);

module.exports = router;