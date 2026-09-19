// routes/HomeSettings.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)
// Generic multipurpose key-value store (dbo.tbl_home_settings): custom rows
// with setting_key + setting_value, grouped by setting_group. Used by Home
// Screen Content admin (collection tiles JSON, arrivals config, footer
// links, section titles) — and anything free-form in future.
// NOTE: table dbo.tbl_home_settings must exist - see
// scripts/create-tbl-home-settings.sql (one-time DBA run).
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  setting_id: { type: sql.UniqueIdentifier },
  setting_group: { type: sql.VarChar, maxLength: 100 },
  setting_key: { type: sql.VarChar, maxLength: 255 },
  setting_value: { type: sql.VarChar }, // varchar(max) via bindField
  display_order: { type: sql.Int },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = ['setting_group', 'setting_key', 'setting_value', 'display_order', 'rcu'];
const UPDATE_FIELDS = ['setting_group', 'setting_key', 'setting_value', 'display_order', 'isactive', 'isdeleted', 'luu'];

const prepareInputValue = (field, value) => {
  if (value === null || value === undefined || value === '') return null;

  const typeName = FIELD_TYPES[field]?.type?.name;

  if (typeName === 'Int') {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }

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

const bindField = (request, f, v) => {
  if (f === 'setting_value') request.input('setting_value', sql.VarChar(sql.MAX), v);
  else request.input(f, FIELD_TYPES[f].type, v);
};

// 1) GET ALL - group order, then key order
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    const includeInactive =
      req.query.includeInactive === '1' || req.query.includeInactive === 'true';
    const group = (req.query.group || '').trim();

    const where = [];
    if (!includeDeleted) where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');

    const request = pool.request();
    if (group) {
      where.push('setting_group = @setting_group');
      request.input('setting_group', sql.VarChar(100), group);
    }

    const query = `
      SELECT *
      FROM dbo.tbl_home_settings
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY display_order ASC, setting_key ASC;
    `;

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC HomeSettings get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 2) GET BY ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'setting_id required' });

    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_home_settings WHERE setting_id = @setting_id;'
      : 'SELECT * FROM dbo.tbl_home_settings WHERE setting_id = @setting_id AND isdeleted = 0;';

    const result = await pool.request().input('setting_id', sql.UniqueIdentifier, id).query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Home setting not found' });
    }
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC HomeSettings get-by-id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 3) POST (UPSERT BY KEY) - same key twice updates the live row instead of
// duplicating, so admin saves are idempotent.
router.post('/', async (req, res) => {
  try {
    const data = req.body || {};
    const key = (data.setting_key || '').trim();
    if (!key) return res.status(400).json({ success: false, message: 'setting_key required' });

    await poolConnect;

    const existing = await pool
      .request()
      .input('setting_key', sql.VarChar(255), key)
      .query('SELECT setting_id FROM dbo.tbl_home_settings WHERE setting_key = @setting_key AND isdeleted = 0;');

    if (existing.recordset.length > 0) {
      const setting_id = existing.recordset[0].setting_id;
      const updates = [];
      const request = pool.request().input('setting_id', sql.UniqueIdentifier, setting_id);
      UPDATE_FIELDS.forEach((f) => {
        if (f === 'setting_key') return;
        if (data[f] != null) {
          const v = prepareInputValue(f, data[f]);
          if (v !== null) {
            updates.push(`${f} = @${f}`);
            bindField(request, f, v);
          }
        }
      });
      if (data.luu != null) {
        updates.push('luu = @luu');
        request.input('luu', sql.VarChar(100), prepareInputValue('luu', data.luu));
      }
      updates.push('lcm = DATEADD(MINUTE, 330, GETUTCDATE())');
      await request.query(
        `UPDATE dbo.tbl_home_settings SET ${updates.join(', ')} WHERE setting_id = @setting_id;`
      );
      const row = await pool
        .request()
        .input('setting_id', sql.UniqueIdentifier, setting_id)
        .query('SELECT * FROM dbo.tbl_home_settings WHERE setting_id = @setting_id;');
      return res.json({ success: true, data: row.recordset[0], upserted: true });
    }

    const cols = [];
    const vals = [];
    const request = pool.request();
    INSERT_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          cols.push(f);
          vals.push(`@${f}`);
          bindField(request, f, v);
        }
      }
    });

    if (!cols.includes('setting_key')) {
      return res.status(400).json({ success: false, message: 'setting_key required' });
    }

    cols.push('isactive', 'isdeleted', 'rcm');
    vals.push('1', '0', 'DATEADD(MINUTE, 330, GETUTCDATE())');

    const result = await request.query(
      `INSERT INTO dbo.tbl_home_settings (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC HomeSettings post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 4) PUT (UPDATE)
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.setting_id) {
      return res.status(400).json({ success: false, message: 'setting_id required' });
    }

    const updates = [];
    const request = pool.request();
    request.input('setting_id', sql.UniqueIdentifier, data.setting_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          updates.push(`${f} = @${f}`);
          bindField(request, f, v);
        }
      }
    });

    updates.push('lcm = DATEADD(MINUTE, 330, GETUTCDATE())');

    if (updates.length === 1) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_home_settings
       SET ${updates.join(', ')}
       WHERE setting_id = @setting_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Home setting not found' });
    }

    res.json({ success: true, message: 'Home setting updated' });
  } catch (err) {
    console.error('HC HomeSettings put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 5) DELETE (SOFT DELETE)
router.delete('/', async (req, res) => {
  try {
    const { setting_id, luu } = req.body;
    if (!setting_id) {
      return res.status(400).json({ success: false, message: 'setting_id required' });
    }

    await poolConnect;

    const request = pool.request().input('setting_id', sql.UniqueIdentifier, setting_id);

    if (luu != null) request.input('luu', FIELD_TYPES.luu.type, prepareInputValue('luu', luu));

    const query = luu != null
      ? `UPDATE dbo.tbl_home_settings
         SET isdeleted = 1,
             luu = @luu,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE setting_id = @setting_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_home_settings
         SET isdeleted = 1,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE setting_id = @setting_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Home setting not found' });
    }

    res.json({ success: true, message: 'Home setting deleted (soft)' });
  } catch (err) {
    console.error('HC HomeSettings delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
