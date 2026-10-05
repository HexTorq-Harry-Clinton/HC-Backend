const fs = require('fs');
const path = require('path');
const { pool, poolConnect } = require('../config/db_harry_clinton');

(async () => {
  await poolConnect;
  const sql = fs.readFileSync(path.join(__dirname, 'create-tbl-customer-measurements.sql'), 'utf8');
  await pool.request().batch(sql);
  console.log('Customer measurements table is ready.');
  process.exit(0);
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
