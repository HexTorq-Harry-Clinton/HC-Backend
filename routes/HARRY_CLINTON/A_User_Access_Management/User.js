// routes/User.js (HARRY_CLINTON)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

// Define SQL types for each field
const FIELD_TYPES = {
  user_id: { type: sql.VarChar, maxLength: 36 },
  full_name: { type: sql.VarChar, maxLength: 255 },
  first_name: { type: sql.VarChar, maxLength: 100 },
  last_name: { type: sql.VarChar, maxLength: 100 },
  email: { type: sql.VarChar, maxLength: 255 },
  phone_number: { type: sql.VarChar, maxLength: 20 },
  profile_picture_url: { type: sql.VarChar, maxLength: 1000 },
  password_hash: { type: sql.VarChar, maxLength: 500 },
  email_verified: { type: sql.Bit },
  phone_verified: { type: sql.Bit },
  last_login: { type: sql.DateTime },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone_number',
  'profile_picture_url',
  'password_hash',
  'rcu'
];

const UPDATE_FIELDS = [
  'full_name',
  'first_name',
  'last_name',
  'email',
  'phone_number',
  'profile_picture_url',
  'password_hash',
  'email_verified',
  'phone_verified',
  'last_login',
  'isactive',
  'isdeleted',
  'luu'
];

const prepareInputValue = (field, value) => {
  if (value === null || value === undefined || value === '') return null;

  const t = FIELD_TYPES[field]?.type?.name;

  // Convert common boolean-like values safely
  if (t === 'Bit') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value ? 1 : 0;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'y'].includes(v)) return 1;
      if (['0', 'false', 'no', 'n'].includes(v)) return 0;
    }
    return null; // reject weird boolean values
  }

  // datetime: accept Date object, or parseable string
  if (t === 'DateTime') {
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // strings
  return typeof value === 'string' ? value.trim() : value;
};

/**
 * GET /users
 * By default returns only non-deleted users.
 * Use ?includeDeleted=1 to include deleted rows too.
 */
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_users;'
      : 'SELECT * FROM dbo.tbl_users WHERE isdeleted = 0;';

    const result = await pool.request().query(query);

    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC Users get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * GET /users/:id
 * Returns a single user. (non-deleted only by default)
 * Use ?includeDeleted=1 to fetch even if deleted.
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'user_id required' });

    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('user_id', FIELD_TYPES.user_id.type, id);

    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_users WHERE user_id = @user_id;'
      : 'SELECT * FROM dbo.tbl_users WHERE user_id = @user_id AND isdeleted = 0;';

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC Users get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * POST /users
 * Creates a new user.
 * SQL will auto-generate user_id and rcm (and defaults for booleans) unless you add them to INSERT_FIELDS.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    // Basic minimal validation (optional but helpful)
    if (!data.full_name || !data.email || !data.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'full_name, email, and password_hash are required'
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

    if (cols.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields' });
    }

    await poolConnect;

    const result = await request.query(
      `INSERT INTO dbo.tbl_users (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC Users post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * PUT /users
 * Updates user by user_id. Also sets lcm to IST (UTC + 330 minutes), same style as your sample.
 */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.user_id) {
      return res.status(400).json({ success: false, message: 'user_id required' });
    }

    const updates = [];
    const request = pool.request();

    request.input('user_id', FIELD_TYPES.user_id.type, data.user_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          updates.push(`${f} = @${f}`);
          request.input(f, FIELD_TYPES[f].type, v);
        }
      }
    });

    // Always update lcm (Last Changed Moment) to IST
    updates.push('lcm = DATEADD(MINUTE, 330, GETUTCDATE())');

    if (updates.length === 1) {
      // only lcm update would happen; you can allow it or reject.
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const setClause = updates.join(', ');

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_users
       SET ${setClause}
       WHERE user_id = @user_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    console.error('HC Users put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * DELETE /users
 * Soft delete: sets isdeleted=1 and lcm timestamp.
 * Body: { "user_id": "..." , "luu": "admin" (optional) }
 */
router.delete('/', async (req, res) => {
  try {
    const { user_id, luu } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });

    await poolConnect;

    const request = pool.request().input('user_id', FIELD_TYPES.user_id.type, user_id);

    if (luu != null) {
      const v = prepareInputValue('luu', luu);
      if (v !== null) request.input('luu', FIELD_TYPES.luu.type, v);
    }

    // If luu not provided, keep current luu as-is (no overwrite)
    const query = luu != null
      ? `UPDATE dbo.tbl_users
         SET isdeleted = 1,
             luu = @luu,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE user_id = @user_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_users
         SET isdeleted = 1,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE user_id = @user_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted (soft)' });
  } catch (err) {
    console.error('HC Users delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
