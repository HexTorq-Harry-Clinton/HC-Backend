// routes/Review_Votes.js (HARRY_CLINTON) - FULL CRUD for tbl_review_votes

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');
const TABLE_NAME = 'dbo.tbl_review_votes';

const FIELD_TYPES = {
  vote_id: { type: sql.VarChar, maxLength: 36 },
  review_id: { type: sql.VarChar, maxLength: 36 },
  user_id: { type: sql.VarChar, maxLength: 36 },

  is_helpful: { type: sql.Bit },

  isdeleted: { type: sql.Bit },
  isactive: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'review_id',
  'user_id',
  'is_helpful',
  'rcu'
];

const UPDATE_FIELDS = [
  'is_helpful',
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

    const { review_id, user_id } = req.query;

    const where = ['isdeleted = 0'];

    if (review_id) where.push('review_id = @review_id');
    if (user_id) where.push('user_id = @user_id');

    const request = pool.request();

    if (review_id)
      request.input('review_id', FIELD_TYPES.review_id.type, review_id);

    if (user_id)
      request.input('user_id', FIELD_TYPES.user_id.type, user_id);

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
    console.error('REVIEW VOTES GET error:', err);
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
        message: 'vote_id required'
      });
    }

    await poolConnect;

    const result = await pool.request()
      .input('vote_id', FIELD_TYPES.vote_id.type, id)
      .query(`
        SELECT *
        FROM ${TABLE_NAME}
        WHERE vote_id = @vote_id AND isdeleted = 0;
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review vote not found'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('REVIEW VOTES GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.review_id || !data.user_id || data.is_helpful === undefined || data.is_helpful === null) {
      return res.status(400).json({
        success: false,
        message: 'review_id, user_id, is_helpful required'
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
    console.error('REVIEW VOTES POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.vote_id) {
      return res.status(400).json({
        success: false,
        message: 'vote_id required'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input('vote_id', FIELD_TYPES.vote_id.type, String(data.vote_id));

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
      WHERE vote_id = @vote_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review vote not found'
      });
    }

    res.json({
      success: true,
      message: 'Review vote updated'
    });
  } catch (err) {
    console.error('REVIEW VOTES PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { vote_id, luu } = req.body;

    if (!vote_id) {
      return res.status(400).json({
        success: false,
        message: 'vote_id required'
      });
    }

    await poolConnect;

    const request = pool.request()
      .input('vote_id', FIELD_TYPES.vote_id.type, String(vote_id));

    if (luu)
      request.input('luu', FIELD_TYPES.luu.type, luu);

    const result = await request.query(`
      UPDATE ${TABLE_NAME}
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE vote_id = @vote_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review vote not found'
      });
    }

    res.json({
      success: true,
      message: 'Review vote deleted'
    });
  } catch (err) {
    console.error('REVIEW VOTES DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
