// routes/Payments.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  payment_id: { type: sql.VarChar, maxLength: 36 },
  order_id: { type: sql.VarChar, maxLength: 36 },
  user_id: { type: sql.VarChar, maxLength: 36 },

  payment_provider: { type: sql.VarChar, maxLength: 50 },
  payment_method_type: { type: sql.VarChar, maxLength: 20 },
  payment_status: { type: sql.VarChar, maxLength: 50 },

  amount: { type: sql.Decimal, precision: 18, scale: 2 },
  currency_code: { type: sql.VarChar, maxLength: 10 },

  razorpay_order_id: { type: sql.VarChar, maxLength: 100 },
  razorpay_payment_id: { type: sql.VarChar, maxLength: 100 },
  razorpay_signature: { type: sql.VarChar, maxLength: 255 },

  paid_at: { type: sql.DateTime },
  failed_at: { type: sql.DateTime },

  refund_amount: { type: sql.Decimal, precision: 18, scale: 2 },
  refunded_at: { type: sql.DateTime },

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
  'payment_provider',
  'payment_method_type',
  'payment_status',
  'amount',
  'currency_code',
  'razorpay_order_id',
  'razorpay_payment_id',
  'razorpay_signature',
  'rcu'
];

const UPDATE_FIELDS = [
  'payment_method_type',
  'payment_status',
  'amount',
  'razorpay_payment_id',
  'razorpay_signature',
  'paid_at',
  'failed_at',
  'refund_amount',
  'refunded_at',
  'notes',
  'isactive',
  'isdeleted',
  'luu'
];

const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
const VALID_PAYMENT_METHODS = ['card', 'upi', 'netbanking', 'wallet'];

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

  if (field === 'payment_status') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_PAYMENT_STATUSES.includes(v) ? v : null;
  }

  if (field === 'payment_method_type') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_PAYMENT_METHODS.includes(v) ? v : null;
  }

  if (field === 'currency_code') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return v.length > 0 ? v : null;
  }

  if (field === 'amount' || field === 'refund_amount') {
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
      FROM dbo.tbl_payments
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
    console.error('Payments GET error:', err);
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
        .json({ success: false, message: 'payment_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('payment_id', FIELD_TYPES.payment_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_payments
      WHERE payment_id = @payment_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Payments GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_id || !data.user_id || !data.amount) {
      return res.status(400).json({
        success: false,
        message: 'order_id, user_id, amount required'
      });
    }

    if (parseFloat(data.amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amount must be greater than 0'
      });
    }

    if (data.payment_status && !VALID_PAYMENT_STATUSES.includes(data.payment_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `payment_status must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`
      });
    }

    if (data.payment_method_type && !VALID_PAYMENT_METHODS.includes(data.payment_method_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `payment_method_type must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`
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
      INSERT INTO dbo.tbl_payments (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('Payments POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.payment_id) {
      return res.status(400).json({
        success: false,
        message: 'payment_id required'
      });
    }

    if (data.payment_status && !VALID_PAYMENT_STATUSES.includes(data.payment_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `payment_status must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`
      });
    }

    if (data.payment_method_type && !VALID_PAYMENT_METHODS.includes(data.payment_method_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `payment_method_type must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`
      });
    }

    if (data.amount && parseFloat(data.amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amount must be greater than 0'
      });
    }

    if (data.refund_amount && parseFloat(data.refund_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'refund_amount must be greater than 0'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'payment_id',
      FIELD_TYPES.payment_id.type,
      data.payment_id
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
      UPDATE dbo.tbl_payments
      SET ${updates.join(', ')}
      WHERE payment_id = @payment_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }

    res.json({
      success: true,
      message: 'Payment updated'
    });
  } catch (err) {
    console.error('Payments PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { payment_id, luu } = req.body;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: 'payment_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('payment_id', FIELD_TYPES.payment_id.type, payment_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_payments
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE payment_id = @payment_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }

    res.json({
      success: true,
      message: 'Payment deleted (soft)'
    });
  } catch (err) {
    console.error('Payments DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
