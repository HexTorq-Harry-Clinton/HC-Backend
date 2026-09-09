// routes/catalog/Attributes.js - BASIC CRUD (5 endpoints) - FIXED STANDARD
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const IST_NOW = 'DATEADD(MINUTE, 330, GETUTCDATE())';

const FIELD_TYPES = {
  attribute_id: { type: sql.VarChar, maxLength: 36 },

  attribute_name: { type: sql.VarChar, maxLength: 255 },
  attribute_slug: { type: sql.VarChar, maxLength: 255 },
  attribute_type: { type: sql.VarChar, maxLength: 50 }, // text/dropdown/number

  display_order: { type: sql.Int },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'attribute_name',
  'attribute_slug',
  'attribute_type',
  'display_order',
  'rcu'
];

const UPDATE_FIELDS = [
  'attribute_name',
  'attribute_slug',
  'attribute_type',
  'display_order',
  'isactive',
  'luu'
];

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

    const query = `
      SELECT *
      FROM dbo.tbl_attributes
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY display_order ASC, attribute_name ASC;
    `;

    const result = await pool.request().query(query);

    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('Attributes get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 2) GET BY ID
//////////////////////////////////////////////////////////
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'attribute_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request();
    bindInput(request, 'attribute_id', id);

    const query = includeDeleted
      ? `SELECT * FROM dbo.tbl_attributes WHERE attribute_id = @attribute_id;`
      : `SELECT * FROM dbo.tbl_attributes WHERE attribute_id = @attribute_id AND isdeleted = 0;`;

    const result = await request.query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Attribute not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Attributes get by id error:', err);
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

    if (!data.attribute_name || !data.attribute_slug || !data.attribute_type) {
      return res.status(400).json({
        success: false,
        message: 'attribute_name, attribute_slug, attribute_type are required'
      });
    }

    // Optional: restrict attribute_type values (text/dropdown/number)
    const allowedTypes = ['text', 'dropdown', 'number'];
    const incomingType = String(data.attribute_type).trim().toLowerCase();
    if (!allowedTypes.includes(incomingType)) {
      return res.status(400).json({
        success: false,
        message: `attribute_type must be one of: ${allowedTypes.join(', ')}`
      });
    }

    const cols = [];
    const vals = [];
    const request = pool.request();

    INSERT_FIELDS.forEach((f) => {
      if (data[f] != null) {
        let v = prepareInputValue(f, data[f]);
        if (v !== null) {
          // normalize attribute_type to lowercase
          if (f === 'attribute_type') v = String(v).trim().toLowerCase();
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
      `INSERT INTO dbo.tbl_attributes (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    // Unique slug error (ux_tbl_attributes_slug)
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({ success: false, message: 'attribute_slug must be unique' });
    }

    console.error('Attributes post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 4) PUT (UPDATE) - block updates on deleted rows
//////////////////////////////////////////////////////////
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data || !data.attribute_id) {
      return res.status(400).json({ success: false, message: 'attribute_id required' });
    }

    const updates = [];
    const request = pool.request();
    bindInput(request, 'attribute_id', data.attribute_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        let v = prepareInputValue(f, data[f]);
        if (v !== null) {
          // normalize attribute_type to lowercase
          if (f === 'attribute_type') v = String(v).trim().toLowerCase();
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
      `UPDATE dbo.tbl_attributes
       SET ${updates.join(', ')}
       WHERE attribute_id = @attribute_id AND isdeleted = 0;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Attribute not found (or deleted)' });
    }

    res.json({ success: true, message: 'Attribute updated' });
  } catch (err) {
    // Unique slug error (ux_tbl_attributes_slug)
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({ success: false, message: 'attribute_slug must be unique' });
    }

    console.error('Attributes put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 5) DELETE (SOFT DELETE) - sets isactive = 0 too
//////////////////////////////////////////////////////////
router.delete('/', async (req, res) => {
  try {
    const { attribute_id, luu } = req.body;

    if (!attribute_id) {
      return res.status(400).json({ success: false, message: 'attribute_id required' });
    }

    await poolConnect;

    const request = pool.request();
    bindInput(request, 'attribute_id', attribute_id);

    if (luu != null) bindInput(request, 'luu', prepareInputValue('luu', luu));

    const query =
      luu != null
        ? `UPDATE dbo.tbl_attributes
           SET isdeleted = 1,
               isactive = 0,
               luu = @luu,
               lcm = ${IST_NOW}
           WHERE attribute_id = @attribute_id AND isdeleted = 0;
           SELECT @@ROWCOUNT AS affected;`
        : `UPDATE dbo.tbl_attributes
           SET isdeleted = 1,
               isactive = 0,
               lcm = ${IST_NOW}
           WHERE attribute_id = @attribute_id AND isdeleted = 0;
           SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Attribute not found (or already deleted)' });
    }

    res.json({ success: true, message: 'Attribute deleted (soft)' });
  } catch (err) {
    console.error('Attributes delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
