// routes/OrderPromotions.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  order_promotion_id: { type: sql.VarChar, maxLength: 36 },
  order_id: { type: sql.VarChar, maxLength: 36 },

  promotion_type: { type: sql.VarChar, maxLength: 50 },
  promotion_id: { type: sql.VarChar, maxLength: 36 },
  promotion_name: { type: sql.VarChar, maxLength: 255 },

  discount_type: { type: sql.VarChar, maxLength: 20 },
  discount_value: { type: sql.Decimal, precision: 18, scale: 2 },

  discount_amount: { type: sql.Decimal, precision: 18, scale: 2 },

  applied_at: { type: sql.DateTime },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const VALID_PROMOTION_TYPES = ['coupon', 'discount', 'automatic', 'referral'];

const INSERT_FIELDS = [
  'order_id',
  'promotion_type',
  'promotion_id',
  'promotion_name',
  'discount_type',
  'discount_value',
  'discount_amount',
  'applied_at',
  'rcu'
];

const UPDATE_FIELDS = [
  'promotion_name',
  'discount_type',
  'discount_value',
  'discount_amount',
  'applied_at',
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

  if (field === 'discount_amount' || field === 'discount_value') {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 ? num : null;
  }

  if (field === 'promotion_type') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_PROMOTION_TYPES.includes(v) ? v : null;
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
      FROM dbo.tbl_order_promotions
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY applied_at DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('OrderPromotions GET error:', err);
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
        .json({ success: false, message: 'order_promotion_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('order_promotion_id', FIELD_TYPES.order_promotion_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_order_promotions
      WHERE order_promotion_id = @order_promotion_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Order promotion not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('OrderPromotions GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_id || !data.promotion_type) {
      return res.status(400).json({
        success: false,
        message: 'order_id, promotion_type required'
      });
    }

    if (!VALID_PROMOTION_TYPES.includes(data.promotion_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `promotion_type must be one of: ${VALID_PROMOTION_TYPES.join(', ')}`
      });
    }

    if (data.discount_amount == null) {
      return res.status(400).json({
        success: false,
        message: 'discount_amount required'
      });
    }

    if (parseFloat(data.discount_amount) < 0) {
      return res.status(400).json({
        success: false,
        message: 'discount_amount cannot be negative'
      });
    }

    if (data.discount_value && parseFloat(data.discount_value) < 0) {
      return res.status(400).json({
        success: false,
        message: 'discount_value cannot be negative'
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
      INSERT INTO dbo.tbl_order_promotions (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('OrderPromotions POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_promotion_id) {
      return res.status(400).json({
        success: false,
        message: 'order_promotion_id required'
      });
    }

    if (data.discount_amount && parseFloat(data.discount_amount) < 0) {
      return res.status(400).json({
        success: false,
        message: 'discount_amount cannot be negative'
      });
    }

    if (data.discount_value && parseFloat(data.discount_value) < 0) {
      return res.status(400).json({
        success: false,
        message: 'discount_value cannot be negative'
      });
    }

    if (data.promotion_type && !VALID_PROMOTION_TYPES.includes(data.promotion_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `promotion_type must be one of: ${VALID_PROMOTION_TYPES.join(', ')}`
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'order_promotion_id',
      FIELD_TYPES.order_promotion_id.type,
      data.order_promotion_id
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
      UPDATE dbo.tbl_order_promotions
      SET ${updates.join(', ')}
      WHERE order_promotion_id = @order_promotion_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Order promotion not found' });
    }

    res.json({
      success: true,
      message: 'Order promotion updated'
    });
  } catch (err) {
    console.error('OrderPromotions PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { order_promotion_id, luu } = req.body;

    if (!order_promotion_id) {
      return res.status(400).json({
        success: false,
        message: 'order_promotion_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('order_promotion_id', FIELD_TYPES.order_promotion_id.type, order_promotion_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_order_promotions
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE order_promotion_id = @order_promotion_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Order promotion not found' });
    }

    res.json({
      success: true,
      message: 'Order promotion deleted (soft)'
    });
  } catch (err) {
    console.error('OrderPromotions DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
