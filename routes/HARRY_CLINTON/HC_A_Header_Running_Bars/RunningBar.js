// routes/RunningBar.js (HARRY_CLINTON)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  running_bar_id: { type: sql.VarChar, maxLength: 36 },
  running_bar_name: { type: sql.VarChar, maxLength: 255 },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = ['running_bar_name', 'rcu']; // id/rcm/default bits handled by DB defaults
const UPDATE_FIELDS = ['running_bar_name', 'isactive', 'isdeleted', 'luu'];

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

  if (typeName === 'DateTime') {
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return typeof value === 'string' ? value.trim() : value;
};

/**
 * GET /running-bars
 * Default: non-deleted only.
 * Query:
 *  - ?includeDeleted=1
 *  - ?includeInactive=1
 */
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    const where = [];
    if (!includeDeleted) where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');

    const query = `
      SELECT *
      FROM dbo.tbl_running_bars
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY running_bar_name ASC;
    `;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC RunningBars get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * GET /running-bars/:id
 * Default: non-deleted only.
 * Use ?includeDeleted=1 to include deleted.
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'running_bar_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('running_bar_id', FIELD_TYPES.running_bar_id.type, id);

    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_running_bars WHERE running_bar_id = @running_bar_id;'
      : 'SELECT * FROM dbo.tbl_running_bars WHERE running_bar_id = @running_bar_id AND isdeleted = 0;';

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Running bar not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC RunningBars get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * POST /running-bars
 * Required: running_bar_name
 * Body: { running_bar_name, rcu }
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    if (!data.running_bar_name) {
      return res.status(400).json({ success: false, message: 'running_bar_name is required' });
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

    if (cols.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields' });
    }

    await poolConnect;

    const result = await request.query(
      `INSERT INTO dbo.tbl_running_bars (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC RunningBars post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * PUT /running-bars
 * Required: running_bar_id
 * Updates fields + sets lcm to IST (UTC + 330 mins)
 */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.running_bar_id) {
      return res.status(400).json({ success: false, message: 'running_bar_id required' });
    }

    const updates = [];
    const request = pool.request();
    request.input('running_bar_id', FIELD_TYPES.running_bar_id.type, data.running_bar_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          updates.push(`${f} = @${f}`);
          request.input(f, FIELD_TYPES[f].type, v);
        }
      }
    });

    // Always update lcm (IST)
    updates.push('lcm = DATEADD(MINUTE, 330, GETUTCDATE())');

    if (updates.length === 1) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_running_bars
       SET ${updates.join(', ')}
       WHERE running_bar_id = @running_bar_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Running bar not found' });
    }

    res.json({ success: true, message: 'Running bar updated' });
  } catch (err) {
    console.error('HC RunningBars put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * DELETE /running-bars
 * Soft delete: sets isdeleted=1 + lcm
 * Body: { running_bar_id, luu? }
 */
router.delete('/', async (req, res) => {
  try {
    const { running_bar_id, luu } = req.body;
    if (!running_bar_id) {
      return res.status(400).json({ success: false, message: 'running_bar_id required' });
    }

    await poolConnect;

    const request = pool.request().input('running_bar_id', FIELD_TYPES.running_bar_id.type, running_bar_id);

    if (luu != null) {
      const v = prepareInputValue('luu', luu);
      if (v !== null) request.input('luu', FIELD_TYPES.luu.type, v);
    }

    const query = luu != null
      ? `UPDATE dbo.tbl_running_bars
         SET isdeleted = 1,
             luu = @luu,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE running_bar_id = @running_bar_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_running_bars
         SET isdeleted = 1,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE running_bar_id = @running_bar_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Running bar not found' });
    }

    res.json({ success: true, message: 'Running bar deleted (soft)' });
  } catch (err) {
    console.error('HC RunningBars delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;

/**
 * ---------------------------
 * SAMPLE REQUEST PAYLOADS
 * ---------------------------
 *
 * 1) POST /running-bars
 * {
 *   "running_bar_name": "Downtown Marathon Club",
 *   "rcu": "ADMIN_PORTAL"
 * }
 *
 * 2) PUT /running-bars
 * {
 *   "running_bar_id": "0D5A2C7E-8F4D-4A1D-9B3E-2F5D9C7A1B22",
 *   "running_bar_name": "Downtown Marathon Club (Updated)",
 *   "isactive": true,
 *   "luu": "ADMIN_PORTAL"
 * }
 *
 * 3) DELETE /running-bars
 * {
 *   "running_bar_id": "0D5A2C7E-8F4D-4A1D-9B3E-2F5D9C7A1B22",
 *   "luu": "ADMIN_PORTAL"
 * }
 */
