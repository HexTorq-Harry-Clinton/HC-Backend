// routes/RunningBarItem.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  running_bar_item_id: { type: sql.VarChar, maxLength: 36 },
  running_bar_id: { type: sql.VarChar, maxLength: 36 },
  itemsdata: { type: sql.VarChar }, // varchar(max)
  duration_seconds: { type: sql.Int },
  display_order: { type: sql.Int },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = ['running_bar_id', 'itemsdata', 'duration_seconds', 'display_order', 'rcu'];
const UPDATE_FIELDS = ['itemsdata', 'duration_seconds', 'display_order', 'isactive', 'isdeleted', 'luu'];

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

// 1) GET ALL
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
      FROM dbo.tbl_running_bar_items
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY display_order ASC, rcm DESC;
    `;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC RunningBarItems get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 2) GET BY ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'running_bar_item_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('running_bar_item_id', FIELD_TYPES.running_bar_item_id.type, id);

    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_running_bar_items WHERE running_bar_item_id = @running_bar_item_id;'
      : 'SELECT * FROM dbo.tbl_running_bar_items WHERE running_bar_item_id = @running_bar_item_id AND isdeleted = 0;';

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Running bar item not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC RunningBarItems get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 3) POST (CREATE)
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    if (!data.running_bar_id || !data.itemsdata) {
      return res.status(400).json({ success: false, message: 'running_bar_id and itemsdata are required' });
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
          if (f === 'itemsdata') {
            request.input('itemsdata', sql.VarChar(sql.MAX), v);
          } else {
            request.input(f, FIELD_TYPES[f].type, v);
          }
        }
      }
    });

    if (cols.length === 0) return res.status(400).json({ success: false, message: 'No valid fields' });

    await poolConnect;

    const result = await request.query(
      `INSERT INTO dbo.tbl_running_bar_items (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC RunningBarItems post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 4) PUT (UPDATE)
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.running_bar_item_id) {
      return res.status(400).json({ success: false, message: 'running_bar_item_id required' });
    }

    const updates = [];
    const request = pool.request();
    request.input('running_bar_item_id', FIELD_TYPES.running_bar_item_id.type, data.running_bar_item_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          updates.push(`${f} = @${f}`);
          if (f === 'itemsdata') {
            request.input('itemsdata', sql.VarChar(sql.MAX), v);
          } else {
            request.input(f, FIELD_TYPES[f].type, v);
          }
        }
      }
    });

    updates.push('lcm = DATEADD(MINUTE, 330, GETUTCDATE())');

    if (updates.length === 1) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_running_bar_items
       SET ${updates.join(', ')}
       WHERE running_bar_item_id = @running_bar_item_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Running bar item not found' });
    }

    res.json({ success: true, message: 'Running bar item updated' });
  } catch (err) {
    console.error('HC RunningBarItems put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 5) DELETE (SOFT DELETE)
router.delete('/', async (req, res) => {
  try {
    const { running_bar_item_id, luu } = req.body;
    if (!running_bar_item_id) {
      return res.status(400).json({ success: false, message: 'running_bar_item_id required' });
    }

    await poolConnect;

    const request = pool.request().input('running_bar_item_id', FIELD_TYPES.running_bar_item_id.type, running_bar_item_id);

    if (luu != null) request.input('luu', FIELD_TYPES.luu.type, prepareInputValue('luu', luu));

    const query = luu != null
      ? `UPDATE dbo.tbl_running_bar_items
         SET isdeleted = 1,
             luu = @luu,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE running_bar_item_id = @running_bar_item_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_running_bar_items
         SET isdeleted = 1,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE running_bar_item_id = @running_bar_item_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Running bar item not found' });
    }

    res.json({ success: true, message: 'Running bar item deleted (soft)' });
  } catch (err) {
    console.error('HC RunningBarItems delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
