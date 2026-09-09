// routes/Discounts.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  discount_id: { type: sql.VarChar, maxLength: 36 },
  discount_name: { type: sql.VarChar, maxLength: 255 },
  description: { type: sql.VarChar, maxLength: 500 },

  discount_type: { type: sql.VarChar, maxLength: 20 },
  discount_value: { type: sql.Decimal, precision: 18, scale: 2 },

  start_date: { type: sql.DateTime },
  end_date: { type: sql.DateTime },

  max_discount_amount: { type: sql.Decimal, precision: 18, scale: 2 },

  usage_limit: { type: sql.Int },

  discount_priority: { type: sql.Int },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'discount_name',
  'description',
  'discount_type',
  'discount_value',
  'start_date',
  'end_date',
  'max_discount_amount',
  'usage_limit',
  'discount_priority',
  'rcu'
];

const UPDATE_FIELDS = [
  'discount_name',
  'description',
  'discount_type',
  'discount_value',
  'start_date',
  'end_date',
  'max_discount_amount',
  'usage_limit',
  'discount_priority',
  'isactive',
  'isdeleted',
  'luu'
];

const VALID_DISCOUNT_TYPES = ['fixed', 'percentage'];

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

  if (field === 'discount_type') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_DISCOUNT_TYPES.includes(v) ? v : null;
  }

  if (field === 'discount_value' || field === 'max_discount_amount') {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0 ? num : null;
  }

  if (field === 'usage_limit') {
    const num = parseInt(value, 10);
    return !isNaN(num) && num > 0 ? num : null;
  }

  if (field === 'discount_priority') {
    const num = parseInt(value, 10);
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
      FROM dbo.tbl_discounts
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
    console.error('Discounts GET error:', err);
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
        .json({ success: false, message: 'discount_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('discount_id', FIELD_TYPES.discount_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_discounts
      WHERE discount_id = @discount_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Discount not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Discounts GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.discount_name || !data.discount_type || !data.discount_value) {
      return res.status(400).json({
        success: false,
        message: 'discount_name, discount_type, discount_value required'
      });
    }

    if (!VALID_DISCOUNT_TYPES.includes(data.discount_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `discount_type must be one of: ${VALID_DISCOUNT_TYPES.join(', ')}`
      });
    }

    if (parseFloat(data.discount_value) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'discount_value must be greater than 0'
      });
    }

    if (data.max_discount_amount && parseFloat(data.max_discount_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'max_discount_amount must be greater than 0'
      });
    }

    if (data.discount_priority && parseInt(data.discount_priority, 10) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'discount_priority must be greater than 0'
      });
    }

    // discount_priority is NOT NULL in the DB - default to 1 if not provided
    if (data.discount_priority == null) {
      data.discount_priority = 1;
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
      INSERT INTO dbo.tbl_discounts (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('Discounts POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.discount_id) {
      return res.status(400).json({
        success: false,
        message: 'discount_id required'
      });
    }

    if (data.discount_type && !VALID_DISCOUNT_TYPES.includes(data.discount_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `discount_type must be one of: ${VALID_DISCOUNT_TYPES.join(', ')}`
      });
    }

    if (data.discount_value && parseFloat(data.discount_value) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'discount_value must be greater than 0'
      });
    }

    if (data.max_discount_amount && parseFloat(data.max_discount_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'max_discount_amount must be greater than 0'
      });
    }

    if (data.discount_priority && parseInt(data.discount_priority, 10) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'discount_priority must be greater than 0'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'discount_id',
      FIELD_TYPES.discount_id.type,
      data.discount_id
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
      UPDATE dbo.tbl_discounts
      SET ${updates.join(', ')}
      WHERE discount_id = @discount_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Discount not found' });
    }

    res.json({
      success: true,
      message: 'Discount updated'
    });
  } catch (err) {
    console.error('Discounts PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { discount_id, luu } = req.body;

    if (!discount_id) {
      return res.status(400).json({
        success: false,
        message: 'discount_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('discount_id', FIELD_TYPES.discount_id.type, discount_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_discounts
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE discount_id = @discount_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Discount not found' });
    }

    res.json({
      success: true,
      message: 'Discount deleted (soft)'
    });
  } catch (err) {
    console.error('Discounts DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
