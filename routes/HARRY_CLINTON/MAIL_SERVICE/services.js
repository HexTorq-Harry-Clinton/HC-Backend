const { createTransporter, getDefaultFromAddress } = require("./config");
const { createOTPEmailTemplate, createOTPTextTemplate } = require("./Templates/OTP_Template");
const { createResetPasswordEmailTemplate, createResetPasswordTextTemplate } = require("./Templates/ResetPassword_Template");


class EmailService {
    constructor() {
        this.transporter = createTransporter();
        this.defaultFrom = getDefaultFromAddress();
    }

    /**
     * Create email options
     * @param {string} toEmail - Recipient email address
     * @param {string} subject - Email subject
     * @param {string} html - HTML content
     * @param {string} text - Plain text content
     * @param {string} from - Sender email address (optional)
     * @returns {Object} Mail options object
     */
    createMailOptions(toEmail, subject, html, text, from = this.defaultFrom) {
        return {
            from,
            to: toEmail,
            subject,
            text,
            html
        };
    }

    /**
     * Send an email
     * @param {Object} mailOptions - Mail options object
     * @returns {Promise} Promise with mail response
     */
    async sendEmail(mailOptions) {
        try {
            const mailResponse = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', mailResponse.messageId);
            return {
                success: true,
                messageId: mailResponse.messageId,
                response: mailResponse
            };
        } catch (error) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send OTP email
     * @param {string} toEmail - Recipient email address
     * @param {string} otp - OTP code
     * @returns {Promise} Promise with mail response
     */
    async sendOTPEmail(toEmail, otp) {
        const htmlTemplate = createOTPEmailTemplate(otp);
        const textTemplate = createOTPTextTemplate(otp);

        const mailOptions = this.createMailOptions(
            toEmail,
            'Harry Clinton - Your Login OTP Verification Code',
            htmlTemplate,
            textTemplate
        );

        return await this.sendEmail(mailOptions);
    }

    /**
     * Send password reset email
     * @param {string} toEmail - Recipient email address
     * @param {string} token - Reset token (used in link)
     * @returns {Promise} Promise with mail response
     */
    async sendPasswordResetEmail(toEmail, token) {
        const htmlTemplate = createResetPasswordEmailTemplate(token, toEmail);
        const textTemplate = createResetPasswordTextTemplate(token, toEmail);

        const mailOptions = this.createMailOptions(
            toEmail,
            'Harry Clinton - Reset Your Password',
            htmlTemplate,
            textTemplate
        );

        return await this.sendEmail(mailOptions);
    }

    /**
     * Send custom email with template
     * @param {string} toEmail - Recipient email address
     * @param {string} subject - Email subject
     * @param {string} htmlContent - HTML content
     * @param {string} textContent - Plain text content
     * @returns {Promise} Promise with mail response
     */
    async sendCustomEmail(toEmail, subject, htmlContent, textContent) {
        const mailOptions = this.createMailOptions(
            toEmail,
            subject,
            htmlContent,
            textContent
        );

        return await this.sendEmail(mailOptions);
    }

    /**
     * Verify transporter configuration
     * @returns {Promise} Promise with verification result
     */
    async verifyTransporter() {
        try {
            await this.transporter.verify();
            console.log('Email transporter is ready');
            return { success: true, message: 'Server is ready to send messages' };
        } catch (error) {
            console.error('Email transporter verification failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailService;