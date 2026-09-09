const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Compare password with hash
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generate token
const generateToken = () => {
  return uuidv4();
};

// Sign a JWT for an authenticated user (used after Password-Login / OTP verify / Register)
const generateJwt = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      email_id: user.email_id,
      role_code: user.role_code || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Verify a JWT, returns the decoded payload or throws
const verifyJwt = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Response formatter
const formatResponse = (success, message, data = null) => {
  return {
    success,
    message,
    data,
timestamp: new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}).format(new Date())

  };
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  generateJwt,
  verifyJwt,
  formatResponse
};
