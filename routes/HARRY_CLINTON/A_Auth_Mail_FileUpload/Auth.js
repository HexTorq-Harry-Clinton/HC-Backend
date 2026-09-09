const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');
const EmailService = require('../MAIL_SERVICE/services');
const { hashPassword, comparePassword, generateToken, generateJwt } = require('../helpers');

var E_Mail_OTP_Map = new Map();
var Password_Reset_Map = new Map();


const E_MAIL_SERVICE = new EmailService();

/** 
 * ==============================
 * REGISTER USER
 * ==============================
 * SP: sp_register_user
 * Inputs:
 *   @full_name
 *   @email_id
 *   @mobile_number
 *   @password
 * @profile_url
 *   @rcu
 *
 * Outputs:
 *   @user_id (OUTPUT)
 *   @success (OUTPUT)
 *   @message (OUTPUT)
 */
router.post('/Register', async (req, res, next) => {
  let out = '';

  try {
    const data = req.body ?? {};

    // Validate required fields
    if (!data.full_name || !data.email_id || !data.password || !data.rcu) {
      return res.status(405).json({
        Status: '0',
        Message: 'Required fields missing (full_name, email_id, password, rcu)',
        Response: null,
        ResponseCode: '405',
        RequestReceived: data,
      });
    }

    // Hash the password
    const hashedPassword = await hashPassword(data.password);


    await poolConnect;

    const request = pool.request()
      .input('full_name', sql.VarChar(255), data.full_name)
      .input('email_id', sql.VarChar(255), data.email_id)
      .input('mobile_number', sql.VarChar(50), data.mobile_number ?? null)
      .input('profile_url', sql.VarChar(255), data.profile_url ?? 'No File Uploaded')
      .input('password_hash', sql.VarChar(255), hashedPassword)
      .input('rcu', sql.VarChar(100), data.rcu)
      .output('user_id', sql.VarChar(36))
      .output('success', sql.Bit)
      .output('message', sql.VarChar(500));

    const result = await request.execute('sp_register_user');

    const success = result.output?.success ?? 0;
    const message = result.output?.message ?? '';
    const userId = result.output?.user_id ?? null;

    out = {
      Status: success.toString(),
      Message: message,
      Response: {
        user_id: userId,
        token: success ? generateJwt({ user_id: userId, email_id: data.email_id, role_code: null }) : null,
      },
      ResponseCode: '200',
      RequestReceived: data,
    };

    return res.json(out);

  } catch (err) {
    out = {
      Status: '0',
      Message: err.message || err.originalError?.message || String(err),
      Response: null,
      ResponseCode: '500',
    };
    return res.status(500).json(out);
  }
});


