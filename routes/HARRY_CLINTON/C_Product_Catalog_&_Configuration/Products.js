// routes/catalog/Products.js - BASIC CRUD (5 endpoints) - FIXED STANDARD
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const IST_NOW = 'DATEADD(MINUTE, 330, GETUTCDATE())';

const FIELD_TYPES = {
  product_id: { type: sql.VarChar, maxLength: 36 },
  product_name: { type: sql.VarChar, maxLength: 255 },
  product_slug: { type: sql.VarChar, maxLength: 255 },
  short_description: { type: sql.VarChar, maxLength: 500 },
  description: { type: sql.VarChar, maxLength: sql.MAX }, // ✅ varchar(max)
  base_price: { type: sql.Decimal(18, 2) }, // ✅ simpler decimal binding
  currency_code: { type: sql.VarChar, maxLength: 10 },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'product_name',
  'product_slug',
  'short_description',
  'description',
  'base_price',
  'currency_code',
  'rcu'
];

const UPDATE_FIELDS = [
  'product_name',
  'product_slug',
  'short_description',
  'description',
  'base_price',
  'currency_code',
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

  // decimal(18,2)
  if (t?.name === 'Decimal') {
    const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
    return Number.isFinite(n) ? n : null;
  }

  return typeof value === 'string' ? value.trim() : value;
};

const bindInput = (request, field, value) => {
  const meta = FIELD_TYPES[field];
  if (!meta) return;

  if (meta.maxLength === sql.MAX) return request.input(field, meta.type(sql.MAX), value);
  if (meta.maxLength) return request.input(field, meta.type(meta.maxLength), value);

  // handles sql.Decimal(18,2) too
  return request.input(field, meta.type, value);
};

// 1) GET ALL (filters + optional pagination)
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '50', 10), 1), 200);
    const offset = (page - 1) * pageSize;

    const where = [];
    if (!includeDeleted) where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const query = `
      SELECT *
      FROM dbo.tbl_products
      ${whereSql}
      ORDER BY product_name ASC
      OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY;

      SELECT COUNT(1) AS total
      FROM dbo.tbl_products
      ${whereSql};
    `;

    const result = await pool.request().query(query);

    const rows = result.recordsets?.[0] || [];
    const total = result.recordsets?.[1]?.[0]?.total ?? rows.length;

    res.json({ success: true, data: rows, pagination: { page, pageSize, total } });
  } catch (err) {
    console.error('Products get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 2) GET BY ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'product_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request();
    bindInput(request, 'product_id', id);

    const query = includeDeleted
      ? `SELECT * FROM dbo.tbl_products WHERE product_id = @product_id;`
      : `SELECT * FROM dbo.tbl_products WHERE product_id = @product_id AND isdeleted = 0;`;

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Products get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 3) POST (CREATE) - ✅ inserts defaults too
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    if (!data.product_name || !data.product_slug) {
      return res.status(400).json({
        success: false,
        message: 'product_name and product_slug are required'
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

    // ✅ enforce defaults at insert level (even if DB already has defaults)
    cols.push('isactive', 'isdeleted', 'rcm');
    vals.push('1', '0', IST_NOW);

    if (cols.length === 3) return res.status(400).json({ success: false, message: 'No valid fields' });

    await poolConnect;

    const result = await request.query(
      `INSERT INTO dbo.tbl_products (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({
        success: false,
        message: 'product_slug must be unique',
        error: err.message
      });
    }

    console.error('Products post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 4) PUT (UPDATE) - ✅ block updates on deleted rows
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.product_id) {
      return res.status(400).json({ success: false, message: 'product_id required' });
    }

    const updates = [];
    const request = pool.request();
    bindInput(request, 'product_id', data.product_id);

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
      `UPDATE dbo.tbl_products
       SET ${updates.join(', ')}
       WHERE product_id = @product_id AND isdeleted = 0;  -- ✅
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Product not found (or deleted)' });
    }

    res.json({ success: true, message: 'Product updated' });
  } catch (err) {
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({
        success: false,
        message: 'product_slug must be unique',
        error: err.message
      });
    }

    console.error('Products put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 5) DELETE (SOFT DELETE) - ✅ also sets isactive = 0
router.delete('/', async (req, res) => {
  try {
    const { product_id, luu } = req.body;
    if (!product_id) {
      return res.status(400).json({ success: false, message: 'product_id required' });
    }

    await poolConnect;

    const request = pool.request();
    bindInput(request, 'product_id', product_id);

    if (luu != null) bindInput(request, 'luu', prepareInputValue('luu', luu));

    const query =
      luu != null
        ? `UPDATE dbo.tbl_products
           SET isdeleted = 1,
               isactive = 0,              -- ✅
               luu = @luu,
               lcm = ${IST_NOW}
           WHERE product_id = @product_id AND isdeleted = 0;
           SELECT @@ROWCOUNT AS affected;`
        : `UPDATE dbo.tbl_products
           SET isdeleted = 1,
               isactive = 0,              -- ✅
               lcm = ${IST_NOW}
           WHERE product_id = @product_id AND isdeleted = 0;
           SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Product not found (or already deleted)' });
    }

    res.json({ success: true, message: 'Product deleted (soft)' });
  } catch (err) {
    console.error('Products delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
