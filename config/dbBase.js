// src/config/dbBase.js
require('dotenv').config(); // loads the .env once
module.exports = {
  server: process.env.DB_HOST,
  port:   parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};
