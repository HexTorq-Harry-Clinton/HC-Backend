// routes/AppointmentDateSlots.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  appointment_date_slot_id: { type: sql.UniqueIdentifier },

  slot_date: { type: sql.Date },
  slot_duration_minutes: { type: sql.Int },

  isavailable: { type: sql.Bit },
  notes: { type: sql.VarChar, maxLength: 500 },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = ['slot_date', 'slot_duration_minutes', 'isavailable', 'notes', 'rcu'];
const UPDATE_FIELDS = ['slot_date', 'slot_duration_minutes', 'isavailable', 'notes', 'isactive', 'isdeleted', 'luu'];

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

  // For dates, let SQL driver parse if it's ISO (YYYY-MM-DD). Just trim strings.
  return typeof value === 'string' ? value.trim() : value;
};

// Helper: IST timestamp like your template
const IST_NOW_SQL = 'DATEADD(MINUTE, 330, GETUTCDATE())';

/* =========================
   1) GET ALL
   ========================= */
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
      FROM dbo.tbl_appointment_date_slots
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY slot_date ASC;
    `;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC AppointmentDateSlots get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   2) GET BY ID
   ========================= */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'appointment_date_slot_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('appointment_date_slot_id', FIELD_TYPES.appointment_date_slot_id.type, id);

    const query = includeDeleted
      ? `SELECT * FROM dbo.tbl_appointment_date_slots
         WHERE appointment_date_slot_id = @appointment_date_slot_id;`
      : `SELECT * FROM dbo.tbl_appointment_date_slots
         WHERE appointment_date_slot_id = @appointment_date_slot_id
           AND isdeleted = 0;`;

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment date slot not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC AppointmentDateSlots get by id error:', err);
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

    // Required fields (slot_date is the minimum)
    if (!data.slot_date) {
      return res.status(400).json({ success: false, message: 'slot_date is required (YYYY-MM-DD)' });
    }

    // Optional: validate duration to match CHECK constraint (avoid SQL error)
    if (data.slot_duration_minutes != null) {
      const dur = parseInt(data.slot_duration_minutes, 10);
      const allowed = new Set([15, 30, 45, 60, 90, 120]);
      if (!allowed.has(dur)) {
        return res.status(400).json({
          success: false,
          message: 'slot_duration_minutes must be one of: 15,30,45,60,90,120'
        });
      }
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
      `INSERT INTO dbo.tbl_appointment_date_slots (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    // Common case: unique constraint on slot_date (filtered index) triggers duplicate error
    const msg = (err && err.message) || '';
    if (msg.includes('UX_tbl_appointment_date_slots_slot_date') || msg.toLowerCase().includes('duplicate')) {
      return res.status(409).json({ success: false, message: 'slot_date already exists (non-deleted)' });
    }

    console.error('HC AppointmentDateSlots post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   4) PUT (UPDATE)
   ========================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.appointment_date_slot_id) {
      return res.status(400).json({ success: false, message: 'appointment_date_slot_id required' });
    }

    // Optional: validate duration
    if (data.slot_duration_minutes != null) {
      const dur = parseInt(data.slot_duration_minutes, 10);
      const allowed = new Set([15, 30, 45, 60, 90, 120]);
      if (!allowed.has(dur)) {
        return res.status(400).json({
          success: false,
          message: 'slot_duration_minutes must be one of: 15,30,45,60,90,120'
        });
      }
    }

    const updates = [];
    const request = pool.request();
    request.input('appointment_date_slot_id', FIELD_TYPES.appointment_date_slot_id.type, data.appointment_date_slot_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          updates.push(`${f} = @${f}`);
          request.input(f, FIELD_TYPES[f].type, v);
        }
      }
    });

    // always touch lcm on update (IST)
    updates.push(`lcm = ${IST_NOW_SQL}`);

    if (updates.length === 1) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_appointment_date_slots
       SET ${updates.join(', ')}
       WHERE appointment_date_slot_id = @appointment_date_slot_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Appointment date slot not found' });
    }

    res.json({ success: true, message: 'Appointment date slot updated' });
  } catch (err) {
    const msg = (err && err.message) || '';
    if (msg.includes('UX_tbl_appointment_date_slots_slot_date') || msg.toLowerCase().includes('duplicate')) {
      return res.status(409).json({ success: false, message: 'slot_date already exists (non-deleted)' });
    }

    console.error('HC AppointmentDateSlots put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   5) DELETE (SOFT DELETE)
   ========================= */
router.delete('/', async (req, res) => {
  try {
    const { appointment_date_slot_id, luu } = req.body;
    if (!appointment_date_slot_id) {
      return res.status(400).json({ success: false, message: 'appointment_date_slot_id required' });
    }

    await poolConnect;

    const request = pool.request().input(
      'appointment_date_slot_id',
      FIELD_TYPES.appointment_date_slot_id.type,
      appointment_date_slot_id
    );

    if (luu != null) request.input('luu', FIELD_TYPES.luu.type, prepareInputValue('luu', luu));

    const query = luu != null
      ? `UPDATE dbo.tbl_appointment_date_slots
         SET isdeleted = 1,
             luu = @luu,
             lcm = ${IST_NOW_SQL}
         WHERE appointment_date_slot_id = @appointment_date_slot_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_appointment_date_slots
         SET isdeleted = 1,
             lcm = ${IST_NOW_SQL}
         WHERE appointment_date_slot_id = @appointment_date_slot_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Appointment date slot not found' });
    }

    res.json({ success: true, message: 'Appointment date slot deleted (soft)' });
  } catch (err) {
    console.error('HC AppointmentDateSlots delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
