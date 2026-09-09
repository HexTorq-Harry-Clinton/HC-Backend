// routes/catalog/ProductMedia.js - BASIC CRUD (5 endpoints) - FIXED STANDARD
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const IST_NOW = 'DATEADD(MINUTE, 330, GETUTCDATE())';

const FIELD_TYPES = {
  product_media_id: { type: sql.VarChar, maxLength: 36 },

  product_id: { type: sql.VarChar, maxLength: 36 },
  product_variant_id: { type: sql.VarChar, maxLength: 36 },

  media_type: { type: sql.VarChar, maxLength: 20 },     // image / video
  media_url: { type: sql.VarChar, maxLength: 1000 },
  alt_text: { type: sql.VarChar, maxLength: 255 },

  display_order: { type: sql.Int },
  isprimary: { type: sql.Bit },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'product_id',
  'product_variant_id',
  'media_type',
  'media_url',
  'alt_text',
  'display_order',
  'isprimary',
  'rcu'
];

const UPDATE_FIELDS = [
  'product_id',
  'product_variant_id',
  'media_type',
  'media_url',
  'alt_text',
  'display_order',
  'isprimary',
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

    // Optional filters
    if (req.query.product_id) where.push('product_id = @product_id');
    if (req.query.product_variant_id) where.push('product_variant_id = @product_variant_id');
    if (req.query.isprimary === '1' || req.query.isprimary === 'true') where.push('isprimary = 1');

    const request = pool.request();
    if (req.query.product_id) bindInput(request, 'product_id', req.query.product_id);
    if (req.query.product_variant_id) bindInput(request, 'product_variant_id', req.query.product_variant_id);

    const query = `
      SELECT *
      FROM dbo.tbl_product_media
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY product_id ASC, display_order ASC, rcm DESC;
    `;

    const result = await request.query(query);

    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('ProductMedia get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 2) GET BY ID
//////////////////////////////////////////////////////////
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'product_media_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request();
    bindInput(request, 'product_media_id', id);

    const query = includeDeleted
      ? `SELECT * FROM dbo.tbl_product_media WHERE product_media_id = @product_media_id;`
      : `SELECT * FROM dbo.tbl_product_media WHERE product_media_id = @product_media_id AND isdeleted = 0;`;

    const result = await request.query(query);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Product media not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('ProductMedia get by id error:', err);
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

    if (!data.product_id || !data.media_type || !data.media_url) {
      return res.status(400).json({
        success: false,
        message: 'product_id, media_type, and media_url are required'
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
          bindInput(request, f, v);
        }
      }
    });

    // ✅ enforce defaults
    cols.push('isactive', 'isdeleted', 'rcm');
    vals.push('1', '0', IST_NOW);

    await poolConnect;

    const result = await request.query(
      `INSERT INTO dbo.tbl_product_media (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('ProductMedia post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 4) PUT (UPDATE) - block updates on deleted rows
//////////////////////////////////////////////////////////
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data || !data.product_media_id) {
      return res.status(400).json({ success: false, message: 'product_media_id required' });
    }

    const updates = [];
    const request = pool.request();

    bindInput(request, 'product_media_id', data.product_media_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
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
      `UPDATE dbo.tbl_product_media
       SET ${updates.join(', ')}
       WHERE product_media_id = @product_media_id AND isdeleted = 0;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Product media not found (or deleted)' });
    }

    res.json({ success: true, message: 'Product media updated' });
  } catch (err) {
    console.error('ProductMedia put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 5) DELETE (SOFT DELETE) - sets isactive = 0 too
//////////////////////////////////////////////////////////
router.delete('/', async (req, res) => {
  try {
    const { product_media_id, luu } = req.body;

    if (!product_media_id) {
      return res.status(400).json({ success: false, message: 'product_media_id required' });
    }

    await poolConnect;

    const request = pool.request();
    bindInput(request, 'product_media_id', product_media_id);

    if (luu != null) bindInput(request, 'luu', prepareInputValue('luu', luu));

    const query =
      luu != null
        ? `UPDATE dbo.tbl_product_media
           SET isdeleted = 1,
               isactive = 0,
               luu = @luu,
               lcm = ${IST_NOW}
           WHERE product_media_id = @product_media_id AND isdeleted = 0;
           SELECT @@ROWCOUNT AS affected;`
        : `UPDATE dbo.tbl_product_media
           SET isdeleted = 1,
               isactive = 0,
               lcm = ${IST_NOW}
           WHERE product_media_id = @product_media_id AND isdeleted = 0;
           SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Product media not found (or already deleted)' });
    }

    res.json({ success: true, message: 'Product media deleted (soft)' });
  } catch (err) {
    console.error('ProductMedia delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
