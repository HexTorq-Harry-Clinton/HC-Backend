// routes/catalog/ProductSEO.js - BASIC CRUD (5 endpoints) - FIXED STANDARD
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const IST_NOW = 'DATEADD(MINUTE, 330, GETUTCDATE())';

const FIELD_TYPES = {
  product_seo_id: { type: sql.VarChar, maxLength: 36 },
  product_id: { type: sql.VarChar, maxLength: 36 },

  seo_title: { type: sql.VarChar, maxLength: 255 },
  seo_description: { type: sql.VarChar, maxLength: 500 },
  seo_keywords: { type: sql.VarChar, maxLength: 500 },
  og_image_url: { type: sql.VarChar, maxLength: 1000 },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'product_id',
  'seo_title',
  'seo_description',
  'seo_keywords',
  'og_image_url',
  'rcu'
];

const UPDATE_FIELDS = [
  'seo_title',
  'seo_description',
  'seo_keywords',
  'og_image_url',
  'isactive',
  'luu'
];

const prepareInputValue = (field, value) => {
  if (value === null || value === undefined || value === '') return null;

  if (FIELD_TYPES[field]?.type === sql.Bit) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return value ? 1 : 0;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (['1','true','yes','y'].includes(v)) return 1;
      if (['0','false','no','n'].includes(v)) return 0;
    }
    return null;
  }

  return typeof value === 'string' ? value.trim() : value;
};

const bindInput = (request, field, value) => {
  const meta = FIELD_TYPES[field];
  if (!meta) return;
  return request.input(field, meta.type(meta.maxLength), value);
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
      FROM dbo.tbl_product_seo
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY product_id ASC;
    `;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('ProductSEO get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 2) GET BY ID
//////////////////////////////////////////////////////////
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'product_seo_id required' });

    await poolConnect;

    const request = pool.request();
    bindInput(request, 'product_seo_id', id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_product_seo
      WHERE product_seo_id = @product_seo_id AND isdeleted = 0;
    `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Product SEO not found' });
    }

    res.json({ success: true, data: result.recordset[0] });

  } catch (err) {
    console.error('ProductSEO get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 3) POST
//////////////////////////////////////////////////////////
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.product_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id is required'
      });
    }

    const cols = [];
    const vals = [];
    const request = pool.request();

    INSERT_FIELDS.forEach(f => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          cols.push(f);
          vals.push('@' + f);
          bindInput(request, f, v);
        }
      }
    });

    // defaults
    cols.push('isactive', 'isdeleted', 'rcm');
    vals.push('1', '0', IST_NOW);

    await poolConnect;

    const result = await request.query(`
      INSERT INTO dbo.tbl_product_seo (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({ success: true, data: result.recordset[0] });

  } catch (err) {
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({
        success: false,
        message: 'SEO already exists for this product (product_id must be unique)'
      });
    }

    console.error('ProductSEO post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 4) PUT
//////////////////////////////////////////////////////////
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.product_seo_id) {
      return res.status(400).json({ success: false, message: 'product_seo_id required' });
    }

    const updates = [];
    const request = pool.request();
    bindInput(request, 'product_seo_id', data.product_seo_id);

    UPDATE_FIELDS.forEach(f => {
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

    const result = await request.query(`
      UPDATE dbo.tbl_product_seo
      SET ${updates.join(', ')}
      WHERE product_seo_id = @product_seo_id AND isdeleted = 0;
      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Product SEO not found (or deleted)' });
    }

    res.json({ success: true, message: 'Product SEO updated' });

  } catch (err) {
    console.error('ProductSEO put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

//////////////////////////////////////////////////////////
// 5) DELETE (SOFT)
//////////////////////////////////////////////////////////
router.delete('/', async (req, res) => {
  try {
    const { product_seo_id, luu } = req.body;

    if (!product_seo_id) {
      return res.status(400).json({ success: false, message: 'product_seo_id required' });
    }

    await poolConnect;

    const request = pool.request();
    bindInput(request, 'product_seo_id', product_seo_id);

    if (luu != null) bindInput(request, 'luu', luu);

    const result = await request.query(`
      UPDATE dbo.tbl_product_seo
      SET isdeleted = 1,
          isactive = 0,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW}
      WHERE product_seo_id = @product_seo_id AND isdeleted = 0;
      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Product SEO not found (or already deleted)' });
    }

    res.json({ success: true, message: 'Product SEO deleted (soft)' });

  } catch (err) {
    console.error('ProductSEO delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
