// src/config/dbDear.js
const sql  = require('mssql');
const base = require('./dbBase');

const config = {
  user:     process.env.DB_HARRY_CLINTON_USER,
  password: process.env.DB_HARRY_CLINTON_PASS,
  server:   base.server,
  database: process.env.DB_HARRY_CLINTON_NAME,
  port:     base.port,
  options:  base.options
};

const pool       = new sql.ConnectionPool(config);
const poolConnect = pool.connect();
pool.on('error', err => console.error('HARRY CLINTON SQL Pool Error', err));

module.exports = { sql, pool, poolConnect };
