// routes/Shipments.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  shipment_id: { type: sql.VarChar, maxLength: 36 },
  order_id: { type: sql.VarChar, maxLength: 36 },
  courier_partner_id: { type: sql.VarChar, maxLength: 36 },

  tracking_number: { type: sql.VarChar, maxLength: 100 },
  awb_number: { type: sql.VarChar, maxLength: 100 },

  shipment_status: { type: sql.VarChar, maxLength: 50 },
  weight: { type: sql.Decimal },
  dimensions: { type: sql.VarChar, maxLength: 100 },
  shipped_date: { type: sql.DateTime },
  estimated_delivery: { type: sql.DateTime },
  actual_delivery_date: { type: sql.DateTime },
  pickup_address_id: { type: sql.VarChar, maxLength: 36 },
  drop_address_id: { type: sql.VarChar, maxLength: 36 },
  shipping_cost: { type: sql.Decimal },

  notes: { type: sql.VarChar, maxLength: 500 },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'order_id',
  'courier_partner_id',
  'tracking_number',
  'awb_number',
  'shipment_status',
  'weight',
  'dimensions',
  'shipped_date',
  'estimated_delivery',
  'actual_delivery_date',
  'pickup_address_id',
  'drop_address_id',
  'shipping_cost',
  'notes',
  'rcu'
];

const UPDATE_FIELDS = [
  'courier_partner_id',
  'tracking_number',
  'awb_number',
  'shipment_status',
  'weight',
  'dimensions',
  'shipped_date',
  'estimated_delivery',
  'actual_delivery_date',
  'pickup_address_id',
  'drop_address_id',
  'shipping_cost',
  'notes',
  'isactive',
  'isdeleted',
  'luu'
];

const VALID_SHIPMENT_STATUSES = ['created', 'shipped', 'in_transit', 'delivered', 'cancelled'];

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

  if (field === 'shipment_status') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_SHIPMENT_STATUSES.includes(v) ? v : null;
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
      FROM dbo.tbl_shipments
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
    console.error('Shipments GET error:', err);
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
        .json({ success: false, message: 'shipment_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('shipment_id', FIELD_TYPES.shipment_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_shipments
      WHERE shipment_id = @shipment_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Shipment not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Shipments GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id required'
      });
    }

    if (data.shipment_status && !VALID_SHIPMENT_STATUSES.includes(data.shipment_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `shipment_status must be one of: ${VALID_SHIPMENT_STATUSES.join(', ')}`
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
      INSERT INTO dbo.tbl_shipments (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('Shipments POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.shipment_id) {
      return res.status(400).json({
        success: false,
        message: 'shipment_id required'
      });
    }

    if (data.shipment_status && !VALID_SHIPMENT_STATUSES.includes(data.shipment_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `shipment_status must be one of: ${VALID_SHIPMENT_STATUSES.join(', ')}`
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'shipment_id',
      FIELD_TYPES.shipment_id.type,
      data.shipment_id
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
      UPDATE dbo.tbl_shipments
      SET ${updates.join(', ')}
      WHERE shipment_id = @shipment_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Shipment not found' });
    }

    res.json({
      success: true,
      message: 'Shipment updated'
    });
  } catch (err) {
    console.error('Shipments PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { shipment_id, luu } = req.body;

    if (!shipment_id) {
      return res.status(400).json({
        success: false,
        message: 'shipment_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('shipment_id', FIELD_TYPES.shipment_id.type, shipment_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_shipments
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE shipment_id = @shipment_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Shipment not found' });
    }

    res.json({
      success: true,
      message: 'Shipment deleted (soft)'
    });
  } catch (err) {
    console.error('Shipments DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
