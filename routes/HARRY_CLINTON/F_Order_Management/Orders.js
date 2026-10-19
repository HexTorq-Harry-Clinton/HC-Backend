// routes/Orders.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  order_id: { type: sql.VarChar, maxLength: 36 },
  user_id: { type: sql.VarChar, maxLength: 36 },
  cart_id: { type: sql.VarChar, maxLength: 36 },

  order_number: { type: sql.VarChar, maxLength: 50 },

  order_status_id: { type: sql.VarChar, maxLength: 36 },
  orderstatus: { type: sql.VarChar, maxLength: 50 },

  subtotal: { type: sql.Decimal, precision: 18, scale: 2 },
  discount_amount: { type: sql.Decimal, precision: 18, scale: 2 },
  shipping_amount: { type: sql.Decimal, precision: 18, scale: 2 },
  tax_amount: { type: sql.Decimal, precision: 18, scale: 2 },
  total_amount: { type: sql.Decimal, precision: 18, scale: 2 },

  payment_status: { type: sql.VarChar, maxLength: 50 },
  notes: { type: sql.VarChar, maxLength: 500 },

  placed_at: { type: sql.DateTime },
  cancelled_at: { type: sql.DateTime },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'user_id',
  'cart_id',
  'order_number',
  'order_status_id',
  'orderstatus',
  'subtotal',
  'discount_amount',
  'shipping_amount',
  'tax_amount',
  'total_amount',
  'payment_status',
  'notes',
  'rcu'
];

const UPDATE_FIELDS = [
  'order_status_id',
  'orderstatus',
  'subtotal',
  'discount_amount',
  'shipping_amount',
  'tax_amount',
  'total_amount',
  'payment_status',
  'notes',
  'cancelled_at',
  'isactive',
  'isdeleted',
  'luu'
];

