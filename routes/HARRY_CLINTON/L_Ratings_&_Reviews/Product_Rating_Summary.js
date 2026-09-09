// routes/reviews.js (REVIEWS MODULE - FULL CRUD)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');
const TABLE_NAME = 'dbo.tbl_product_rating_summary';

const FIELD_TYPES = {
  product_id: { type: sql.VarChar, maxLength: 36 },

  avg_rating: { type: sql.Decimal, precision: 3, scale: 2 },
  total_reviews: { type: sql.Int },

  rating_1_count: { type: sql.Int },
  rating_2_count: { type: sql.Int },
  rating_3_count: { type: sql.Int },
  rating_4_count: { type: sql.Int },
  rating_5_count: { type: sql.Int },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'product_id',
  'avg_rating',
  'total_reviews',
  'rating_1_count',
  'rating_2_count',
  'rating_3_count',
  'rating_4_count',
  'rating_5_count',
  'rcu'
];

const UPDATE_FIELDS = [
  'avg_rating',
  'total_reviews',
  'rating_1_count',
  'rating_2_count',
  'rating_3_count',
  'rating_4_count',
  'rating_5_count',
  'luu'
];
/* =========================================
   COMMON FUNCTIONS
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

  if (field === 'rating') {
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= 1 && num <= 5 ? num : null;
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

    const { product_id } = req.query;

    const where = [];

    if (product_id) where.push('product_id = @product_id');

    const request = pool.request();

    if (product_id)
      request.input('product_id', FIELD_TYPES.product_id.type, product_id);

    const query = `
      SELECT *
      FROM ${TABLE_NAME}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY rcm DESC;
    `;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('ProductRatingSummary GET error:', err);
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
      return res.status(400).json({
        success: false,
        message: 'product_id required'
      });
    }

    await poolConnect;

    const result = await pool.request()
      .input('product_id', FIELD_TYPES.product_id.type, id)
      .query(`
        SELECT *
        FROM ${TABLE_NAME}
        WHERE product_id = @product_id;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product rating summary not found'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('ProductRatingSummary GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.product_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id required'
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
      INSERT INTO ${TABLE_NAME} (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('ProductRatingSummary POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.product_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id required'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input('product_id', FIELD_TYPES.product_id.type, data.product_id);

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
        message: 'No fields to update'
      });
    }

    await poolConnect;

    const result = await request.query(`
      UPDATE ${TABLE_NAME}
      SET ${updates.join(', ')}
      WHERE product_id = @product_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product rating summary not found'
      });
    }

    res.json({
      success: true,
      message: 'Product rating summary updated'
    });
  } catch (err) {
    console.error('ProductRatingSummary PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (HARD DELETE)
   Note: tbl_product_rating_summary has no isactive/isdeleted columns.
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id required'
      });
    }

    await poolConnect;

    const request = pool.request()
      .input('product_id', FIELD_TYPES.product_id.type, product_id);

    const result = await request.query(`
      DELETE FROM ${TABLE_NAME}
      WHERE product_id = @product_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product rating summary not found'
      });
    }

    res.json({
      success: true,
      message: 'Product rating summary deleted'
    });
  } catch (err) {
    console.error('ProductRatingSummary DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;