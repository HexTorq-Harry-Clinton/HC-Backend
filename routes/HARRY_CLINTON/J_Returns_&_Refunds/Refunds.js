// routes/Refunds.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  refund_id: { type: sql.VarChar, maxLength: 36 },
  order_id: { type: sql.VarChar, maxLength: 36 },
  return_id: { type: sql.VarChar, maxLength: 36 },
  payment_id: { type: sql.VarChar, maxLength: 36 },
  user_id: { type: sql.VarChar, maxLength: 36 },

  refund_type: { type: sql.VarChar, maxLength: 50 },
  refund_amount: { type: sql.Decimal, precision: 18, scale: 2 },
  refund_status: { type: sql.VarChar, maxLength: 50 },
  refund_method: { type: sql.VarChar, maxLength: 50 },
  transaction_id: { type: sql.VarChar, maxLength: 100 },

  initiated_date: { type: sql.DateTime },
  processed_date: { type: sql.DateTime },
  completed_date: { type: sql.DateTime },

  failure_reason: { type: sql.VarChar, maxLength: 500 },
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
  'return_id',
  'payment_id',
  'user_id',
  'refund_type',
  'refund_amount',
  'refund_status',
  'refund_method',
  'transaction_id',
  'initiated_date',
  'notes',
  'rcu'
];

const UPDATE_FIELDS = [
  'refund_status',
  'refund_method',
  'transaction_id',
  'processed_date',
  'completed_date',
  'failure_reason',
  'notes',
  'isactive',
  'isdeleted',
  'luu'
];

const VALID_REFUND_STATUSES = [
  'initiated',
  'processing',
  'success',
  'failed'
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

  if (field === 'refund_status') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_REFUND_STATUSES.includes(v) ? v : null;
  }

  if (field === 'refund_amount') {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0 ? num : null;
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
      FROM dbo.tbl_refunds
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY rcm DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('Refunds GET error:', err);
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
        .json({ success: false, message: 'refund_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('refund_id', FIELD_TYPES.refund_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_refunds
      WHERE refund_id = @refund_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Refund not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Refunds GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_id || !data.user_id || !data.refund_amount) {
      return res.status(400).json({
        success: false,
        message: 'order_id, user_id, refund_amount required'
      });
    }

    if (parseFloat(data.refund_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'refund_amount must be greater than 0'
      });
    }

    if (data.refund_status && !VALID_REFUND_STATUSES.includes(data.refund_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `refund_status must be one of: ${VALID_REFUND_STATUSES.join(', ')}`
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
      INSERT INTO dbo.tbl_refunds (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('Refunds POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.refund_id) {
      return res.status(400).json({
        success: false,
        message: 'refund_id required'
      });
    }

    if (data.refund_status && !VALID_REFUND_STATUSES.includes(data.refund_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `refund_status must be one of: ${VALID_REFUND_STATUSES.join(', ')}`
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'refund_id',
      FIELD_TYPES.refund_id.type,
      data.refund_id
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
      UPDATE dbo.tbl_refunds
      SET ${updates.join(', ')}
      WHERE refund_id = @refund_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Refund not found' });
    }

    res.json({
      success: true,
      message: 'Refund updated'
    });
  } catch (err) {
    console.error('Refunds PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { refund_id, luu } = req.body;

    if (!refund_id) {
      return res.status(400).json({
        success: false,
        message: 'refund_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('refund_id', FIELD_TYPES.refund_id.type, refund_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_refunds
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE refund_id = @refund_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Refund not found' });
    }

    res.json({
      success: true,
      message: 'Refund deleted (soft)'
    });
  } catch (err) {
    console.error('Refunds DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
