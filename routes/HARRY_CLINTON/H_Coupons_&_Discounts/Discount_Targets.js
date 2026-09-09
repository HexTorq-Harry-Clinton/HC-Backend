// routes/DiscountTargets.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  discount_target_id: { type: sql.VarChar, maxLength: 36 },
  discount_id: { type: sql.VarChar, maxLength: 36 },

  target_type: { type: sql.VarChar, maxLength: 50 },
  target_id: { type: sql.VarChar, maxLength: 36 },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'discount_id',
  'target_type',
  'target_id',
  'rcu'
];

const UPDATE_FIELDS = [
  'target_type',
  'target_id',
  'isactive',
  'isdeleted',
  'luu'
];

const VALID_TARGET_TYPES = [
  'all',
  'product',
  'category',
  'collection'
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

  if (field === 'target_type') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_TARGET_TYPES.includes(v) ? v : null;
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
      FROM dbo.tbl_discount_targets
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
    console.error('DiscountTargets GET error:', err);
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
        .json({ success: false, message: 'discount_target_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('discount_target_id', FIELD_TYPES.discount_target_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_discount_targets
      WHERE discount_target_id = @discount_target_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Discount target not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('DiscountTargets GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.discount_id || !data.target_type) {
      return res.status(400).json({
        success: false,
        message: 'discount_id, target_type required'
      });
    }

    if (!VALID_TARGET_TYPES.includes(data.target_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `target_type must be one of: ${VALID_TARGET_TYPES.join(', ')}`
      });
    }

    // target_id is required unless target_type is 'all'
    if (data.target_type.toLowerCase() !== 'all' && !data.target_id) {
      return res.status(400).json({
        success: false,
        message: 'target_id required when target_type is not "all"'
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
      INSERT INTO dbo.tbl_discount_targets (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('DiscountTargets POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.discount_target_id) {
      return res.status(400).json({
        success: false,
        message: 'discount_target_id required'
      });
    }

    if (data.target_type && !VALID_TARGET_TYPES.includes(data.target_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `target_type must be one of: ${VALID_TARGET_TYPES.join(', ')}`
      });
    }

    // If updating target_type to non-'all', verify target_id is present
    if (data.target_type && data.target_type.toLowerCase() !== 'all' && !data.target_id) {
      return res.status(400).json({
        success: false,
        message: 'target_id required when target_type is not "all"'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'discount_target_id',
      FIELD_TYPES.discount_target_id.type,
      data.discount_target_id
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
      UPDATE dbo.tbl_discount_targets
      SET ${updates.join(', ')}
      WHERE discount_target_id = @discount_target_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Discount target not found' });
    }

    res.json({
      success: true,
      message: 'Discount target updated'
    });
  } catch (err) {
    console.error('DiscountTargets PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { discount_target_id, luu } = req.body;

    if (!discount_target_id) {
      return res.status(400).json({
        success: false,
        message: 'discount_target_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('discount_target_id', FIELD_TYPES.discount_target_id.type, discount_target_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_discount_targets
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE discount_target_id = @discount_target_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Discount target not found' });
    }

    res.json({
      success: true,
      message: 'Discount target deleted (soft)'
    });
  } catch (err) {
    console.error('DiscountTargets DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
