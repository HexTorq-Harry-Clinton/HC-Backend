// routes/UserRole.js (HARRY_CLINTON)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  user_role_id: { type: sql.VarChar, maxLength: 36 },
  user_id: { type: sql.VarChar, maxLength: 36 },
  role_id: { type: sql.VarChar, maxLength: 36 },
  assigned_at: { type: sql.DateTime },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

// Insert = assign role to user
const INSERT_FIELDS = ['user_id', 'role_id', 'rcu']; // assigned_at defaults to GETDATE()
const UPDATE_FIELDS = ['isactive', 'isdeleted', 'luu']; // keep it simple; can extend if needed

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

  if (typeName === 'DateTime') {
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return typeof value === 'string' ? value.trim() : value;
};

/**
 * GET /user-roles
 * List all assignments.
 * Default: non-deleted only.
 * Optional filters:
 *  - ?user_id=<guid>
 *  - ?role_id=<guid>
 *  - ?includeDeleted=1
 *  - ?includeInactive=1
 */
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    const includeInactive =
      req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    const where = [];
    const request = pool.request();

    if (!includeDeleted) where.push('ur.isdeleted = 0');
    if (!includeInactive) where.push('ur.isactive = 1');

    if (req.query.user_id) {
      where.push('ur.user_id = @user_id');
      request.input('user_id', FIELD_TYPES.user_id.type, req.query.user_id);
    }

    if (req.query.role_id) {
      where.push('ur.role_id = @role_id');
      request.input('role_id', FIELD_TYPES.role_id.type, req.query.role_id);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Joined output so "get user roles" becomes useful immediately
    const query = `
      SELECT
        ur.*,
        u.full_name,
        u.email,
        r.role_name,
        r.role_code
      FROM dbo.tbl_user_roles ur
      INNER JOIN dbo.tbl_users u ON u.user_id = ur.user_id
      INNER JOIN dbo.tbl_roles r ON r.role_id = ur.role_id
      ${whereClause}
      ORDER BY ur.assigned_at DESC;
    `;

    const result = await request.query(query);

    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC UserRoles get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * GET /user-roles/:id
 * Get a specific user_role assignment by user_role_id.
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'user_role_id required' });

    await poolConnect;

    const request = pool.request().input('user_role_id', FIELD_TYPES.user_role_id.type, id);

    const query = `
      SELECT
        ur.*,
        u.full_name,
        u.email,
        r.role_name,
        r.role_code
      FROM dbo.tbl_user_roles ur
      INNER JOIN dbo.tbl_users u ON u.user_id = ur.user_id
      INNER JOIN dbo.tbl_roles r ON r.role_id = ur.role_id
      WHERE ur.user_role_id = @user_role_id;
    `;

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'User role assignment not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC UserRoles get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * GET /user-roles/user/:user_id
 * Get roles for one user (nice dedicated endpoint).
 */
