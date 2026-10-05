const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELDS = [
  'guest_name', 'product_name', 'unit',
  'shirt_body_length', 'shirt_shoulder', 'shirt_sleeve_length', 'shirt_arm_loose', 'shirt_chest', 'shirt_waist', 'shirt_hip', 'shirt_collar', 'shirt_cuff',
  'trouser_full_length', 'trouser_inseam', 'trouser_fly', 'trouser_u_round', 'trouser_waist', 'trouser_hip', 'trouser_thigh', 'trouser_knee', 'trouser_bottom',
  'notes', 'isactive', 'isdeleted', 'rcu', 'luu',
];
const TEXT_FIELDS = new Set(FIELDS.filter((f) => !['isactive', 'isdeleted'].includes(f)));

function value(field, input) {
  if (input === undefined) return undefined;
  if (input === null || input === '') return null;
  if (field === 'isactive' || field === 'isdeleted') return input === true || input === 1 || input === '1' ? 1 : 0;
  return TEXT_FIELDS.has(field) ? String(input).trim() : input;
}

function apply(request, field, input) {
  const v = value(field, input);
  if (v === undefined) return false;
  request.input(field, field === 'isactive' || field === 'isdeleted' ? sql.Bit : sql.VarChar, v);
  return true;
}

router.get('/', async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request();
    const where = ['m.isdeleted = 0'];
    if (req.query.user_id) {
      request.input('user_id', sql.VarChar(36), String(req.query.user_id));
      where.push('m.user_id = @user_id');
    }
    const result = await request.query(`
      SELECT m.*, u.full_name, u.email, u.phone_number
      FROM dbo.tbl_customer_measurements m
      LEFT JOIN dbo.tbl_users u ON u.user_id = m.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY m.lcm DESC, m.rcm DESC;
    `);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.user_id) return res.status(400).json({ success: false, message: 'user_id is required' });
    await poolConnect;
    const check = await pool.request().input('user_id', sql.VarChar(36), String(data.user_id)).query(
      'SELECT TOP 1 measurement_id FROM dbo.tbl_customer_measurements WHERE user_id = @user_id AND isdeleted = 0;'
    );
    const existing = check.recordset[0]?.measurement_id;
    const request = pool.request();
    if (existing) {
      request.input('measurement_id', sql.UniqueIdentifier, existing);
      const sets = FIELDS.filter((f) => f !== 'rcu' && f !== 'isdeleted').filter((f) => apply(request, f, data[f])).map((f) => `${f} = @${f}`);
      sets.push('lcm = DATEADD(MINUTE, 330, GETUTCDATE())');
      await request.query(`UPDATE dbo.tbl_customer_measurements SET ${sets.join(', ')} WHERE measurement_id = @measurement_id;`);
    } else {
      request.input('user_id', sql.VarChar(36), String(data.user_id));
      const cols = ['user_id']; const vals = ['@user_id'];
      FIELDS.filter((f) => f !== 'isdeleted' && f !== 'luu').forEach((f) => { if (apply(request, f, data[f])) { cols.push(f); vals.push(`@${f}`); } });
      await request.query(`INSERT INTO dbo.tbl_customer_measurements (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
    }
    res.json({ success: true, message: 'Measurements saved' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
