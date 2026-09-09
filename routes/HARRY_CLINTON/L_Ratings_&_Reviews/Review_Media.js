// routes/Review_Media.js (HARRY_CLINTON) - FULL CRUD for tbl_review_media

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');
const TABLE_NAME = 'dbo.tbl_review_media';

const FIELD_TYPES = {
  media_id: { type: sql.VarChar, maxLength: 36 },
  review_id: { type: sql.VarChar, maxLength: 36 },

  media_type: { type: sql.VarChar, maxLength: 20 },
  media_url: { type: sql.VarChar, maxLength: 500 },

  isdeleted: { type: sql.Bit },
  isactive: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'review_id',
  'media_type',
  'media_url',
  'rcu'
];

const UPDATE_FIELDS = [
  'media_type',
  'media_url',
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

  return typeof value === 'string' ? value.trim() : value;
};

const IST_NOW_SQL = 'DATEADD(MINUTE, 330, GETUTCDATE())';

/* =========================================
   1) GET ALL
========================================= */
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const { review_id, media_type } = req.query;

    const where = ['isdeleted = 0'];

    if (review_id) where.push('review_id = @review_id');
    if (media_type) where.push('media_type = @media_type');

    const request = pool.request();

    if (review_id)
      request.input('review_id', FIELD_TYPES.review_id.type, review_id);

    if (media_type)
      request.input('media_type', FIELD_TYPES.media_type.type, media_type);

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
    console.error('REVIEW MEDIA GET error:', err);
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
        message: 'media_id required'
      });
    }

    await poolConnect;

    const result = await pool.request()
      .input('media_id', FIELD_TYPES.media_id.type, id)
      .query(`
        SELECT *
        FROM ${TABLE_NAME}
        WHERE media_id = @media_id AND isdeleted = 0;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review media not found'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('REVIEW MEDIA GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.review_id || !data.media_type || !data.media_url) {
      return res.status(400).json({
        success: false,
        message: 'review_id, media_type, media_url required'
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
    console.error('REVIEW MEDIA POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.media_id) {
      return res.status(400).json({
        success: false,
        message: 'media_id required'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input('media_id', FIELD_TYPES.media_id.type, String(data.media_id));

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
      WHERE media_id = @media_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review media not found'
      });
    }

    res.json({
      success: true,
      message: 'Review media updated'
    });
  } catch (err) {
    console.error('REVIEW MEDIA PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { media_id, luu } = req.body;

    if (!media_id) {
      return res.status(400).json({
        success: false,
        message: 'media_id required'
      });
    }

    await poolConnect;

    const request = pool.request()
      .input('media_id', FIELD_TYPES.media_id.type, String(media_id));

    if (luu)
      request.input('luu', FIELD_TYPES.luu.type, luu);

    const result = await request.query(`
      UPDATE ${TABLE_NAME}
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE media_id = @media_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review media not found'
      });
    }

    res.json({
      success: true,
      message: 'Review media deleted'
    });
  } catch (err) {
    console.error('REVIEW MEDIA DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
