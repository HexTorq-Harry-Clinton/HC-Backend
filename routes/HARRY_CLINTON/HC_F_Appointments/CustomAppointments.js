// routes/CustomAppointments.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  appointment_id: { type: sql.UniqueIdentifier },

  user_id: { type: sql.UniqueIdentifier }, // table column is UNIQUEIDENTIFIER (as per your DDL)
  appointment_date_slot_id: { type: sql.UniqueIdentifier },
  appointment_time_slot_id: { type: sql.UniqueIdentifier },

  name: { type: sql.VarChar, maxLength: 255 },
  city: { type: sql.VarChar, maxLength: 150 },

  preferred_delivery_date: { type: sql.Date },
  occasion: { type: sql.VarChar, maxLength: 255 },

  appointment_status: { type: sql.VarChar, maxLength: 30 },
  isrejected: { type: sql.Bit },

  appointment_notes: { type: sql.VarChar, maxLength: 500 },

  requested_at: { type: sql.DateTime },
  approved_at: { type: sql.DateTime },
  rejected_at: { type: sql.DateTime },
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
  'appointment_date_slot_id',
  'appointment_time_slot_id',
  'name',
  'city',
  'preferred_delivery_date',
  'occasion',
  'appointment_status',
  'isrejected',
  'appointment_notes',
  'rcu'
];

const UPDATE_FIELDS = [
  'user_id',
  'appointment_date_slot_id',
  'appointment_time_slot_id',
  'name',
  'city',
  'preferred_delivery_date',
  'occasion',
  'appointment_status',
  'isrejected',
  'appointment_notes',
  'isactive',
  'isdeleted',
  'luu',
  'approved_at',
  'rejected_at',
  'cancelled_at'
];

const prepareInputValue = (field, value) => {
  if (value === null || value === undefined || value === '') return null;

  const typeName = FIELD_TYPES[field]?.type?.name;

  if (typeName === 'Int') {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }

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

  return typeof value === 'string' ? value.trim() : value;
};

const IST_NOW_SQL = 'DATEADD(MINUTE, 330, GETUTCDATE())';

const VALID_STATUSES = new Set(['requested', 'approved', 'rejected', 'cancelled', 'completed']);
const isValidStatus = (s) => typeof s === 'string' && VALID_STATUSES.has(s.trim().toLowerCase());

