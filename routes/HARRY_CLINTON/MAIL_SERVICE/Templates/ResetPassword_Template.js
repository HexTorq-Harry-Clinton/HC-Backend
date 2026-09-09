const { getBusinessName, getPasswordResetBaseUrl } = require('../config');

const buildResetLink = (token, email) => {
  const base = getPasswordResetBaseUrl().replace(/\/$/, '');
  const query = `token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  return `${base}?${query}`;
};

const createResetPasswordEmailTemplate = (token, email) => {
  const businessName = getBusinessName();
  const resetLink = buildResetLink(token, email);
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; line-height: 1.6;">
  
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
                      <span style="font-size: 36px; line-height: 70px;">🔑</span>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Title -->
              <h2 style="margin: 0 0 20px; color: #1a202c; font-size: 24px; font-weight: 600; text-align: center; letter-spacing: -0.5px;">
                Reset Your Password
              </h2>
              
              <!-- Description -->
              <p style="margin: 0 0 30px; color: #4a5568; font-size: 16px; text-align: center; line-height: 1.7;">
                We received a request to reset the password for your account. Click the button below to create a new password.
              </p>
              
              <!-- Timer Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin-bottom: 35px; border-radius: 6px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  ⏱️ <strong>Time-sensitive:</strong> This link expires in <strong>15 minutes</strong> for your security.
                </p>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 30px;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
                      Reset Password →
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Divider -->
              <div style="border-top: 1px solid #e2e8f0; margin: 35px 0;"></div>
              
              <!-- Alternative Link Section -->
              <div style="background-color: #f7fafc; padding: 24px; border-radius: 8px; margin-bottom: 30px;">
                <p style="margin: 0 0 12px; color: #4a5568; font-size: 14px; font-weight: 600;">
                  Button not working?
                </p>
                <p style="margin: 0 0 8px; color: #718096; font-size: 13px;">
                  Copy and paste this link into your browser:
                </p>
                <div style="background-color: #ffffff; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; word-break: break-all;">
                  <a href="${resetLink}" style="color: #667eea; text-decoration: none; font-size: 13px;">
                    ${resetLink}
                  </a>
                </div>
              </div>
              
              <!-- Security Notice -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px 20px; border-radius: 6px;">
                <p style="margin: 0; color: #065f46; font-size: 14px; line-height: 1.6;">
                  <strong>Didn't request this?</strong><br>
                  If you didn't initiate this password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.
                </p>
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
                This is an automated message. Please do not reply to this email.
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

const createResetPasswordTextTemplate = (token, email) => {
  const businessName = getBusinessName();
  const resetLink = buildResetLink(token, email);
  
  return [
    `${businessName} - Password Reset`,
    ``,
    `═══════════════════════════════════════`,
    ``,
    `We received a request to reset your password.`,
    ``,
    `⏱️  IMPORTANT: This link expires in 15 minutes.`,
    ``,
    `Reset your password here:`,
    `${resetLink}`,
    ``,
    `═══════════════════════════════════════`,
    ``,
    `Didn't request this?`,
    `If you didn't initiate this password reset, you can safely ignore`,
    `this email. Your password will remain unchanged.`,
    ``,
    `Need help? Contact our support team.`,
    ``,
    `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
  ].join('\n');
};

module.exports = {
  createResetPasswordEmailTemplate,
  createResetPasswordTextTemplate,
};