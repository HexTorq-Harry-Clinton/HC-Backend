// routes/catalog/Sizes.js - BASIC CRUD (5 endpoints) - FIXED STANDARD
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const IST_NOW = 'DATEADD(MINUTE, 330, GETUTCDATE())';

const FIELD_TYPES = {
  size_id: { type: sql.VarChar, maxLength: 36 },

  size_name: { type: sql.VarChar, maxLength: 50 },   // s/m/l/xl or 28/30/32
  size_type: { type: sql.VarChar, maxLength: 20 },   // alpha / numeric

  display_order: { type: sql.Int },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = ['size_name', 'size_type', 'display_order', 'rcu'];
const UPDATE_FIELDS = ['size_name', 'size_type', 'display_order', 'isactive', 'luu'];

const prepareInputValue = (field, value) => {
  if (value === null || value === undefined || value === '') return null;

  const t = FIELD_TYPES[field]?.type;

  if (t === sql.Int) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }

  if (t === sql.Bit) {
    if (typeof value === 'boolean') return value ? 1 : 0;
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

const bindInput = (request, field, value) => {
  const meta = FIELD_TYPES[field];
  if (!meta) return;
  if (meta.maxLength) return request.input(field, meta.type(meta.maxLength), value);
  return request.input(field, meta.type, value);
};

//////////////////////////////////////////////////////////
// 1) GET ALL
//////////////////////////////////////////////////////////
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    const where = [];
    if (!includeDeleted) where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');

    // Optional filter by size_type (alpha/numeric)
    const request = pool.request();
    if (req.query.size_type) {
      where.push('size_type = @size_type');
      bindInput(request, 'size_type', String(req.query.size_type).trim().toLowerCase());
    }

    const query = `
      SELECT *
      FROM dbo.tbl_sizes
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY size_type ASC, display_order ASC, size_name ASC;
    `;

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('Sizes get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 2) GET BY ID
//////////////////////////////////////////////////////////
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'size_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request();
    bindInput(request, 'size_id', id);

    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_sizes WHERE size_id = @size_id;'
      : 'SELECT * FROM dbo.tbl_sizes WHERE size_id = @size_id AND isdeleted = 0;';

    const result = await request.query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Size not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Sizes get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 3) POST (CREATE) - inserts defaults
//////////////////////////////////////////////////////////
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    if (!data.size_name || !data.size_type) {
      return res.status(400).json({
        success: false,
        message: 'size_name and size_type are required'
      });
    }

    const allowedTypes = ['alpha', 'numeric'];
    const normalizedType = String(data.size_type).trim().toLowerCase();
    if (!allowedTypes.includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: `size_type must be one of: ${allowedTypes.join(', ')}`
      });
    }

    const cols = [];
    const vals = [];
    const request = pool.request();

    INSERT_FIELDS.forEach((f) => {
      if (data[f] != null) {
        let v = prepareInputValue(f, data[f]);
        if (v !== null) {
          if (f === 'size_type') v = String(v).trim().toLowerCase();
          if (f === 'size_name') v = String(v).trim();
          cols.push(f);
          vals.push('@' + f);
          bindInput(request, f, v);
        }
      }
    });

    // ✅ enforce defaults
    cols.push('isactive', 'isdeleted', 'rcm');
    vals.push('1', '0', IST_NOW);

    await poolConnect;

    const result = await request.query(
      `INSERT INTO dbo.tbl_sizes (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    // Unique (size_name, size_type)
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate size: (size_name, size_type) must be unique'
      });
    }

    console.error('Sizes post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 4) PUT (UPDATE) - block updates on deleted rows
//////////////////////////////////////////////////////////
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data || !data.size_id) {
      return res.status(400).json({ success: false, message: 'size_id required' });
    }

    // Optional: validate size_type if present
    if (data.size_type != null) {
      const allowedTypes = ['alpha', 'numeric'];
      const normalizedType = String(data.size_type).trim().toLowerCase();
      if (!allowedTypes.includes(normalizedType)) {
        return res.status(400).json({
          success: false,
          message: `size_type must be one of: ${allowedTypes.join(', ')}`
        });
      }
    }

    const updates = [];
    const request = pool.request();
    bindInput(request, 'size_id', data.size_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        let v = prepareInputValue(f, data[f]);
        if (v !== null) {
          if (f === 'size_type') v = String(v).trim().toLowerCase();
          if (f === 'size_name') v = String(v).trim();
          updates.push(`${f} = @${f}`);
          bindInput(request, f, v);
        }
      }
    });

    updates.push(`lcm = ${IST_NOW}`);

    if (updates.length === 1) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_sizes
       SET ${updates.join(', ')}
       WHERE size_id = @size_id AND isdeleted = 0;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Size not found (or deleted)' });
    }

    res.json({ success: true, message: 'Size updated' });
  } catch (err) {
    // Unique (size_name, size_type)
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate size: (size_name, size_type) must be unique'
      });
    }

    console.error('Sizes put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 5) DELETE (SOFT DELETE) - sets isactive = 0 too
//////////////////////////////////////////////////////////
router.delete('/', async (req, res) => {
  try {
    const { size_id, luu } = req.body;

    if (!size_id) {
      return res.status(400).json({ success: false, message: 'size_id required' });
    }

    await poolConnect;

    const request = pool.request();
    bindInput(request, 'size_id', size_id);

    if (luu != null) bindInput(request, 'luu', prepareInputValue('luu', luu));

    const query =
      luu != null
        ? `UPDATE dbo.tbl_sizes
           SET isdeleted = 1,
               isactive = 0,
               luu = @luu,
               lcm = ${IST_NOW}
           WHERE size_id = @size_id AND isdeleted = 0;
           SELECT @@ROWCOUNT AS affected;`
        : `UPDATE dbo.tbl_sizes
           SET isdeleted = 1,
               isactive = 0,
               lcm = ${IST_NOW}
           WHERE size_id = @size_id AND isdeleted = 0;
           SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Size not found (or already deleted)' });
    }

    res.json({ success: true, message: 'Size deleted (soft)' });
  } catch (err) {
    console.error('Sizes delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
