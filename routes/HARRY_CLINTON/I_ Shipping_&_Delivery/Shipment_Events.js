// routes/ShipmentEvents.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  shipment_event_id: { type: sql.VarChar, maxLength: 36 },
  shipment_id: { type: sql.VarChar, maxLength: 36 },

  event_status: { type: sql.VarChar, maxLength: 50 },
  event_location: { type: sql.VarChar, maxLength: 255 },
  event_description: { type: sql.VarChar, maxLength: 500 },
  event_timestamp: { type: sql.DateTime },
  event_source: { type: sql.VarChar, maxLength: 50 },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'shipment_id',
  'event_status',
  'event_location',
  'event_description',
  'event_timestamp',
  'event_source',
  'rcu'
];

const UPDATE_FIELDS = [
  'event_status',
  'event_location',
  'event_description',
  'event_timestamp',
  'event_source',
  'isactive',
  'isdeleted',
  'luu'
];

const VALID_EVENT_STATUSES = [
  'pickup_scheduled',
  'dispatched',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
  'exception'
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

  if (field === 'event_status') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_EVENT_STATUSES.includes(v) ? v : null;
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
      FROM dbo.tbl_shipment_events
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY event_timestamp DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('ShipmentEvents GET error:', err);
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
        .json({ success: false, message: 'shipment_event_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('shipment_event_id', FIELD_TYPES.shipment_event_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_shipment_events
      WHERE shipment_event_id = @shipment_event_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Shipment event not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('ShipmentEvents GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.shipment_id || !data.event_status) {
      return res.status(400).json({
        success: false,
        message: 'shipment_id, event_status required'
      });
    }

    if (!VALID_EVENT_STATUSES.includes(data.event_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `event_status must be one of: ${VALID_EVENT_STATUSES.join(', ')}`
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
      INSERT INTO dbo.tbl_shipment_events (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('ShipmentEvents POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.shipment_event_id) {
      return res.status(400).json({
        success: false,
        message: 'shipment_event_id required'
      });
    }

    if (data.event_status && !VALID_EVENT_STATUSES.includes(data.event_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `event_status must be one of: ${VALID_EVENT_STATUSES.join(', ')}`
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'shipment_event_id',
      FIELD_TYPES.shipment_event_id.type,
      data.shipment_event_id
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
      UPDATE dbo.tbl_shipment_events
      SET ${updates.join(', ')}
      WHERE shipment_event_id = @shipment_event_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Shipment event not found' });
    }

    res.json({
      success: true,
      message: 'Shipment event updated'
    });
  } catch (err) {
    console.error('ShipmentEvents PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { shipment_event_id, luu } = req.body;

    if (!shipment_event_id) {
      return res.status(400).json({
        success: false,
        message: 'shipment_event_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('shipment_event_id', FIELD_TYPES.shipment_event_id.type, shipment_event_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_shipment_events
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE shipment_event_id = @shipment_event_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Shipment event not found' });
    }

    res.json({
      success: true,
      message: 'Shipment event deleted (soft)'
    });
  } catch (err) {
    console.error('ShipmentEvents DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
