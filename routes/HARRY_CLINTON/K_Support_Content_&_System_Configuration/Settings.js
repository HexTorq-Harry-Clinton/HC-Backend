// routes/Settings.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)
// Note: Singleton pattern - tbl_settings enforces single active row

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  setting_id: { type: sql.VarChar, maxLength: 36 },
  site_name: { type: sql.VarChar, maxLength: 255 },

  header_logo_url: { type: sql.VarChar, maxLength: 1000 },
  brand_logo_url: { type: sql.VarChar, maxLength: 1000 },
  footer_logo_url: { type: sql.VarChar, maxLength: 1000 },

  brand_description: { type: sql.VarChar, maxLength: sql.MAX },

  newsletter_title: { type: sql.VarChar, maxLength: 255 },
  newsletter_description: { type: sql.VarChar, maxLength: sql.MAX },

  ismaintenance_mode: { type: sql.Bit },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'site_name',
  'header_logo_url',
  'brand_logo_url',
  'footer_logo_url',
  'brand_description',
  'newsletter_title',
  'newsletter_description',
  'ismaintenance_mode',
  'rcu'
];

const UPDATE_FIELDS = [
  'site_name',
  'header_logo_url',
  'brand_logo_url',
  'footer_logo_url',
  'brand_description',
  'newsletter_title',
  'newsletter_description',
  'ismaintenance_mode',
  'isactive',
  'isdeleted',
  'luu'
];

/* =========================================
   INPUT PREPARATION
========================================= */
const prepareInputValue = (field, value) => {
  if (value === null || value === undefined || value === '') return null;

  const typeName = FIELD_TYPES[field]?.type?.name;

  if (typeName === 'Bit') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value ? 1 : 0;

    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'y'].includes(v)) return 1;
      if (['0', 'false', 'no', 'n'].includes(v)) return 0;
    }
    return null;
  }

  return typeof value === 'string' ? value.trim() : value;
};

const IST_NOW_SQL = 'DATEADD(MINUTE, 330, GETUTCDATE())';

/* =========================================
   1) GET ALL
========================================= */
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' ||
      req.query.includeDeleted === 'true';

    const where = [];
    if (!includeDeleted) where.push('isdeleted = 0');

    const query = `
      SELECT *
      FROM dbo.tbl_settings
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY isactive DESC, rcm DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('Settings GET error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   2) GET BY ID
========================================= */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'setting_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('setting_id', FIELD_TYPES.setting_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_settings
      WHERE setting_id = @setting_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Setting not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Settings GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE) - Singleton Pattern
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    // If isactive = 1, deactivate all other settings first
    if (data.isactive === 1 || data.isactive === true || data.isactive === '1') {
      await poolConnect;
      const deactivateRequest = pool.request();
      await deactivateRequest.query(`
        UPDATE dbo.tbl_settings
        SET isactive = 0
        WHERE isdeleted = 0 AND isactive = 1;
      `);
    }

    const cols = [];
    const vals = [];
    const request = pool.request();

    INSERT_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          cols.push(f);
          vals.push('@' + f);
          request.input(f, FIELD_TYPES[f].type, v);
        }
      }
    });

    await poolConnect;

    const result = await request.query(`
      INSERT INTO dbo.tbl_settings (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('Settings POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE) - Singleton Pattern
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.setting_id) {
      return res.status(400).json({
        success: false,
        message: 'setting_id required'
      });
    }

    // If isactive = 1, deactivate all other settings first
    if (data.isactive === 1 || data.isactive === true || data.isactive === '1') {
      await poolConnect;
      const deactivateRequest = pool.request();
      deactivateRequest.input('current_id', FIELD_TYPES.setting_id.type, data.setting_id);
      await deactivateRequest.query(`
        UPDATE dbo.tbl_settings
        SET isactive = 0
        WHERE isdeleted = 0 AND isactive = 1 AND setting_id != @current_id;
      `);
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'setting_id',
      FIELD_TYPES.setting_id.type,
      data.setting_id
    );

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          updates.push(`${f} = @${f}`);
          request.input(f, FIELD_TYPES[f].type, v);
        }
      }
    });

    updates.push(`lcm = ${IST_NOW_SQL}`);

    if (updates.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    await poolConnect;

    const result = await request.query(`
      UPDATE dbo.tbl_settings
      SET ${updates.join(', ')}
      WHERE setting_id = @setting_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Setting not found' });
    }

    res.json({
      success: true,
      message: 'Setting updated'
    });
  } catch (err) {
    console.error('Settings PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { setting_id, luu } = req.body;

    if (!setting_id) {
      return res.status(400).json({
        success: false,
        message: 'setting_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('setting_id', FIELD_TYPES.setting_id.type, setting_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_settings
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE setting_id = @setting_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Setting not found' });
    }

    res.json({
      success: true,
      message: 'Setting deleted (soft)'
    });
  } catch (err) {
    console.error('Settings DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
