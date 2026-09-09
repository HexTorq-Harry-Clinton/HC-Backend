const EmailService = require('./services/emailService');

// Initialize email service
const emailService = new EmailService();

// Example usage function
async function main() {
    // Verify transporter configuration
    const verification = await emailService.verifyTransporter();
    if (!verification.success) {
        console.error('Failed to verify email configuration:', verification.error);
        return;
    }


}

// Export the email service and utility functions
module.exports = {
    EmailService,
    emailService,

    // Convenience functions for direct use
    sendOTPEmail: (toEmail, otp) => {
        const service = new EmailService();
        return service.sendOTPEmail(toEmail, otp);
    },

    verifyEmailConfig: async () => {
        const service = new EmailService();
        return await service.verifyTransporter();
    }
};