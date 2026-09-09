// routes/reviews.js (REVIEWS MODULE - FULL CRUD)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   TABLE NAME
========================================= */
const TABLE_NAME = 'dbo.tbl_reviews';

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  review_id: { type: sql.VarChar, maxLength: 36 },
  product_id: { type: sql.VarChar, maxLength: 36 },
  variant_id: { type: sql.VarChar, maxLength: 36 },
  user_id: { type: sql.VarChar, maxLength: 36 },

  rating: { type: sql.Int },
  review_title: { type: sql.VarChar, maxLength: 255 },
  review_text: { type: sql.VarChar, maxLength: sql.MAX },

  is_verified: { type: sql.Bit },
  is_approved: { type: sql.Bit },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'product_id',
  'variant_id',
  'user_id',
  'rating',
  'review_title',
  'review_text',
  'is_verified',
  'rcu'
];

const UPDATE_FIELDS = [
  'rating',
  'review_title',
  'review_text',
  'is_approved',
  'isactive',
  'isdeleted',
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

    const { product_id, variant_id, rating } = req.query;

    const where = ['isdeleted = 0'];

    if (product_id) where.push('product_id = @product_id');
    if (variant_id) where.push('variant_id = @variant_id');
    if (rating) where.push('rating = @rating');

    const request = pool.request();

    if (product_id)
      request.input('product_id', FIELD_TYPES.product_id.type, product_id);

    if (variant_id)
      request.input('variant_id', FIELD_TYPES.variant_id.type, variant_id);

    if (rating)
      request.input('rating', FIELD_TYPES.rating.type, rating);

    const query = `
      SELECT *
      FROM ${TABLE_NAME}
      WHERE ${where.join(' AND ')}
      ORDER BY rcm DESC;
    `;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('REVIEWS GET error:', err);
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
        message: 'review_id required'
      });
    }

    await poolConnect;

    const result = await pool.request()
      .input('review_id', FIELD_TYPES.review_id.type, id)
      .query(`
        SELECT *
        FROM ${TABLE_NAME}
        WHERE review_id = @review_id AND isdeleted = 0;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('REVIEWS GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.product_id || !data.user_id || !data.rating) {
      return res.status(400).json({
        success: false,
        message: 'product_id, user_id, rating required'
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
    console.error('REVIEWS POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.review_id) {
      return res.status(400).json({
        success: false,
        message: 'review_id required'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input('review_id', FIELD_TYPES.review_id.type, String(data.review_id));

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
      WHERE review_id = @review_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review updated'
    });
  } catch (err) {
    console.error('REVIEWS PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { review_id, luu } = req.body;

    if (!review_id) {
      return res.status(400).json({
        success: false,
        message: 'review_id required'
      });
    }

    await poolConnect;

    const request = pool.request()
      .input('review_id', FIELD_TYPES.review_id.type, String(review_id));

    if (luu)
      request.input('luu', FIELD_TYPES.luu.type, luu);

    const result = await request.query(`
      UPDATE ${TABLE_NAME}
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE review_id = @review_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review deleted'
    });
  } catch (err) {
    console.error('REVIEWS DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;