const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const IST_NOW = 'DATEADD(MINUTE, 330, GETUTCDATE())';

const FIELD_TYPES = {
  product_variant_id: { type: sql.VarChar, maxLength: 36 },
  product_id: { type: sql.VarChar, maxLength: 36 },
  sku: { type: sql.VarChar, maxLength: 100 },
  variant_name: { type: sql.VarChar, maxLength: 255 },
  price: { type: sql.Decimal(18, 2) },
  stock_qty: { type: sql.Int },
  size_id: { type: sql.VarChar, maxLength: 36 },
  cloth_type_id: { type: sql.VarChar, maxLength: 36 },
  isdefault: { type: sql.Bit },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'product_id',
  'sku',
  'variant_name',
  'price',
  'stock_qty',
  'size_id',
  'cloth_type_id',
  'isdefault',
  'rcu'
];

const UPDATE_FIELDS = [
  'sku',
  'variant_name',
  'price',
  'stock_qty',
  'size_id',
  'cloth_type_id',
  'isdefault',
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

  if (t?.name === 'Decimal') {
    const n = typeof value === 'number' ? value : parseFloat(String(value).trim());
    return Number.isFinite(n) ? n : null;
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

    const includeDeleted = req.query.includeDeleted === 'true';
    const includeInactive = req.query.includeInactive === 'true';

    const where = [];
    if (!includeDeleted) where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');

    const query = `
      SELECT *
      FROM dbo.tbl_product_variants
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
    console.error('ProductVariants GET error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

//////////////////////////////////////////////////////////
// 2) GET BY ID
//////////////////////////////////////////////////////////
router.get('/:id', async (req, res) => {
  try {
    await poolConnect;

    const request = pool.request();
    bindInput(request, 'product_variant_id', req.params.id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_product_variants
      WHERE product_variant_id = @product_variant_id
        AND isdeleted = 0;
    `);

    if (!result.recordset.length) {
      return res.status(404).json({ success: false, message: 'Variant not found' });
    }

    res.json({ success: true, data: result.recordset[0] });

  } catch (err) {
    console.error('ProductVariants GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

//////////////////////////////////////////////////////////
// 3) POST (CREATE)
//////////////////////////////////////////////////////////
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.product_id || !data.sku) {
      return res.status(400).json({
        success: false,
        message: 'product_id and sku are required'
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

    // enforce defaults
    cols.push('isactive', 'isdeleted', 'rcm');
    vals.push('1', '0', IST_NOW);

    await poolConnect;

    const result = await request.query(`
      INSERT INTO dbo.tbl_product_variants (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({ success: true, data: result.recordset[0] });

  } catch (err) {
    if (err?.number === 2627 || err?.number === 2601) {
      return res.status(409).json({
        success: false,
        message: 'SKU must be unique'
      });
    }

    console.error('ProductVariants POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

//////////////////////////////////////////////////////////
// 4) PUT (UPDATE)
//////////////////////////////////////////////////////////
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.product_variant_id) {
      return res.status(400).json({
        success: false,
        message: 'product_variant_id required'
      });
    }

    const updates = [];
    const request = pool.request();
    bindInput(request, 'product_variant_id', data.product_variant_id);

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

    await poolConnect;

    const result = await request.query(`
      UPDATE dbo.tbl_product_variants
      SET ${updates.join(', ')}
      WHERE product_variant_id = @product_variant_id
        AND isdeleted = 0;
      SELECT @@ROWCOUNT AS affected;
    `);

    if (!result.recordset[0].affected) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found or deleted'
      });
    }

    res.json({ success: true, message: 'Variant updated' });

  } catch (err) {
    console.error('ProductVariants PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

//////////////////////////////////////////////////////////
// 5) DELETE (SOFT DELETE)
//////////////////////////////////////////////////////////
router.delete('/', async (req, res) => {
  try {
    const { product_variant_id, luu } = req.body;

    if (!product_variant_id) {
      return res.status(400).json({
        success: false,
        message: 'product_variant_id required'
      });
    }

    await poolConnect;

    const request = pool.request();
    bindInput(request, 'product_variant_id', product_variant_id);

    if (luu) bindInput(request, 'luu', luu);

    const result = await request.query(`
      UPDATE dbo.tbl_product_variants
      SET isdeleted = 1,
          isactive = 0,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW}
      WHERE product_variant_id = @product_variant_id
        AND isdeleted = 0;
      SELECT @@ROWCOUNT AS affected;
    `);

    if (!result.recordset[0].affected) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found or already deleted'
      });
    }

    res.json({ success: true, message: 'Variant deleted (soft)' });

  } catch (err) {
    console.error('ProductVariants DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
