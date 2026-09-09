// routes/Returns.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  return_id: { type: sql.VarChar, maxLength: 36 },
  order_id: { type: sql.VarChar, maxLength: 36 },
  user_id: { type: sql.VarChar, maxLength: 36 },

  return_type: { type: sql.VarChar, maxLength: 50 },
  return_reason: { type: sql.VarChar, maxLength: 500 },
  return_reason_code: { type: sql.VarChar, maxLength: 50 },
  return_status: { type: sql.VarChar, maxLength: 50 },
  return_items_count: { type: sql.Int },
  return_amount: { type: sql.Decimal },

  requested_date: { type: sql.DateTime },
  approved_date: { type: sql.DateTime },
  received_date: { type: sql.DateTime },
  completed_date: { type: sql.DateTime },

  rma_number: { type: sql.VarChar, maxLength: 100 },
  notes: { type: sql.VarChar, maxLength: 500 },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'order_id',
  'user_id',
  'return_type',
  'return_reason',
  'return_reason_code',
  'return_status',
  'return_items_count',
  'return_amount',
  'requested_date',
  'approved_date',
  'rma_number',
  'notes',
  'rcu'
];

const UPDATE_FIELDS = [
  'return_type',
  'return_reason',
  'return_reason_code',
  'return_status',
  'return_items_count',
  'return_amount',
  'approved_date',
  'received_date',
  'completed_date',
  'rma_number',
  'notes',
  'isactive',
  'isdeleted',
  'luu'
];

const VALID_RETURN_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'received',
  'processed'
];

const VALID_RETURN_TYPES = ['full', 'partial'];

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

  if (field === 'return_status') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_RETURN_STATUSES.includes(v) ? v : null;
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

    const includeInactive =
      req.query.includeInactive === '1' ||
      req.query.includeInactive === 'true';

    const where = [];
    if (!includeDeleted) where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');

    const query = `
      SELECT *
      FROM dbo.tbl_returns
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY requested_date DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('Returns GET error:', err);
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
        .json({ success: false, message: 'return_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('return_id', FIELD_TYPES.return_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_returns
      WHERE return_id = @return_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Return not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Returns GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_id || !data.user_id || !data.return_type) {
      return res.status(400).json({
        success: false,
        message: 'order_id, user_id, return_type required'
      });
    }

    if (!VALID_RETURN_TYPES.includes(data.return_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `return_type must be one of: ${VALID_RETURN_TYPES.join(', ')}`
      });
    }

    if (data.return_status && !VALID_RETURN_STATUSES.includes(data.return_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `return_status must be one of: ${VALID_RETURN_STATUSES.join(', ')}`
      });
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
      INSERT INTO dbo.tbl_returns (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('Returns POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.return_id) {
      return res.status(400).json({
        success: false,
        message: 'return_id required'
      });
    }

    if (data.return_status && !VALID_RETURN_STATUSES.includes(data.return_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `return_status must be one of: ${VALID_RETURN_STATUSES.join(', ')}`
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'return_id',
      FIELD_TYPES.return_id.type,
      data.return_id
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
      UPDATE dbo.tbl_returns
      SET ${updates.join(', ')}
      WHERE return_id = @return_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Return not found' });
    }

    res.json({
      success: true,
      message: 'Return updated'
    });
  } catch (err) {
    console.error('Returns PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { return_id, luu } = req.body;

    if (!return_id) {
      return res.status(400).json({
        success: false,
        message: 'return_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('return_id', FIELD_TYPES.return_id.type, return_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_returns
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE return_id = @return_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Return not found' });
    }

    res.json({
      success: true,
      message: 'Return deleted (soft)'
    });
  } catch (err) {
    console.error('Returns DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
