const nodemailer = require('nodemailer');
require('dotenv').config();


const transporter = nodemailer.createTransport({
    host: process.env.C_HARRY_CLINTON_SMTP_HOST,
    port: process.env.C_HARRY_CLINTON_SMTP_PORT,
    secure: process.env.C_HARRY_CLINTON_SMTP_SECURE === 'true',
    auth: {
        user: process.env.C_HARRY_CLINTON_SMTP_USER,
        pass: process.env.C_HARRY_CLINTON_SMTP_PASS
    }
})

const createMailOptions = (toEmail, subject, html, text, from = 'Harry Clinton <otp.harryclinton@gmail.com>') => {
    const mailOptoins = {
        from,
        to: toEmail,
        subject,
        text,
        html
    }
    return mailOptoins;
}


async function sendOTPEmail(toEmail, otp) {

    const mailOptions = createMailOptions(
        toEmail,
        'Harry Clinton - Your Login OTP Code',
        `<p>Your OTP code is: <b>${otp}</b></p>`,
        `Your OTP code is: ${otp}`
    );

    const mailResponse = await transporter.sendMail(mailOptions);
    console.log('OTP Email sent: ', mailResponse.messageId);
    return mailResponse;
}


module.exports = {
    sendOTPEmail
};
