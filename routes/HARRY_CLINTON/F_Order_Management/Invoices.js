// routes/Invoices.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  invoice_id: { type: sql.VarChar, maxLength: 36 },
  order_id: { type: sql.VarChar, maxLength: 36 },

  invoice_number: { type: sql.VarChar, maxLength: 50 },
  invoice_date: { type: sql.DateTime },

  invoice_url: { type: sql.VarChar, maxLength: 1000 },
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
  'invoice_number',
  'invoice_url',
  'notes',
  'rcu'
];

const UPDATE_FIELDS = [
  'invoice_url',
  'notes',
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
      FROM dbo.tbl_invoices
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY invoice_date DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('Invoices GET error:', err);
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
        .json({ success: false, message: 'invoice_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('invoice_id', FIELD_TYPES.invoice_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_invoices
      WHERE invoice_id = @invoice_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Invoices GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.order_id || !data.invoice_number) {
      return res.status(400).json({
        success: false,
        message: 'order_id, invoice_number required'
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

    try {
      const result = await request.query(`
        INSERT INTO dbo.tbl_invoices (${cols.join(',')})
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
          message: 'invoice_number already exists'
        });
      }
      throw err;
    }
  } catch (err) {
    console.error('Invoices POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.invoice_id) {
      return res.status(400).json({
        success: false,
        message: 'invoice_id required'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'invoice_id',
      FIELD_TYPES.invoice_id.type,
      data.invoice_id
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
      UPDATE dbo.tbl_invoices
      SET ${updates.join(', ')}
      WHERE invoice_id = @invoice_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Invoice not found' });
    }

    res.json({
      success: true,
      message: 'Invoice updated'
    });
  } catch (err) {
    console.error('Invoices PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { invoice_id, luu } = req.body;

    if (!invoice_id) {
      return res.status(400).json({
        success: false,
        message: 'invoice_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('invoice_id', FIELD_TYPES.invoice_id.type, invoice_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_invoices
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE invoice_id = @invoice_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Invoice not found' });
    }

    res.json({
      success: true,
      message: 'Invoice deleted (soft)'
    });
  } catch (err) {
    console.error('Invoices DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
