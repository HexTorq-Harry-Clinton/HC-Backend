// routes/MenuSubcategory.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  menu_subcategory_id: { type: sql.VarChar, maxLength: 36 },
  menu_category_id: { type: sql.VarChar, maxLength: 36 },
  menu_subcategory_name: { type: sql.VarChar, maxLength: 255 },
  menu_subcategory_slug: { type: sql.VarChar, maxLength: 255 },
  redirect_link: { type: sql.VarChar, maxLength: 1000 },
  display_order: { type: sql.Int },
  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },
  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'menu_category_id',
  'menu_subcategory_name',
  'menu_subcategory_slug',
  'redirect_link',
  'display_order',
  'rcu'
];

const UPDATE_FIELDS = [
  'menu_category_id',
  'menu_subcategory_name',
  'menu_subcategory_slug',
  'redirect_link',
  'display_order',
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

  return typeof value === 'string' ? value.trim() : value;
};

// 1) GET ALL
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    const where = [];
    const request = pool.request();

    if (!includeDeleted) where.push('s.isdeleted = 0');
    if (!includeInactive) where.push('s.isactive = 1');

    if (req.query.menu_category_id) {
      where.push('s.menu_category_id = @menu_category_id');
      request.input('menu_category_id', FIELD_TYPES.menu_category_id.type, req.query.menu_category_id);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const query = `
      SELECT
        s.*,
        c.menu_category_name,
        c.menu_category_slug
      FROM dbo.tbl_menu_subcategories s
      INNER JOIN dbo.tbl_menu_categories c ON c.menu_category_id = s.menu_category_id
      ${whereClause}
      ORDER BY c.display_order ASC, s.display_order ASC, s.menu_subcategory_name ASC;
    `;

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC MenuSubcategories get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 2) GET BY ID
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'menu_subcategory_id required' });

    await poolConnect;

    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('menu_subcategory_id', FIELD_TYPES.menu_subcategory_id.type, id);

    const query = includeDeleted
      ? `SELECT * FROM dbo.tbl_menu_subcategories WHERE menu_subcategory_id = @menu_subcategory_id;`
      : `SELECT * FROM dbo.tbl_menu_subcategories WHERE menu_subcategory_id = @menu_subcategory_id AND isdeleted = 0;`;

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu subcategory not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC MenuSubcategories get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 3) POST (CREATE)
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No data' });
    }

    if (!data.menu_category_id || !data.menu_subcategory_name || !data.menu_subcategory_slug) {
      return res.status(400).json({
        success: false,
        message: 'menu_category_id, menu_subcategory_name, menu_subcategory_slug are required'
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

    if (cols.length === 0) return res.status(400).json({ success: false, message: 'No valid fields' });

    await poolConnect;

    const result = await request.query(
      `INSERT INTO dbo.tbl_menu_subcategories (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC MenuSubcategories post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 4) PUT (UPDATE)
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.menu_subcategory_id) {
      return res.status(400).json({ success: false, message: 'menu_subcategory_id required' });
    }

    const updates = [];
    const request = pool.request();
    request.input('menu_subcategory_id', FIELD_TYPES.menu_subcategory_id.type, data.menu_subcategory_id);

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
      `UPDATE dbo.tbl_menu_subcategories
       SET ${updates.join(', ')}
       WHERE menu_subcategory_id = @menu_subcategory_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Menu subcategory not found' });
    }

    res.json({ success: true, message: 'Menu subcategory updated' });
  } catch (err) {
    console.error('HC MenuSubcategories put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// 5) DELETE (SOFT DELETE)
router.delete('/', async (req, res) => {
  try {
    const { menu_subcategory_id, luu } = req.body;
    if (!menu_subcategory_id) {
      return res.status(400).json({ success: false, message: 'menu_subcategory_id required' });
    }

    await poolConnect;

    const request = pool.request().input('menu_subcategory_id', FIELD_TYPES.menu_subcategory_id.type, menu_subcategory_id);

    if (luu != null) request.input('luu', FIELD_TYPES.luu.type, prepareInputValue('luu', luu));

    const query = luu != null
      ? `UPDATE dbo.tbl_menu_subcategories
         SET isdeleted = 1,
             luu = @luu,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE menu_subcategory_id = @menu_subcategory_id;
         SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_menu_subcategories
         SET isdeleted = 1,
             lcm = DATEADD(MINUTE, 330, GETUTCDATE())
         WHERE menu_subcategory_id = @menu_subcategory_id;
         SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res.status(404).json({ success: false, message: 'Menu subcategory not found' });
    }

    res.json({ success: true, message: 'Menu subcategory deleted (soft)' });
  } catch (err) {
    console.error('HC MenuSubcategories delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;
