const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const measurementFields = ['chest', 'waist', 'hip', 'shoulder', 'sleeve_length'];
const decimal = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

router.get('/', async (req, res) => {
  try {
    if (!req.query.product_id) return res.status(400).json({ success: false, message: 'product_id required' });
    await poolConnect;
    const result = await pool.request().input('product_id', sql.VarChar(36), String(req.query.product_id)).query(`
      SELECT c.product_size_chart_id, c.product_id, c.unit,
             m.product_size_measurement_id, m.size_id, s.size_name,
             m.chest, m.waist, m.hip, m.shoulder, m.sleeve_length
      FROM dbo.tbl_product_size_charts c
      LEFT JOIN dbo.tbl_product_size_measurements m ON m.product_size_chart_id = c.product_size_chart_id AND m.isdeleted = 0 AND m.isactive = 1
      LEFT JOIN dbo.tbl_sizes s ON s.size_id = m.size_id
      WHERE c.product_id = @product_id AND c.isdeleted = 0 AND c.isactive = 1 AND m.product_size_measurement_id IS NOT NULL
      ORDER BY s.display_order, s.size_name;
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('Product size chart GET error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.product_id || !data.size_id) return res.status(400).json({ success: false, message: 'product_id and size_id required' });
    await poolConnect;
    const request = pool.request()
      .input('product_id', sql.VarChar(36), String(data.product_id))
      .input('size_id', sql.VarChar(36), String(data.size_id))
      .input('unit', sql.VarChar(20), String(data.unit || 'in').trim());
    for (const field of measurementFields) request.input(field, sql.Decimal(10, 2), decimal(data[field]));
    const result = await request.query(`
      DECLARE @chart_id varchar(36);
      SELECT @chart_id = product_size_chart_id FROM dbo.tbl_product_size_charts WHERE product_id = @product_id AND isdeleted = 0;
      IF @chart_id IS NULL BEGIN
        SET @chart_id = CONVERT(varchar(36), NEWID());
        INSERT INTO dbo.tbl_product_size_charts (product_size_chart_id, product_id, unit, rcu) VALUES (@chart_id, @product_id, @unit, 'ADMIN_PORTAL');
      END ELSE UPDATE dbo.tbl_product_size_charts SET unit = @unit, luu = 'ADMIN_PORTAL', lcm = DATEADD(MINUTE,330,GETUTCDATE()) WHERE product_size_chart_id = @chart_id;
      IF EXISTS (SELECT 1 FROM dbo.tbl_product_size_measurements WHERE product_size_chart_id = @chart_id AND size_id = @size_id AND isdeleted = 0)
        UPDATE dbo.tbl_product_size_measurements SET chest=@chest, waist=@waist, hip=@hip, shoulder=@shoulder, sleeve_length=@sleeve_length, luu='ADMIN_PORTAL', lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE product_size_chart_id=@chart_id AND size_id=@size_id AND isdeleted=0;
      ELSE
        INSERT INTO dbo.tbl_product_size_measurements (product_size_measurement_id, product_size_chart_id, size_id, chest, waist, hip, shoulder, sleeve_length, rcu) VALUES (CONVERT(varchar(36), NEWID()), @chart_id, @size_id, @chest, @waist, @hip, @shoulder, @sleeve_length, 'ADMIN_PORTAL');
      SELECT TOP 1 c.unit, m.* FROM dbo.tbl_product_size_charts c JOIN dbo.tbl_product_size_measurements m ON m.product_size_chart_id=c.product_size_chart_id WHERE c.product_size_chart_id=@chart_id AND m.size_id=@size_id AND m.isdeleted=0;
    `);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Product size chart PUT error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

router.delete('/', async (req, res) => {
  try {
    const productId = req.body?.product_id || req.query.product_id;
    const sizeId = req.body?.size_id || req.query.size_id;
    if (!productId) return res.status(400).json({ success: false, message: 'product_id required' });
    await poolConnect;
    const request = pool.request().input('product_id', sql.VarChar(36), String(productId));
    if (sizeId) request.input('size_id', sql.VarChar(36), String(sizeId));
    const result = await request.query(sizeId ? `
      UPDATE m SET isactive = 0, isdeleted = 1, luu = 'ADMIN_PORTAL', lcm = DATEADD(MINUTE,330,GETUTCDATE())
      FROM dbo.tbl_product_size_measurements m JOIN dbo.tbl_product_size_charts c ON c.product_size_chart_id=m.product_size_chart_id
      WHERE c.product_id=@product_id AND m.size_id=@size_id AND m.isdeleted=0;
      SELECT @@ROWCOUNT AS affected;
    ` : `
      UPDATE m SET isactive = 0, isdeleted = 1, luu = 'ADMIN_PORTAL', lcm = DATEADD(MINUTE,330,GETUTCDATE())
      FROM dbo.tbl_product_size_measurements m JOIN dbo.tbl_product_size_charts c ON c.product_size_chart_id=m.product_size_chart_id WHERE c.product_id=@product_id AND m.isdeleted=0;
      UPDATE dbo.tbl_product_size_charts SET isactive=0, isdeleted=1, luu='ADMIN_PORTAL', lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE product_id=@product_id AND isdeleted=0;
      SELECT @@ROWCOUNT AS affected;
    `);
    if (result.recordset[0].affected === 0) return res.status(404).json({ success: false, message: 'Size chart entry not found' });
    res.json({ success: true, message: sizeId ? 'Size measurement deleted' : 'Size chart deleted' });
  } catch (err) {
    console.error('Product size chart DELETE error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