router.get('/user/:user_id', async (req, res) => {
  try {
    const user_id = req.params.user_id;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });

    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    const includeInactive =
      req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    const where = ['ur.user_id = @user_id'];
    if (!includeDeleted) where.push('ur.isdeleted = 0');
    if (!includeInactive) where.push('ur.isactive = 1');

    const request = pool.request().input('user_id', FIELD_TYPES.user_id.type, user_id);

    const query = `
      SELECT
        ur.user_role_id,
        ur.user_id,
        ur.role_id,
        ur.assigned_at,
        ur.isactive,
        ur.isdeleted,
        ur.rcu,
        ur.rcm,
        ur.luu,
        ur.lcm,
        r.role_name,
        r.role_code,
        r.description
      FROM dbo.tbl_user_roles ur
      INNER JOIN dbo.tbl_roles r ON r.role_id = ur.role_id
      WHERE ${where.join(' AND ')}
      ORDER BY ur.assigned_at DESC;
    `;

    const result = await request.query(query);

    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC UserRoles get by user error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * POST /user-roles
 * "Add user role" / Assign role to user.
 * Body: { user_id, role_id, rcu }
 *
 * Guard: prevent duplicate active assignment (same user_id + role_id where isdeleted=0).
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    if (!data.user_id || !data.role_id) {
      return res.status(400).json({ success: false, message: 'user_id and role_id are required' });
    }

    await poolConnect;

    // prevent duplicate assignment (same user + role, not deleted)
    const dupCheck = await pool.request()
      .input('user_id', FIELD_TYPES.user_id.type, data.user_id)
      .input('role_id', FIELD_TYPES.role_id.type, data.role_id)
      .query(`
        SELECT TOP 1 user_role_id
        FROM dbo.tbl_user_roles
        WHERE user_id = @user_id AND role_id = @role_id AND isdeleted = 0;
      `);

    if (dupCheck.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Role already assigned to this user',
        existing_user_role_id: dupCheck.recordset[0].user_role_id
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

    const result = await request.query(
      `INSERT INTO dbo.tbl_user_roles (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    // FK errors land here if user_id or role_id doesn't exist
    console.error('HC UserRoles post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * PUT /user-roles
 * Update assignment (activate/deactivate, mark deleted, etc.)
 * Required: user_role_id
 * Body can include: isactive, isdeleted, luu
 * Always sets lcm to IST (UTC + 330).
 */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.user_role_id) {
      return res.status(400).json({ success: false, message: 'user_role_id required' });
    }

    const updates = [];
    const request = pool.request();
    request.input('user_role_id', FIELD_TYPES.user_role_id.type, data.user_role_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          updates.push(`${f} = @${f}`);
          request.input(f, FIELD_TYPES[f].type, v);
        }
      }
    });

    updates.push('lcm = DATEADD(MINUTE, 330, GETUTCDATE())');

    if (updates.length === 1) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_user_roles
       SET ${updates.join(', ')}
       WHERE user_role_id = @user_role_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'User role assignment not found' });
    }

    res.json({ success: true, message: 'User role assignment updated' });
  } catch (err) {
    console.error('HC UserRoles put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * DELETE /user-roles
 * "Delete user role" (soft delete assignment)
 * Body: { user_role_id, luu? }
 */
router.delete('/', async (req, res) => {
  try {
    const { user_role_id, luu } = req.body;
    if (!user_role_id) {
      return res.status(400).json({ success: false, message: 'user_role_id required' });
    }

    await poolConnect;

    const request = pool.request().input('user_role_id', FIELD_TYPES.user_role_id.type, user_role_id);

    if (luu != null) {
      const v = prepareInputValue('luu', luu);
      if (v !== null) request.input('luu', FIELD_TYPES.luu.type, v);
    }

    const query = luu != null
      ? `UPDATE dbo.tbl_user_roles
         SET isdeleted = 1,
             luu = @luu,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE user_role_id = @user_role_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_user_roles
         SET isdeleted = 1,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE user_role_id = @user_role_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'User role assignment not found' });
    }

    res.json({ success: true, message: 'User role assignment deleted (soft)' });
  } catch (err) {
    console.error('HC UserRoles delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});




router.post('/add', async (req, res) => {
  try {
    const data = req.body;
    if (!data.user_id || !data.role_id) {
      return res.status(400).json({ success: false, message: 'user_id and role_id required' });
    }

    await poolConnect;

    // Prevent duplicate active assignment
    const dup = await pool.request()
      .input('user_id', FIELD_TYPES.user_id.type, data.user_id)
      .input('role_id', FIELD_TYPES.role_id.type, data.role_id)
      .query(`
        SELECT TOP 1 user_role_id
        FROM dbo.tbl_user_roles
        WHERE user_id = @user_id AND role_id = @role_id AND isdeleted = 0;
      `);

    if (dup.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This role is already assigned to the user',
        user_role_id: dup.recordset[0].user_role_id
      });
    }

    const request = pool.request();
    request
      .input('user_id', FIELD_TYPES.user_id.type, data.user_id)
      .input('role_id', FIELD_TYPES.role_id.type, data.role_id)
      .input('rcu', FIELD_TYPES.rcu.type, data.rcu ?? 'SYSTEM');

    const query = `
      INSERT INTO dbo.tbl_user_roles (user_id, role_id, rcu)
      OUTPUT INSERTED.*
      VALUES (@user_id, @role_id, @rcu);
    `;

    const result = await request.query(query);

    res.status(201).json({
      success: true,
      message: 'Role assigned to user successfully',
      data: result.recordset[0]
    });

  } catch (err) {
    console.error('Add user role error:', err);
    res.status(500).json({ success: false, message: 'Internal error', error: err.message });
  }
});


router.delete('/remove', async (req, res) => {
  try {
    const { user_role_id, luu } = req.body;

    if (!user_role_id) {
      return res.status(400).json({ success: false, message: 'user_role_id required' });
    }

    await poolConnect;

    const request = pool.request()
      .input('user_role_id', FIELD_TYPES.user_role_id.type, user_role_id);

    if (luu) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = luu
      ? `UPDATE dbo.tbl_user_roles
         SET isdeleted = 1, luu = @luu, lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE user_role_id = @user_role_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_user_roles
         SET isdeleted = 1, lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE user_role_id = @user_role_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'User role not found' });
    }

    res.json({ success: true, message: 'Role removed from user (soft delete)' });

  } catch (err) {
    console.error('Remove user role error:', err);
    res.status(500).json({ success: false, message: 'Internal error', error: err.message });
  }
});


module.exports = router;

/**
 * ---------------------------
 * SAMPLE REQUEST PAYLOADS
 * ---------------------------
 *
 * 1) POST /user-roles  (Assign role to user)
 {
    "user_id": "1C97A4E4-22CA-4350-8DF8-16A59ACF31D1",
    "role_id": "2A81D779-4DB9-44F8-A3B4-23B8A4B4A51D",
    "rcu": "ADMIN_PORTAL"
 }
 *
 * 2) PUT /user-roles  (Deactivate assignment)
 * {
 *   "user_role_id": "B3C6DA3E-6B5F-4E1A-A2A1-5F1E3B4D9C11",
 *   "isactive": false,
 *   "luu": "ADMIN_PORTAL"
 * }
 *
 * 3) PUT /user-roles  (Mark deleted via update)
 * {
 *   "user_role_id": "B3C6DA3E-6B5F-4E1A-A2A1-5F1E3B4D9C11",
 *   "isdeleted": true,
 *   "luu": "ADMIN_PORTAL"
 * }
 *
 * 4) DELETE /user-roles  (Soft delete assignment)
 * {
 *   "user_role_id": "B3C6DA3E-6B5F-4E1A-A2A1-5F1E3B4D9C11",
 *   "luu": "ADMIN_PORTAL"
 * }
 *
 * 5) GET /user-roles/user/:user_id   (Get roles for user)
 * /user-roles/user/1C97A4E4-22CA-4350-8DF8-16A59ACF31D1
 *
 * 6) GET /user-roles?user_id=...&includeInactive=1
 * /user-roles?user_id=1C97A4E4-22CA-4350-8DF8-16A59ACF31D1&includeInactive=1
 */
