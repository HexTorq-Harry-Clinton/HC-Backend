const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELDS = [
  'fabric_details', 'trims_used', 'special_detailing', 'lining_details',
  'product_fit', 'model_fit', 'construction_type', 'sleeve_type',
  'sleeve_pattern', 'wash_care', 'sleeve_length'
];
const TYPES = {
  fabric_details: sql.VarChar(sql.MAX), trims_used: sql.VarChar(sql.MAX), special_detailing: sql.VarChar(sql.MAX),
  lining_details: sql.VarChar(sql.MAX), product_fit: sql.VarChar(100), model_fit: sql.VarChar(255),
  construction_type: sql.VarChar(50), sleeve_type: sql.VarChar(100), sleeve_pattern: sql.VarChar(255),
  wash_care: sql.VarChar(sql.MAX), sleeve_length: sql.VarChar(100),
};

router.get('/', async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();
    const where = ['isdeleted = 0', 'isactive = 1'];
    if (req.query.product_id) {
      where.push('product_id = @product_id');
      request.input('product_id', sql.VarChar(36), String(req.query.product_id));
    }
    const result = await request.query(`SELECT * FROM dbo.tbl_product_details WHERE ${where.join(' AND ')} ORDER BY rcm DESC;`);
    res.json({ success: true, data: req.query.product_id ? (result.recordset[0] || null) : result.recordset });
  } catch (err) {
    console.error('Product details GET error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.product_id) return res.status(400).json({ success: false, message: 'product_id required' });
    await poolConnect;
    const request = pool.request().input('product_id', sql.VarChar(36), String(data.product_id));
    for (const field of FIELDS) request.input(field, TYPES[field], data[field] === undefined ? null : String(data[field] || '').trim() || null);
    const assignments = FIELDS.map((field) => `${field} = @${field}`).join(', ');
    const result = await request.query(`
      IF EXISTS (SELECT 1 FROM dbo.tbl_product_details WHERE product_id = @product_id AND isdeleted = 0)
        UPDATE dbo.tbl_product_details SET ${assignments}, luu = 'ADMIN_PORTAL', lcm = DATEADD(MINUTE,330,GETUTCDATE()) WHERE product_id = @product_id AND isdeleted = 0;
      ELSE
        INSERT INTO dbo.tbl_product_details (product_id, ${FIELDS.join(', ')}, rcu, rcm) VALUES (@product_id, ${FIELDS.map((f) => `@${f}`).join(', ')}, 'ADMIN_PORTAL', DATEADD(MINUTE,330,GETUTCDATE()));
      SELECT TOP 1 * FROM dbo.tbl_product_details WHERE product_id = @product_id AND isdeleted = 0;
    `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Product details PUT error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
