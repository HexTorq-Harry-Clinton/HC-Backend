
// routes/Addresses.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  address_id: { type: sql.VarChar, maxLength: 36 },
  user_id: { type: sql.VarChar, maxLength: 36 },

  full_name: { type: sql.VarChar, maxLength: 255 },
  mobile_number: { type: sql.VarChar, maxLength: 50 },
  house_street: { type: sql.VarChar, maxLength: 500 },
  city: { type: sql.VarChar, maxLength: 150 },
  state: { type: sql.VarChar, maxLength: 150 },
  pincode: { type: sql.VarChar, maxLength: 20 },
  landmark: { type: sql.VarChar, maxLength: 255 },

  isdefault: { type: sql.Bit },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'user_id',
  'full_name',
  'mobile_number',
  'house_street',
  'city',
  'state',
  'pincode',
  'landmark',
  'isdefault',
  'rcu'
];

const UPDATE_FIELDS = [
  'full_name',
  'mobile_number',
  'house_street',
  'city',
  'state',
  'pincode',
  'landmark',
  'isdefault',
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
      FROM dbo.tbl_addresses
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY address_id DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('Addresses GET error:', err);
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
        .json({ success: false, message: 'address_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('address_id', FIELD_TYPES.address_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_addresses
      WHERE address_id = @address_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Address not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('Addresses GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (
      !data.user_id ||
      !data.full_name ||
      !data.mobile_number ||
      !data.house_street ||
      !data.city ||
      !data.state ||
      !data.pincode
    ) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing'
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
      INSERT INTO dbo.tbl_addresses (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error('Addresses POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.address_id) {
      return res.status(400).json({
        success: false,
        message: 'address_id required'
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'address_id',
      FIELD_TYPES.address_id.type,
      data.address_id
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
      UPDATE dbo.tbl_addresses
      SET ${updates.join(', ')}
      WHERE address_id = @address_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Address not found' });
    }

    res.json({
      success: true,
      message: 'Address updated'
    });
  } catch (err) {
    console.error('Addresses PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { address_id, luu } = req.body;

    if (!address_id) {
      return res.status(400).json({
        success: false,
        message: 'address_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('address_id', FIELD_TYPES.address_id.type, address_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_addresses
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE address_id = @address_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Address not found' });
    }

    res.json({
      success: true,
      message: 'Address deleted (soft)'
    });
  } catch (err) {
    console.error('Addresses DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
