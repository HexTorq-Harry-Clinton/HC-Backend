// routes/OrderItems.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  order_item_id: { type: sql.VarChar, maxLength: 36 },
  order_id: { type: sql.VarChar, maxLength: 36 },

  product_id: { type: sql.VarChar, maxLength: 36 },
  product_variant_id: { type: sql.VarChar, maxLength: 36 },

  product_name: { type: sql.VarChar, maxLength: 255 },
  sku: { type: sql.VarChar, maxLength: 100 },

  qty: { type: sql.Int },
  unit_price: { type: sql.Decimal, precision: 18, scale: 2 },
  total_price: { type: sql.Decimal, precision: 18, scale: 2 },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'order_id',
  'product_id',
  'product_variant_id',
  'product_name',
  'sku',
  'qty',
  'unit_price',
  'total_price',
  'rcu'
];

const UPDATE_FIELDS = [
  'product_id',
  'product_variant_id',
  'product_name',
  'sku',
  'qty',
  'unit_price',
  'total_price',
  'isactive',
  'isdeleted',
  'luu'
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

  if (field === 'qty') {
    const num = parseInt(value, 10);
    return num > 0 ? num : null;
  }

  if (field === 'unit_price' || field === 'total_price') {
    const num = parseFloat(value);
    return !isNaN(num) ? num : null;
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
      FROM dbo.tbl_order_items
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
    console.error('Order Items GET error:', err);
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
        .json({ success: false, message: 'order_item_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('order_item_id', FIELD_TYPES.order_item_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_order_items
      WHERE order_item_id = @order_item_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Order item not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Order Items GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_id || !data.product_id || !data.product_name) {
      return res.status(400).json({
        success: false,
        message: 'order_id, product_id, product_name required'
      });
    }

    if (data.qty && parseInt(data.qty, 10) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'qty must be greater than 0'
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
      INSERT INTO dbo.tbl_order_items (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('Order Items POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_item_id) {
      return res.status(400).json({
        success: false,
        message: 'order_item_id required'
      });
    }

    if (data.qty && parseInt(data.qty, 10) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'qty must be greater than 0'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'order_item_id',
      FIELD_TYPES.order_item_id.type,
      data.order_item_id
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
      UPDATE dbo.tbl_order_items
      SET ${updates.join(', ')}
      WHERE order_item_id = @order_item_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Order item not found' });
    }

    res.json({
      success: true,
      message: 'Order item updated'
    });
  } catch (err) {
    console.error('Order Items PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { order_item_id, luu } = req.body;

    if (!order_item_id) {
      return res.status(400).json({
        success: false,
        message: 'order_item_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('order_item_id', FIELD_TYPES.order_item_id.type, order_item_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_order_items
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE order_item_id = @order_item_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Order item not found' });
    }

    res.json({
      success: true,
      message: 'Order item deleted (soft)'
    });
  } catch (err) {
    console.error('Order Items DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
