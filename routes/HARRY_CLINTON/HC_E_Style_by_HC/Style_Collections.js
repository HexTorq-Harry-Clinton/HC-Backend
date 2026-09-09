// routes/StyleCollections.js (HARRY_CLINTON)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  style_collection_id: { type: sql.VarChar, maxLength: 36 },
  collection_name:     { type: sql.VarChar },
  collection_slug:     { type: sql.VarChar },
  description:         { type: sql.VarChar },
  redirect_link:       { type: sql.VarChar },
  cta_text:            { type: sql.VarChar },
  display_order:       { type: sql.Int },
  isactive:            { type: sql.Bit },
  isdeleted:           { type: sql.Bit },
  rcu:                 { type: sql.VarChar },
  rcm:                 { type: sql.DateTime },
  luu:                 { type: sql.VarChar },
  lcm:                 { type: sql.DateTime },
};

const INSERT_FIELDS = ['collection_name', 'collection_slug', 'description', 'redirect_link', 'cta_text', 'display_order', 'rcu'];
const UPDATE_FIELDS = ['collection_name', 'collection_slug', 'description', 'redirect_link', 'cta_text', 'display_order', 'isactive', 'isdeleted', 'luu'];

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

  if (typeName === 'Int') {
    const n = parseInt(value, 10);
    return isNaN(n) ? null : n;
  }

  return typeof value === 'string' ? value.trim() : value;
};

/**
 * GET /style-collections
 * Query: ?includeDeleted=1, ?includeInactive=1
 */
router.get('/', async (req, res) => {
  try {
    await poolConnect;
    const includeDeleted  = req.query.includeDeleted  === '1' || req.query.includeDeleted  === 'true';
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';

    const where = [];
    if (!includeDeleted)  where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');

    const query = `
      SELECT * FROM dbo.tbl_style_collections
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY display_order ASC;
    `;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC StyleCollections get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * GET /style-collections/:id
 * Query: ?includeDeleted=1
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'style_collection_id required' });

    await poolConnect;
    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('style_collection_id', FIELD_TYPES.style_collection_id.type, id);
    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_style_collections WHERE style_collection_id = @style_collection_id;'
      : 'SELECT * FROM dbo.tbl_style_collections WHERE style_collection_id = @style_collection_id AND isdeleted = 0;';

    const result = await request.query(query);
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'Style collection not found' });

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC StyleCollections get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * POST /style-collections
 * Required: collection_name
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0)
      return res.status(400).json({ success: false, message: 'No data' });
    if (!data.collection_name)
      return res.status(400).json({ success: false, message: 'collection_name is required' });

    const cols = [], vals = [];
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

    if (cols.length === 0)
      return res.status(400).json({ success: false, message: 'No valid fields' });

    await poolConnect;
    const result = await request.query(
      `INSERT INTO dbo.tbl_style_collections (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC StyleCollections post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * PUT /style-collections
 * Required: style_collection_id
 */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.style_collection_id)
      return res.status(400).json({ success: false, message: 'style_collection_id required' });

    const updates = [];
    const request = pool.request();
    request.input('style_collection_id', FIELD_TYPES.style_collection_id.type, data.style_collection_id);

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

    if (updates.length === 1)
      return res.status(400).json({ success: false, message: 'No valid fields to update' });

    await poolConnect;
    const result = await request.query(
      `UPDATE dbo.tbl_style_collections
       SET ${updates.join(', ')}
       WHERE style_collection_id = @style_collection_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0)
      return res.status(404).json({ success: false, message: 'Style collection not found' });

    res.json({ success: true, message: 'Style collection updated' });
  } catch (err) {
    console.error('HC StyleCollections put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * DELETE /style-collections
 * Soft delete. Body: { style_collection_id, luu? }
 */
router.delete('/', async (req, res) => {
  try {
    const { style_collection_id, luu } = req.body;
    if (!style_collection_id)
      return res.status(400).json({ success: false, message: 'style_collection_id required' });

    await poolConnect;
    const request = pool.request().input('style_collection_id', FIELD_TYPES.style_collection_id.type, style_collection_id);

    if (luu != null) {
      const v = prepareInputValue('luu', luu);
      if (v !== null) request.input('luu', FIELD_TYPES.luu.type, v);
    }

    const query = luu != null
      ? `UPDATE dbo.tbl_style_collections SET isdeleted=1, luu=@luu, lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE style_collection_id=@style_collection_id; SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_style_collections SET isdeleted=1, lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE style_collection_id=@style_collection_id; SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);
    if (result.recordset[0].affected === 0)
      return res.status(404).json({ success: false, message: 'Style collection not found' });

    res.json({ success: true, message: 'Style collection deleted (soft)' });
  } catch (err) {
    console.error('HC StyleCollections delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;

/**
 * ---------------------------
 * SAMPLE REQUEST PAYLOADS
 * ---------------------------
 *
 * 1) POST /style-collections
 * {
 *   "collection_name": "Winter Essentials",
 *   "collection_slug": "winter-essentials",
 *   "description": "Cozy picks for the cold season",
 *   "redirect_link": "/winter-essentials",
 *   "cta_text": "Explore",
 *   "display_order": 1,
 *   "rcu": "ADMIN_PORTAL"
 * }
 *
 * 2) PUT /style-collections
 * {
 *   "style_collection_id": "UUID-HERE",
 *   "collection_name": "Winter Essentials (Updated)",
 *   "isactive": true,
 *   "luu": "ADMIN_PORTAL"
 * }
 *
 * 3) DELETE /style-collections
 * {
 *   "style_collection_id": "UUID-HERE",
 *   "luu": "ADMIN_PORTAL"
 * }
 */