const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

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

  if (field === 'payment_status') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_PAYMENT_STATUSES.includes(v) ? v : null;
  }

  if (field === 'subtotal' || field === 'discount_amount' || field === 'shipping_amount' || 
      field === 'tax_amount' || field === 'total_amount') {
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
      FROM dbo.tbl_orders
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY placed_at DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('Orders GET error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   2) GET BY ID
========================================= */
// Customer order workspace: return only the authenticated customer's orders.
// The storefront uses this instead of downloading the entire order table.
router.get('/user/:userId', async (req, res) => {
  try {
    await poolConnect;
    const request = pool.request().input('user_id', FIELD_TYPES.user_id.type, req.params.userId);
    const result = await request.query(`
      SELECT * FROM dbo.tbl_orders
      WHERE user_id = @user_id AND isdeleted = 0 AND isactive = 1
      ORDER BY placed_at DESC;
    `);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('Orders GET BY USER error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Single-order aggregate used by the customer and admin workspaces.
// Keeping the related records together prevents partial browser-side joins.
router.get('/detail/:id', async (req, res) => {
  try {
    await poolConnect;
    const id = req.params.id;
    const get = (table) => pool.request().input('order_id', FIELD_TYPES.order_id.type, id).query(`
      SELECT * FROM dbo.${table} WHERE order_id = @order_id AND isdeleted = 0;
    `).then((result) => result.recordset);
    const orderRequest = pool.request().input('order_id', FIELD_TYPES.order_id.type, id);
    const userClause = req.query.user_id ? ' AND user_id = @detail_user_id' : '';
    if (req.query.user_id) orderRequest.input('detail_user_id', FIELD_TYPES.user_id.type, req.query.user_id);
    const orderResult = await orderRequest.query(`
      SELECT TOP 1 * FROM dbo.tbl_orders WHERE order_id = @order_id AND isdeleted = 0${userClause};
    `);
    if (!orderResult.recordset[0]) return res.status(404).json({ success: false, message: 'Order not found' });
    const [items, history, shipments, addresses, payments, returns] = await Promise.all([
      get('tbl_order_items'),
      get('tbl_order_status_history'),
      get('tbl_shipments'),
      get('tbl_order_addresses'),
      get('tbl_payments'),
      get('tbl_returns'),
    ]);
    const courierIds = shipments.map((shipment) => shipment.courier_partner_id).filter(Boolean);
    let couriers = [];
    if (courierIds.length) {
      const courierRequest = pool.request();
      const placeholders = courierIds.map((courierId, index) => {
        const name = `courier_id_${index}`;
        courierRequest.input(name, sql.VarChar(36), courierId);
        return `@${name}`;
      });
      const result = await courierRequest.query(`SELECT * FROM dbo.tbl_courier_partners WHERE courier_partner_id IN (${placeholders.join(',')}) AND isdeleted = 0;`);
      couriers = result.recordset;
    }
    const shipmentIds = shipments.map((shipment) => shipment.shipment_id).filter(Boolean);
    let events = [];
    if (shipmentIds.length) {
      const eventRequest = pool.request();
      const placeholders = shipmentIds.map((shipmentId, index) => {
        const name = `shipment_id_${index}`;
        eventRequest.input(name, sql.VarChar(36), shipmentId);
        return `@${name}`;
      });
      const result = await eventRequest.query(`SELECT * FROM dbo.tbl_shipment_events WHERE shipment_id IN (${placeholders.join(',')}) AND isdeleted = 0 ORDER BY event_timestamp DESC;`);
      events = result.recordset;
    }
    res.json({ success: true, data: { order: orderResult.recordset[0], items, history, shipments, couriers, addresses, payments, returns, events } });
  } catch (err) {
    console.error('Order detail aggregate error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Atomic customer cancellation: history, cancellation record, and order row
// must either all succeed or all roll back together.
router.post('/cancel/:id', async (req, res) => {
  const transaction = new sql.Transaction(pool);
  try {
    await poolConnect;
    await transaction.begin();
    if (!req.body?.user_id) throw new Error('user_id is required');
    const orderRequest = new sql.Request(transaction)
      .input('order_id', FIELD_TYPES.order_id.type, req.params.id)
      .input('user_id', FIELD_TYPES.user_id.type, req.body.user_id);
    const orderResult = await orderRequest.query(`SELECT TOP 1 orderstatus FROM dbo.tbl_orders WHERE order_id = @order_id AND user_id = @user_id AND isdeleted = 0;`);
    const current = orderResult.recordset[0]?.orderstatus?.toLowerCase();
    if (!orderResult.recordset[0]) throw new Error('Order not found');
    if (current && !['pending', 'processing'].includes(current)) throw new Error('This order can no longer be cancelled.');

    const statusRequest = new sql.Request(transaction);
    const statusResult = await statusRequest.query(`SELECT TOP 1 order_status_id FROM dbo.tbl_order_status_master WHERE isactive = 1 AND isdeleted = 0 AND (LOWER(status_code) = 'cancelled' OR LOWER(status_name) = 'cancelled' OR iscancelled_status = 1) ORDER BY display_order;`);
    const cancelledStatusId = statusResult.recordset[0]?.order_status_id;
    if (!cancelledStatusId) throw new Error('Cancelled order status is not configured.');

    const historyRequest = new sql.Request(transaction)
      .input('history_order_id', FIELD_TYPES.order_id.type, req.params.id)
      .input('order_status_id', sql.VarChar(36), cancelledStatusId)
      .input('orderstatus', sql.VarChar(50), 'Cancelled')
      .input('orderstatusby', sql.VarChar(255), req.body?.cancelled_by || 'CUSTOMER')
      .input('remarks', sql.VarChar(500), req.body?.reason || 'Cancelled by customer');
    await historyRequest.query(`INSERT INTO dbo.tbl_order_status_history (order_id, order_status_id, orderstatus, orderstatusby, orderstatustime, remarks, isactive, isdeleted, rcm) VALUES (@history_order_id, @order_status_id, @orderstatus, @orderstatusby, ${IST_NOW_SQL}, @remarks, 1, 0, ${IST_NOW_SQL});`);

    const cancellationRequest = new sql.Request(transaction)
      .input('cancel_order_id', FIELD_TYPES.order_id.type, req.params.id)
      .input('cancelled_by', sql.VarChar(50), req.body?.cancelled_by || 'user')
      .input('cancelled_reason', sql.VarChar(500), req.body?.reason || 'Cancelled by customer');
    await cancellationRequest.query(`INSERT INTO dbo.tbl_order_cancellations (order_id, cancelled_by, cancelled_reason, cancelled_at, isactive, isdeleted, rcm) VALUES (@cancel_order_id, @cancelled_by, @cancelled_reason, ${IST_NOW_SQL}, 1, 0, ${IST_NOW_SQL});`);

    const updateRequest = new sql.Request(transaction).input('update_order_id', FIELD_TYPES.order_id.type, req.params.id);
    await updateRequest.query(`UPDATE dbo.tbl_orders SET orderstatus = 'Cancelled', cancelled_at = ${IST_NOW_SQL}, luu = 'CUSTOMER', lcm = ${IST_NOW_SQL} WHERE order_id = @update_order_id;`);
    await transaction.commit();
    res.json({ success: true, message: 'Order cancelled successfully.' });
  } catch (err) {
    if (transaction._aborted !== true) await transaction.rollback().catch(() => {});
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'order_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('order_id', FIELD_TYPES.order_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_orders
      WHERE order_id = @order_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Orders GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.user_id || !data.order_number || !data.order_status_id) {
      return res.status(400).json({
        success: false,
        message: 'user_id, order_number, order_status_id required'
      });
    }

    if (data.payment_status && !VALID_PAYMENT_STATUSES.includes(data.payment_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `payment_status must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`
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

    // enforce defaults
    cols.push('isactive', 'isdeleted', 'rcm');
    vals.push('1', '0', IST_NOW_SQL);

    await poolConnect;

    try {
      const result = await request.query(`
        INSERT INTO dbo.tbl_orders (${cols.join(',')})
        OUTPUT INSERTED.*
        VALUES (${vals.join(',')});
      `);

      res.status(201).json({
        success: true,
        data: result.recordset[0]
      });
    } catch (err) {
      if (err.message.includes('Violation of UNIQUE KEY constraint')) {
        return res.status(409).json({
          success: false,
          message: 'order_number already exists'
        });
      }
      throw err;
    }
  } catch (err) {
    console.error('Orders POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id required'
      });
    }

    if (data.payment_status && !VALID_PAYMENT_STATUSES.includes(data.payment_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `payment_status must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'order_id',
      FIELD_TYPES.order_id.type,
      data.order_id
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
      UPDATE dbo.tbl_orders
      SET ${updates.join(', ')}
      WHERE order_id = @order_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      message: 'Order updated'
    });
  } catch (err) {
    console.error('Orders PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { order_id, luu } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'order_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('order_id', FIELD_TYPES.order_id.type, order_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_orders
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE order_id = @order_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      message: 'Order deleted (soft)'
    });
  } catch (err) {
    console.error('Orders DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
