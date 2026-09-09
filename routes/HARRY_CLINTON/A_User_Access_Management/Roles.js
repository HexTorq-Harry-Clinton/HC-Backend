// routes/Role.js (HARRY_CLINTON)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  role_id: { type: sql.VarChar, maxLength: 36 },
  role_name: { type: sql.VarChar, maxLength: 100 },
  role_code: { type: sql.VarChar, maxLength: 50 },
  description: { type: sql.VarChar, maxLength: 255 },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

// Allowed fields for insert/update
const INSERT_FIELDS = ['role_name', 'role_code', 'description', 'rcu'];
const UPDATE_FIELDS = ['role_name', 'role_code', 'description', 'isactive', 'isdeleted', 'luu'];

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
 * GET /roles
 * Default: returns non-deleted roles only.
 * Use ?includeDeleted=1 to include deleted.
 */
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_roles;'
      : 'SELECT * FROM dbo.tbl_roles WHERE isdeleted = 0;';

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC Roles get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * GET /roles/:id
 * Default: non-deleted only.
 * Use ?includeDeleted=1 to include deleted.
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'role_id required' });

    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('role_id', FIELD_TYPES.role_id.type, id);

    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_roles WHERE role_id = @role_id;'
      : 'SELECT * FROM dbo.tbl_roles WHERE role_id = @role_id AND isdeleted = 0;';

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC Roles get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * POST /roles
 * Required: role_name, role_code
 * role_id, rcm, isactive, isdeleted handled by DB defaults unless you add them.
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    if (!data.role_name || !data.role_code) {
      return res.status(400).json({
        success: false,
        message: 'role_name and role_code are required'
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
      `INSERT INTO dbo.tbl_roles (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC Roles post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * PUT /roles
 * Required: role_id
 * Also sets lcm to IST (UTC + 330 minutes).
 */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.role_id) {
      return res.status(400).json({ success: false, message: 'role_id required' });
    }

    const updates = [];
    const request = pool.request();
    request.input('role_id', FIELD_TYPES.role_id.type, data.role_id);

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          updates.push(`${f} = @${f}`);
          request.input(f, FIELD_TYPES[f].type, v);
        }
      }
    });

    // Always update lcm
    updates.push('lcm = DATEADD(MINUTE, 330, GETUTCDATE())');

    if (updates.length === 1) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const setClause = updates.join(', ');

    await poolConnect;

    const result = await request.query(
      `UPDATE dbo.tbl_roles
       SET ${setClause}
       WHERE role_id = @role_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({ success: true, message: 'Role updated' });
  } catch (err) {
    console.error('HC Roles put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * DELETE /roles
 * Soft delete: sets isdeleted = 1 and lcm timestamp.
 * Body: { "role_id": "...", "luu": "..." (optional) }
 */
router.delete('/', async (req, res) => {
  try {
    const { role_id, luu } = req.body;
    if (!role_id) return res.status(400).json({ success: false, message: 'role_id required' });

    await poolConnect;

    const request = pool.request().input('role_id', FIELD_TYPES.role_id.type, role_id);

    if (luu != null) {
      const v = prepareInputValue('luu', luu);
      if (v !== null) request.input('luu', FIELD_TYPES.luu.type, v);
    }

    const query = luu != null
      ? `UPDATE dbo.tbl_roles
         SET isdeleted = 1,
             luu = @luu,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE role_id = @role_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_roles
         SET isdeleted = 1,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE role_id = @role_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({ success: true, message: 'Role deleted (soft)' });
  } catch (err) {
    console.error('HC Roles delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