/* =========================
   1) GET ALL
   ========================= */
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    const status = req.query.status ? String(req.query.status).trim().toLowerCase() : null;
    const date = req.query.date ? String(req.query.date).trim() : null; // expects YYYY-MM-DD (slot_date)
    const userId = req.query.user_id ? String(req.query.user_id).trim() : null;

    const where = [];
    if (!includeDeleted) where.push('a.isdeleted = 0');
    if (!includeInactive) where.push('a.isactive = 1');

    if (status) where.push('LOWER(a.appointment_status) = @status');
    if (date) where.push('d.slot_date = @slot_date');
    if (userId) where.push('a.user_id = @user_id');

    const request = pool.request();
    if (status) request.input('status', FIELD_TYPES.appointment_status.type, status);
    if (date) request.input('slot_date', FIELD_TYPES.preferred_delivery_date.type, date);
    if (userId) request.input('user_id', FIELD_TYPES.user_id.type, userId);

    const query = `
      SELECT
        a.*,
        d.slot_date,
        t.slot_start_time,
        t.slot_end_time
      FROM dbo.tbl_custom_appointments a
      INNER JOIN dbo.tbl_appointment_date_slots d
        ON d.appointment_date_slot_id = a.appointment_date_slot_id
      INNER JOIN dbo.tbl_appointment_time_slots t
        ON t.appointment_time_slot_id = a.appointment_time_slot_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY a.requested_at DESC;
    `;

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC CustomAppointments get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   2) GET BY ID
   ========================= */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'appointment_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('appointment_id', FIELD_TYPES.appointment_id.type, id);

    const query = includeDeleted
      ? `
        SELECT
          a.*,
          d.slot_date,
          t.slot_start_time,
          t.slot_end_time
        FROM dbo.tbl_custom_appointments a
        INNER JOIN dbo.tbl_appointment_date_slots d ON d.appointment_date_slot_id = a.appointment_date_slot_id
        INNER JOIN dbo.tbl_appointment_time_slots t ON t.appointment_time_slot_id = a.appointment_time_slot_id
        WHERE a.appointment_id = @appointment_id;
      `
      : `
        SELECT
          a.*,
          d.slot_date,
          t.slot_start_time,
          t.slot_end_time
        FROM dbo.tbl_custom_appointments a
        INNER JOIN dbo.tbl_appointment_date_slots d ON d.appointment_date_slot_id = a.appointment_date_slot_id
        INNER JOIN dbo.tbl_appointment_time_slots t ON t.appointment_time_slot_id = a.appointment_time_slot_id
        WHERE a.appointment_id = @appointment_id
          AND a.isdeleted = 0;
      `;

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC CustomAppointments get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   3) POST (CREATE)
   ========================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    // Required for appointment record
    const required = ['appointment_date_slot_id', 'appointment_time_slot_id', 'name'];
    for (const f of required) {
      if (!data[f]) return res.status(400).json({ success: false, message: `${f} is required` });
    }

    if (data.appointment_status && !isValidStatus(data.appointment_status)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment_status' });
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

    if (cols.length === 0) return res.status(400).json({ success: false, message: 'No valid fields' });

    await poolConnect;

    const result = await request.query(
      `INSERT INTO dbo.tbl_custom_appointments (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    // Unique booking protection: unique index on appointment_time_slot_id (if you created it)
    const msg = (err && err.message) || '';
    if (msg.toLowerCase().includes('ux_tbl_custom_appointments_time_slot') || msg.toLowerCase().includes('duplicate')) {
      return res.status(409).json({ success: false, message: 'That time slot is already booked' });
    }

    console.error('HC CustomAppointments post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   4) PUT (UPDATE)
   ========================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.appointment_id) {
      return res.status(400).json({ success: false, message: 'appointment_id required' });
    }

    if (data.appointment_status && !isValidStatus(data.appointment_status)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment_status' });
    }

    const updates = [];
    const request = pool.request();
    request.input('appointment_id', FIELD_TYPES.appointment_id.type, data.appointment_id);

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
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_custom_appointments
       SET ${updates.join(', ')}
       WHERE appointment_id = @appointment_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, message: 'Appointment updated' });
  } catch (err) {
    const msg = (err && err.message) || '';
    if (msg.toLowerCase().includes('ux_tbl_custom_appointments_time_slot') || msg.toLowerCase().includes('duplicate')) {
      return res.status(409).json({ success: false, message: 'That time slot is already booked' });
    }

    console.error('HC CustomAppointments put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   5) DELETE (SOFT DELETE)
   ========================= */
router.delete('/', async (req, res) => {
  try {
    const { appointment_id, luu } = req.body;
    if (!appointment_id) {
      return res.status(400).json({ success: false, message: 'appointment_id required' });
    }

    await poolConnect;

    const request = pool.request().input('appointment_id', FIELD_TYPES.appointment_id.type, appointment_id);
    if (luu != null) request.input('luu', FIELD_TYPES.luu.type, prepareInputValue('luu', luu));

    const query = luu != null
      ? `UPDATE dbo.tbl_custom_appointments
         SET isdeleted = 1,
             luu = @luu,
             lcm = ${IST_NOW_SQL}
         WHERE appointment_id = @appointment_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_custom_appointments
         SET isdeleted = 1,
             lcm = ${IST_NOW_SQL}
         WHERE appointment_id = @appointment_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, message: 'Appointment deleted (soft)' });
  } catch (err) {
    console.error('HC CustomAppointments delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
