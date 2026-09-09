// routes/SpotlightMedia.js (HARRY_CLINTON)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  spotlight_media_id:  { type: sql.VarChar, maxLength: 36 },
  spotlight_entry_id:  { type: sql.VarChar, maxLength: 36 },
  media_type:          { type: sql.VarChar, maxLength: 20 },
  media_url:           { type: sql.VarChar },
  alt_text:            { type: sql.VarChar },
  display_order:       { type: sql.Int },
  isprimary:           { type: sql.Bit },
  isactive:            { type: sql.Bit },
  isdeleted:           { type: sql.Bit },
  rcu:                 { type: sql.VarChar },
  rcm:                 { type: sql.DateTime },
  luu:                 { type: sql.VarChar },
  lcm:                 { type: sql.DateTime },
};

const INSERT_FIELDS = ['spotlight_entry_id', 'media_type', 'media_url', 'alt_text', 'display_order', 'isprimary', 'rcu'];
const UPDATE_FIELDS = ['media_type', 'media_url', 'alt_text', 'display_order', 'isprimary', 'isactive', 'isdeleted', 'luu'];

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
 * GET /spotlight-media
 * Query: ?includeDeleted=1, ?includeInactive=1, ?spotlight_entry_id=UUID
 */
router.get('/', async (req, res) => {
  try {
    await poolConnect;
    const includeDeleted  = req.query.includeDeleted  === '1' || req.query.includeDeleted  === 'true';
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
    const entryId = req.query.spotlight_entry_id;

    const where = [];
    if (!includeDeleted)  where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');

    const request = pool.request();
    if (entryId) {
      where.push('spotlight_entry_id = @spotlight_entry_id');
      request.input('spotlight_entry_id', FIELD_TYPES.spotlight_entry_id.type, entryId);
    }

    const query = `
      SELECT * FROM dbo.tbl_spotlight_media
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY display_order ASC;
    `;

    const result = await request.query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC SpotlightMedia get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * GET /spotlight-media/:id
 * Query: ?includeDeleted=1
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'spotlight_media_id required' });

    await poolConnect;
    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('spotlight_media_id', FIELD_TYPES.spotlight_media_id.type, id);
    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_spotlight_media WHERE spotlight_media_id = @spotlight_media_id;'
      : 'SELECT * FROM dbo.tbl_spotlight_media WHERE spotlight_media_id = @spotlight_media_id AND isdeleted = 0;';

    const result = await request.query(query);
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'Spotlight media not found' });

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC SpotlightMedia get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * POST /spotlight-media
 * Required: spotlight_entry_id, media_url, media_type
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0)
      return res.status(400).json({ success: false, message: 'No data' });
    if (!data.spotlight_entry_id)
      return res.status(400).json({ success: false, message: 'spotlight_entry_id is required' });
    if (!data.media_url)
      return res.status(400).json({ success: false, message: 'media_url is required' });
    if (!data.media_type)
      return res.status(400).json({ success: false, message: 'media_type is required' });

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
      `INSERT INTO dbo.tbl_spotlight_media (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC SpotlightMedia post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * PUT /spotlight-media
 * Required: spotlight_media_id
 */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.spotlight_media_id)
      return res.status(400).json({ success: false, message: 'spotlight_media_id required' });

    const updates = [];
    const request = pool.request();
    request.input('spotlight_media_id', FIELD_TYPES.spotlight_media_id.type, data.spotlight_media_id);

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
      `UPDATE dbo.tbl_spotlight_media
       SET ${updates.join(', ')}
       WHERE spotlight_media_id = @spotlight_media_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0)
      return res.status(404).json({ success: false, message: 'Spotlight media not found' });

    res.json({ success: true, message: 'Spotlight media updated' });
  } catch (err) {
    console.error('HC SpotlightMedia put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * DELETE /spotlight-media
 * Soft delete. Body: { spotlight_media_id, luu? }
 */
router.delete('/', async (req, res) => {
  try {
    const { spotlight_media_id, luu } = req.body;
    if (!spotlight_media_id)
      return res.status(400).json({ success: false, message: 'spotlight_media_id required' });

    await poolConnect;
    const request = pool.request().input('spotlight_media_id', FIELD_TYPES.spotlight_media_id.type, spotlight_media_id);

    if (luu != null) {
      const v = prepareInputValue('luu', luu);
      if (v !== null) request.input('luu', FIELD_TYPES.luu.type, v);
    }

    const query = luu != null
      ? `UPDATE dbo.tbl_spotlight_media SET isdeleted=1, luu=@luu, lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE spotlight_media_id=@spotlight_media_id; SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_spotlight_media SET isdeleted=1, lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE spotlight_media_id=@spotlight_media_id; SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);
    if (result.recordset[0].affected === 0)
      return res.status(404).json({ success: false, message: 'Spotlight media not found' });

    res.json({ success: true, message: 'Spotlight media deleted (soft)' });
  } catch (err) {
    console.error('HC SpotlightMedia delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;

/**
 * ---------------------------
 * SAMPLE REQUEST PAYLOADS
 * ---------------------------
 *
 * 1) POST /spotlight-media
 * {
 *   "spotlight_entry_id": "UUID-HERE",
 *   "media_type": "image",
 *   "media_url": "https://cdn.example.com/spotlight1.jpg",
 *   "alt_text": "Summer look 1",
 *   "display_order": 1,
 *   "isprimary": true,
 *   "rcu": "ADMIN_PORTAL"
 * }
 *
 * 2) PUT /spotlight-media
 * {
 *   "spotlight_media_id": "UUID-HERE",
 *   "media_url": "https://cdn.example.com/spotlight1-updated.jpg",
 *   "isprimary": false,
 *   "luu": "ADMIN_PORTAL"
 * }
 *
 * 3) DELETE /spotlight-media
 * {
 *   "spotlight_media_id": "UUID-HERE",
 *   "luu": "ADMIN_PORTAL"
 * }
 */