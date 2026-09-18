// routes/NotificationBar.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)
// Single-table ticker for the TOP black strip (notification bar).
// NOTE: table dbo.tbl_notification_bars must exist — see
// scripts/create-tbl-notification-bars.sql (one-time DBA run).
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  notification_bar_id: { type: sql.VarChar, maxLength: 36 },
  notification_text: { type: sql.VarChar }, // varchar(max)
  duration_seconds: { type: sql.Int },
  orderpriority: { type: sql.Int },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = ['notification_text', 'duration_seconds', 'orderpriority', 'rcu'];
const UPDATE_FIELDS = ['notification_text', 'duration_seconds', 'orderpriority', 'isactive', 'isdeleted', 'luu'];

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
  if (f === 'notification_text') request.input('notification_text', sql.VarChar(sql.MAX), v);
  else request.input(f, FIELD_TYPES[f].type, v);
};

// 1) GET ALL — queue order
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
      FROM dbo.tbl_notification_bars
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY orderpriority ASC, rcm DESC;
    `;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC NotificationBar get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 2) GET BY ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'notification_bar_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('notification_bar_id', FIELD_TYPES.notification_bar_id.type, id);

    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_notification_bars WHERE notification_bar_id = @notification_bar_id;'
      : 'SELECT * FROM dbo.tbl_notification_bars WHERE notification_bar_id = @notification_bar_id AND isdeleted = 0;';

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification bar not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC NotificationBar get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 3) POST (CREATE) — orderpriority auto-appends when omitted
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    if (!data.notification_text) {
      return res.status(400).json({ success: false, message: 'notification_text is required' });
    }

    await poolConnect;

    const cols = [];
    const vals = [];
    const request = pool.request();

    INSERT_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          cols.push(f);
          vals.push('@' + f);
          bindField(request, f, v);
        }
      }
    });

    if (!cols.includes('orderpriority')) {
      const maxRes = await pool.request().query(
        'SELECT ISNULL(MAX(orderpriority), 0) AS maxOrder FROM dbo.tbl_notification_bars WHERE isdeleted = 0;'
      );
      cols.push('orderpriority');
      vals.push('@orderpriority');
      request.input('orderpriority', sql.Int, (maxRes.recordset[0]?.maxOrder || 0) + 1);
    }

    if (cols.length === 0) return res.status(400).json({ success: false, message: 'No valid fields' });

    // enforce defaults
    cols.push('isactive', 'isdeleted', 'rcm');
    vals.push('1', '0', 'DATEADD(MINUTE, 330, GETUTCDATE())');

    const result = await request.query(
      `INSERT INTO dbo.tbl_notification_bars (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC NotificationBar post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 4) PUT (UPDATE)
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.notification_bar_id) {
      return res.status(400).json({ success: false, message: 'notification_bar_id required' });
    }

    const updates = [];
    const request = pool.request();
    request.input('notification_bar_id', FIELD_TYPES.notification_bar_id.type, data.notification_bar_id);

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
      `UPDATE dbo.tbl_notification_bars
       SET ${updates.join(', ')}
       WHERE notification_bar_id = @notification_bar_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Notification bar not found' });
    }

    res.json({ success: true, message: 'Notification bar updated' });
  } catch (err) {
    console.error('HC NotificationBar put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 5) DELETE (SOFT DELETE)
router.delete('/', async (req, res) => {
  try {
    const { notification_bar_id, luu } = req.body;
    if (!notification_bar_id) {
      return res.status(400).json({ success: false, message: 'notification_bar_id required' });
    }

    await poolConnect;

    const request = pool.request().input('notification_bar_id', FIELD_TYPES.notification_bar_id.type, notification_bar_id);

    if (luu != null) request.input('luu', FIELD_TYPES.luu.type, prepareInputValue('luu', luu));

    const query = luu != null
      ? `UPDATE dbo.tbl_notification_bars
         SET isdeleted = 1,
             luu = @luu,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE notification_bar_id = @notification_bar_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_notification_bars
         SET isdeleted = 1,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE notification_bar_id = @notification_bar_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Notification bar not found' });
    }

    res.json({ success: true, message: 'Notification bar deleted (soft)' });
  } catch (err) {
    console.error('HC NotificationBar delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
