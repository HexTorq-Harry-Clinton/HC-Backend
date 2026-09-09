// routes/AppointmentSlotBlocks.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  appointment_slot_block_id: { type: sql.UniqueIdentifier },
  appointment_date_slot_id: { type: sql.UniqueIdentifier },

  block_start_time: { type: sql.Time },
  block_end_time: { type: sql.Time },

  block_reason: { type: sql.VarChar, maxLength: 255 },
  blocked_by: { type: sql.VarChar, maxLength: 100 },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'appointment_date_slot_id',
  'block_start_time',
  'block_end_time',
  'block_reason',
  'blocked_by',
  'rcu'
];

const UPDATE_FIELDS = [
  'appointment_date_slot_id',
  'block_start_time',
  'block_end_time',
  'block_reason',
  'blocked_by',
  'isactive',
  'isdeleted',
  'luu'
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

  if (typeName === 'Time') {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!match) return null;
      const [, h, m, s] = match;
      return new Date(Date.UTC(1970, 0, 1, Number(h), Number(m), s ? Number(s) : 0));
    }
    return null;
  }

  return typeof value === 'string' ? value.trim() : value;
};

const IST_NOW_SQL = 'DATEADD(MINUTE, 330, GETUTCDATE())';

/* =========================
   1) GET ALL
   ========================= */
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
    const appointment_date_slot_id = req.query.appointment_date_slot_id
      ? String(req.query.appointment_date_slot_id).trim()
      : null;

    const where = [];
    if (!includeDeleted) where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');
    if (appointment_date_slot_id) where.push('appointment_date_slot_id = @appointment_date_slot_id');

    const request = pool.request();
    if (appointment_date_slot_id) {
      request.input('appointment_date_slot_id', FIELD_TYPES.appointment_date_slot_id.type, appointment_date_slot_id);
    }

    const query = `
      SELECT *
      FROM dbo.tbl_appointment_slot_blocks
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY block_start_time ASC;
    `;

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC AppointmentSlotBlocks get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   2) GET BY ID
   ========================= */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'appointment_slot_block_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('appointment_slot_block_id', FIELD_TYPES.appointment_slot_block_id.type, id);

    const query = includeDeleted
      ? `SELECT * FROM dbo.tbl_appointment_slot_blocks
         WHERE appointment_slot_block_id = @appointment_slot_block_id;`
      : `SELECT * FROM dbo.tbl_appointment_slot_blocks
         WHERE appointment_slot_block_id = @appointment_slot_block_id
           AND isdeleted = 0;`;

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Slot block not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC AppointmentSlotBlocks get by id error:', err);
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

    // Required fields
    const required = ['appointment_date_slot_id', 'block_start_time', 'block_end_time'];
    for (const f of required) {
      if (!data[f]) return res.status(400).json({ success: false, message: `${f} is required` });
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
      `INSERT INTO dbo.tbl_appointment_slot_blocks (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC AppointmentSlotBlocks post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   4) PUT (UPDATE)
   ========================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.appointment_slot_block_id) {
      return res.status(400).json({ success: false, message: 'appointment_slot_block_id required' });
    }

    const updates = [];
    const request = pool.request();
    request.input(
      'appointment_slot_block_id',
      FIELD_TYPES.appointment_slot_block_id.type,
      data.appointment_slot_block_id
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
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_appointment_slot_blocks
       SET ${updates.join(', ')}
       WHERE appointment_slot_block_id = @appointment_slot_block_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Slot block not found' });
    }

    res.json({ success: true, message: 'Slot block updated' });
  } catch (err) {
    console.error('HC AppointmentSlotBlocks put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/* =========================
   5) DELETE (SOFT DELETE)
   ========================= */
router.delete('/', async (req, res) => {
  try {
    const { appointment_slot_block_id, luu } = req.body;
    if (!appointment_slot_block_id) {
      return res.status(400).json({ success: false, message: 'appointment_slot_block_id required' });
    }

    await poolConnect;

    const request = pool.request().input(
      'appointment_slot_block_id',
      FIELD_TYPES.appointment_slot_block_id.type,
      appointment_slot_block_id
    );

    if (luu != null) request.input('luu', FIELD_TYPES.luu.type, prepareInputValue('luu', luu));

    const query = luu != null
      ? `UPDATE dbo.tbl_appointment_slot_blocks
         SET isdeleted = 1,
             luu = @luu,
             lcm = ${IST_NOW_SQL}
         WHERE appointment_slot_block_id = @appointment_slot_block_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_appointment_slot_blocks
         SET isdeleted = 1,
             lcm = ${IST_NOW_SQL}
         WHERE appointment_slot_block_id = @appointment_slot_block_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Slot block not found' });
    }

    res.json({ success: true, message: 'Slot block deleted (soft)' });
  } catch (err) {
    console.error('HC AppointmentSlotBlocks delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