router.post('/Password-Login', async (req, res, next) => {
  let out = '';

  try {
    const data = req.body ?? {};

    if (!data.email_id || !data.password) {
      return res.status(405).json({
        Status: '0',
        Message: 'Required fields missing (email_id, password)',
        Response: null,
        ResponseCode: '405',
        RequestReceived: data,
      });
    }

    await poolConnect;

    // Get stored password hash
    const getPassRequest = pool.request()
      .input('email_id', sql.VarChar(255), data.email_id)
      .output('success', sql.Bit)
      .output('message', sql.VarChar(500))
      .output('password_hash', sql.VarChar(255));

    const getPassResult = await getPassRequest.execute('sp_get_user_password');

    const getPassSuccess = getPassResult.output?.success ?? 0;
    const getPassMessage = getPassResult.output?.message ?? '';
    const storedPasswordHash = getPassResult.output?.password_hash ?? null;

    if (!getPassSuccess || !storedPasswordHash) {
      out = {
        Status: '0',
        Message: getPassMessage || 'User not found',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    // Compare password with stored hash
    const isPasswordValid = await comparePassword(data.password, storedPasswordHash);

    if (!isPasswordValid) {
      out = {
        Status: '0',
        Message: 'Password is incorrect',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    // Password is correct, get full user data
    const loginRequest = pool.request()
      .input('email_id', sql.VarChar(255), data.email_id)
      .input('password_hash', sql.VarChar(255), storedPasswordHash)
      .output('success', sql.Bit)
      .output('message', sql.VarChar(500));

    const loginResult = await loginRequest.execute('sp_login_user');
    const loginSuccess = loginResult.output?.success ?? 0;
    const loginMessage = loginResult.output?.message ?? '';
    const loginUserRow = loginResult.recordset?.[0] ?? null;
const userRoles = loginResult.recordsets?.[1] ?? [];
    out = {
      Status: loginSuccess.toString(),
      Message: loginMessage,
      Response: {
    user: loginUserRow,
    roles: userRoles,
    token: loginSuccess && loginUserRow
      ? generateJwt({ user_id: loginUserRow.user_id, email_id: loginUserRow.email_id, role_code: userRoles[0]?.role_code ?? null })
      : null,
  },
      ResponseCode: '200',
      RequestReceived: data,
    };

    return res.json(out);
  } catch (err) {
    out = {
      Status: '0',
      Message: err.message || err.originalError?.message || String(err),
      Response: null,
      ResponseCode: '500',
    };
    return res.status(500).json(out);
  }
});

/**
 * =========================
 * LOGIN USER
 * =========================
 * SP: sp_login_user
 *
 * Inputs:
 *   @email_id
 *   @password_hash
 *
 * Outputs:
 *   @user_id
 *   @full_name
 *   @email_verified
 *   @mobile_verified
 *   @mobile_number
 *   @success
 *   @message
 */
router.post('/OTP-Login', async (req, res, next) => {
  let out = '';

  try {
    const data = req.body ?? {};

    if (!data.email_id) {
      return res.status(405).json({
        Status: '0',
        Message: 'Required fields missing (email_id)',
        Response: null,
        ResponseCode: '405',
        RequestReceived: data,
      });
    }

    await poolConnect;

    const request = pool.request()
      .input('email_id', sql.VarChar(255), data.email_id)
      .output('success', sql.Bit)
      .output('message', sql.VarChar(500));

    const result = await request.execute('sp_otp_login_user');

    const success = result.output?.success ?? 0;
    const message = result.output?.message ?? '';
    const userRow = result.recordset?.[0] ?? null; // <-- row from SELECT




    if (success === true && userRow) {
      const Data = {
        Status: success.toString(),
        Message: message,
        Response: {
          ...userRow,
          token: generateJwt({ user_id: userRow.user_id, email_id: userRow.email_id, role_code: null }),
        },
        ResponseCode: '200',
        RequestReceived: data,
      };

      console.log('User logged in successfully:', userRow.email_id);
      const OTP = Math.floor(1000 + Math.random() * 9000);
      const E_MAIL = data.email_id;

      // Store OTP immediately with pending email status
      E_Mail_OTP_Map.set(E_MAIL, {
        OTP: OTP,
        DATA: Data,
        emailSent: false,
        emailError: null
      });

      // Send email async without waiting
      E_MAIL_SERVICE.sendOTPEmail(E_MAIL, OTP)
        .then(mailRes => {
          console.log('OTP Email sent successfully:', mailRes.messageId);
          const entry = E_Mail_OTP_Map.get(E_MAIL);
          if (entry) {
            entry.emailSent = true;
            E_Mail_OTP_Map.set(E_MAIL, entry);
          }
        })
        .catch(mailErr => {
          console.error('Error sending OTP Email:', mailErr);
          const entry = E_Mail_OTP_Map.get(E_MAIL);
          if (entry) {
            entry.emailError = mailErr.message;
            E_Mail_OTP_Map.set(E_MAIL, entry);
          }
        });


      out = {
        Status: 1,
        Message: 'User Data Exists. OTP Sent',
        ResponseCode: '200',
        RequestReceived: data,
      };

      return res.json(out);

    }

    out = {
      Status: success.toString(),
      Message: message,
      Response: userRow, // <-- send full row data
      ResponseCode: '200',
      RequestReceived: data,
    };

    return res.json(out);
  } catch (err) {
    out = {
      Status: '0',
      Message: err.message || err.originalError?.message || String(err),
      Response: null,
      ResponseCode: '500',
    };
    return res.status(500).json(out);
  }
});



router.post('/Verify-Login-OTP', async (req, res, next) => {
  let out = '';

  try {
    const data = req.body ?? {};

    if (!data.email_id || !data.otp) {
      return res.status(405).json({
        Status: '0',
        Message: 'Required fields missing (email_id, otp)',
        Response: null,
        ResponseCode: '405',
        RequestReceived: data,
      });
    }

    const storedEntry = E_Mail_OTP_Map.get(data.email_id);

    if (!storedEntry) {
      out = {
        Status: '0',
        Message: 'No OTP request found for this email',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    // Check if email failed to send
    if (storedEntry.emailError) {
      E_Mail_OTP_Map.delete(data.email_id);
      out = {
        Status: '0',
        Message: 'Email failed to send: ' + storedEntry.emailError,
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    // Verify OTP
    if (storedEntry.OTP.toString() === data.otp.toString()) {

      out = storedEntry.DATA;
      E_Mail_OTP_Map.delete(data.email_id); // Invalidate OTP after successful verification
      return res.json(out);
    } else {
      out = {
        Status: '0',
        Message: 'Invalid OTP',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
    }

    return res.json(out);

  } catch (err) {
    out = {
      Status: '0',
      Message: err.message || err.originalError?.message || String(err),
      Response: null,
      ResponseCode: '500',
      RequestReceived: data,
    };
    return res.status(500).json(out);
  }
});

router.post('/Forgot-Password', async (req, res, next) => {
  let out = '';

  try {
    const data = req.body ?? {};

    if (!data.email_id) {
      return res.status(405).json({
        Status: '0',
        Message: 'Required fields missing (email_id)',
        Response: null,
        ResponseCode: '405',
        RequestReceived: data,
      });
    }

    await poolConnect;

    // Verify user exists and get row data
    const userRequest = pool.request()
      .input('email_id', sql.VarChar(255), data.email_id)
      .output('success', sql.Bit)
      .output('message', sql.VarChar(500));

    const userResult = await userRequest.execute('sp_otp_login_user');

    const userSuccess = userResult.output?.success ?? 0;
    const userMessage = userResult.output?.message ?? '';
    const userRow = userResult.recordset?.[0] ?? null;

    if (!userSuccess || !userRow) {
      out = {
        Status: '0',
        Message: userMessage || 'User not found',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    // Create reset token and track expiry
    const resetToken = generateToken();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    Password_Reset_Map.set(resetToken, {
      user_id: userRow.user_id,
      email_id: data.email_id,
      expiresAt,
    });

    // Send reset token via email with reset template
    E_MAIL_SERVICE.sendPasswordResetEmail(data.email_id, resetToken)
      .then(mailRes => {
        console.log('Reset email sent:', mailRes.messageId);
      })
      .catch(mailErr => {
        console.error('Error sending reset email:', mailErr);
      });

    out = {
      Status: '1',
      Message: 'Reset link sent to email (valid for 15 minutes)',
      Response: {
        transaction_id: resetToken,
      },
      ResponseCode: '200',
      RequestReceived: data,
    };

    return res.json(out);

  } catch (err) {
    out = {
      Status: '0',
      Message: err.message || err.originalError?.message || String(err),
      Response: null,
      ResponseCode: '500',
    };
    return res.status(500).json(out);
  }
});


/**
 * =========================
 * RESET PASSWORD
 * =========================
 * SP: sp_reset_password
 *
 * Inputs:
 *   @email_id
 *   @old_password_hash
 *   @new_password_hash
 *   @luu
 *
 * Outputs:
 *   @success
 *   @message
 */
router.post('/Reset-Password', async (req, res, next) => {
  let out = '';

  try {
    const data = req.body ?? {};

    if (!data.email_id || !data.old_password || !data.new_password || !data.luu) {
      return res.status(405).json({
        Status: '0',
        Message: 'Required fields missing (email_id, old_password, new_password, luu)',
        Response: null,
        ResponseCode: '405',
        RequestReceived: data,
      });
    }

    await poolConnect;

    // Get stored password hash for verification
    const getPassRequest = pool.request()
      .input('email_id', sql.VarChar(255), data.email_id)
      .output('success', sql.Bit)
      .output('message', sql.VarChar(500))
      .output('password_hash', sql.VarChar(255));

    const getPassResult = await getPassRequest.execute('sp_get_user_password');

    const getPassSuccess = getPassResult.output?.success ?? 0;
    const getPassMessage = getPassResult.output?.message ?? '';
    const storedPasswordHash = getPassResult.output?.password_hash ?? null;

    if (!getPassSuccess || !storedPasswordHash) {
      out = {
        Status: '0',
        Message: getPassMessage || 'User not found',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    // Verify old password
    const isOldPasswordValid = await comparePassword(data.old_password, storedPasswordHash);

    if (!isOldPasswordValid) {
      out = {
        Status: '0',
        Message: 'Old password is incorrect',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    // Hash the new password
    const hashedNewPassword = await hashPassword(data.new_password);

    const request = pool.request()
      .input('email_id', sql.VarChar(255), data.email_id)
      .input('old_password_hash', sql.VarChar(255), storedPasswordHash)
      .input('new_password_hash', sql.VarChar(255), hashedNewPassword)
      .input('luu', sql.VarChar(100), data.luu)
      .output('success', sql.Bit)
      .output('message', sql.VarChar(500));

    const result = await request.execute('sp_reset_password');

    const output = result.output ?? {};

    out = {
      Status: output.success?.toString?.() ?? '0',
      Message: output.message ?? '',
      Response: null,
      ResponseCode: '200',
      RequestReceived: data,
    };

    return res.json(out);

  } catch (err) {
    out = {
      Status: '0',
      Message: err.message || err.originalError?.message || String(err),
      Response: null,
      ResponseCode: '500',
    };
    return res.status(500).json(out);
  }
});

router.post('/Forgot-Password-Confirm', async (req, res, next) => {
  let out = '';

  try {
    const data = req.body ?? {};

    if (!data.email_id || !data.transaction_id || !data.new_password || !data.luu) {
      return res.status(405).json({
        Status: '0',
        Message: 'Required fields missing (email_id, transaction_id, new_password, luu)',
        Response: null,
        ResponseCode: '405',
        RequestReceived: data,
      });
    }

    const tokenEntry = Password_Reset_Map.get(data.transaction_id);

    if (!tokenEntry || tokenEntry.email_id !== data.email_id) {
      out = {
        Status: '0',
        Message: 'Invalid or expired transaction',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    // Expiry check
    if (tokenEntry.expiresAt && Date.now() > tokenEntry.expiresAt) {
      Password_Reset_Map.delete(data.transaction_id);
      out = {
        Status: '0',
        Message: 'Reset link expired',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    await poolConnect;

    // Get current password hash to satisfy SP signature
    const getPassRequest = pool.request()
      .input('email_id', sql.VarChar(255), data.email_id)
      .output('success', sql.Bit)
      .output('message', sql.VarChar(500))
      .output('password_hash', sql.VarChar(255));

    const getPassResult = await getPassRequest.execute('sp_get_user_password');

    const getPassSuccess = getPassResult.output?.success ?? 0;
    const getPassMessage = getPassResult.output?.message ?? '';
    const storedPasswordHash = getPassResult.output?.password_hash ?? null;

    if (!getPassSuccess || !storedPasswordHash) {
      out = {
        Status: '0',
        Message: getPassMessage || 'User not found',
        Response: null,
        ResponseCode: '200',
        RequestReceived: data,
      };
      return res.json(out);
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(data.new_password);

    const request = pool.request()
      .input('email_id', sql.VarChar(255), data.email_id)
      .input('old_password_hash', sql.VarChar(255), storedPasswordHash)
      .input('new_password_hash', sql.VarChar(255), hashedNewPassword)
      .input('luu', sql.VarChar(100), data.luu)
      .output('success', sql.Bit)
      .output('message', sql.VarChar(500));

    const result = await request.execute('sp_reset_password');

    const output = result.output ?? {};

    // Clear token after use
    Password_Reset_Map.delete(data.transaction_id);

    out = {
      Status: output.success?.toString?.() ?? '0',
      Message: output.message ?? '',
      Response: null,
      ResponseCode: '200',
      RequestReceived: data,
    };

    return res.json(out);

  } catch (err) {
    out = {
      Status: '0',
      Message: err.message || err.originalError?.message || String(err),
      Response: null,
      ResponseCode: '500',
    };
    return res.status(500).json(out);
  }
});



module.exports = router;
