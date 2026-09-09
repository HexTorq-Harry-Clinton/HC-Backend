const { getBusinessName } = require("../config");

const createOTPEmailTemplate = (otp) => {
    const businessName = getBusinessName();
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Your Verification Code - ${businessName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
    
    <!-- Preview Text -->
    <div style="display: none; font-size: 1px; color: #ffffff; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        Your verification code: ${otp}. Valid for 10 minutes. Do not share with anyone.
    </div>
    
    <!-- Email Container -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f7fa; padding: 40px 0;">
        <tr>
            <td align="center">
                
                <!-- Main Content Card -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07); overflow: hidden;">
                    
                    <!-- Header with gradient -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                                🔐 ${businessName}
                            </h1>
                            <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; letter-spacing: 0.5px;">
                                SECURE ACCESS PORTAL
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Main Body -->
                    <tr>
                        <td style="padding: 50px 40px;">
                            
                            <!-- Icon -->
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 30px;">
                                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 70px; height: 70px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 auto;">
                                            <span style="font-size: 36px; line-height: 70px;">🔢</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Title -->
                            <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 24px; font-weight: 600; text-align: center; letter-spacing: -0.5px;">
                                Your Verification Code
                            </h2>
                            
                            <!-- Description -->
                            <p style="margin: 0 0 35px; color: #4a5568; font-size: 16px; text-align: center; line-height: 1.7;">
                                Enter this code to complete your authentication. This is an automated security measure to protect your account.
                            </p>
                            
                            <!-- OTP Code Display -->
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 35px;">
                                        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; padding: 30px; box-shadow: 0 8px 20px rgba(245, 87, 108, 0.25);">
                                            <div style="color: rgba(255, 255, 255, 0.85); font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px;">
                                                Verification Code
                                            </div>
                                            <div style="background-color: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); border-radius: 8px; padding: 20px; margin-bottom: 12px;">
                                                <div style="color: #ffffff; font-size: 48px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace; text-align: center;">
                                                    ${otp}
                                                </div>
                                            </div>
                                            <div style="color: rgba(255, 255, 255, 0.85); font-size: 13px; font-weight: 500;">
                                                ⏱️ Expires in 10 minutes
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Instructions -->
                            <div style="background-color: #f7fafc; border-left: 4px solid #667eea; padding: 24px; border-radius: 8px; margin-bottom: 30px;">
                                <p style="margin: 0 0 16px; color: #2d3748; font-size: 15px; font-weight: 600;">
                                    📋 Quick Instructions:
                                </p>
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding-bottom: 10px;">
                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tr>
                                                    <td width="24" style="color: #667eea; font-size: 18px; vertical-align: top; padding-right: 12px;">✓</td>
                                                    <td style="color: #4a5568; font-size: 14px; line-height: 1.6;">Enter this code on the verification page to complete your login</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding-bottom: 10px;">
                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tr>
                                                    <td width="24" style="color: #667eea; font-size: 18px; vertical-align: top; padding-right: 12px;">✓</td>
                                                    <td style="color: #4a5568; font-size: 14px; line-height: 1.6;">Code expires in 10 minutes for your security</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding-bottom: 10px;">
                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tr>
                                                    <td width="24" style="color: #667eea; font-size: 18px; vertical-align: top; padding-right: 12px;">✓</td>
                                                    <td style="color: #4a5568; font-size: 14px; line-height: 1.6;">Never share this code with anyone, including our support team</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                                <tr>
                                                    <td width="24" style="color: #667eea; font-size: 18px; vertical-align: top; padding-right: 12px;">✓</td>
                                                    <td style="color: #4a5568; font-size: 14px; line-height: 1.6;">Didn't request this? You can safely ignore this email</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            
                            <!-- Security Warning -->
                            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px;">
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                    <tr>
                                        <td width="32" style="vertical-align: top; font-size: 24px; padding-right: 12px;">
                                            🛡️
                                        </td>
                                        <td>
                                            <p style="margin: 0 0 8px; color: #92400e; font-size: 14px; font-weight: 600;">
                                                Security Notice
                                            </p>
                                            <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.6;">
                                                ${businessName} will never ask for your verification code via email, phone, or text message. If someone requests this code, do not share it—it's likely a scam attempt.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f7fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">
                            
                            <!-- Support Info -->
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0 0 15px; color: #718096; font-size: 14px;">
                                            Need help? <a href="mailto:support@${businessName.toLowerCase().replace(/\s+/g, '')}.com" style="color: #667eea; text-decoration: none; font-weight: 500;">Contact Support</a>
                                        </p>
                                        <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                                            © ${new Date().getFullYear()} ${businessName}. All rights reserved.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                        </td>
                    </tr>
                    
                </table>
                
                <!-- Footer Text -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; margin-top: 20px;">
                    <tr>
                        <td align="center" style="padding: 0 20px;">
                            <p style="margin: 0; color: #a0aec0; font-size: 12px; line-height: 1.5;">
                                This is an automated security message. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
                
            </td>
        </tr>
    </table>
    
</body>
</html>
    `;
};

const createOTPTextTemplate = (otp) => {
    const businessName = getBusinessName();
    
    return `
${businessName} - Secure Access Portal
═══════════════════════════════════════

🔢 YOUR VERIFICATION CODE
╔════════════════╗
║   ${otp}   ║
╚════════════════╝

⏱️  Valid for: 10 minutes

═══════════════════════════════════════

📋 QUICK INSTRUCTIONS:

✓ Enter this code on the verification page to complete login
✓ Code expires in 10 minutes for your security
✓ Never share this code with anyone, including support
✓ Didn't request this? Safely ignore this email

═══════════════════════════════════════

🛡️  SECURITY NOTICE:

${businessName} will NEVER ask for your verification code 
via email, phone, or text. If someone requests this code, 
do not share it—it's likely a scam.

═══════════════════════════════════════

Need help? Contact: support@${businessName.toLowerCase().replace(/\s+/g, '')}.com

© ${new Date().getFullYear()} ${businessName}. All rights reserved.

This is an automated security message.
═══════════════════════════════════════
`.trim();
};

module.exports = {
    createOTPEmailTemplate,
    createOTPTextTemplate
};