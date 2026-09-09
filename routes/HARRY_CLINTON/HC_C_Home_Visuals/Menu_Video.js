// routes/MenuVideo.js (HARRY_CLINTON)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  menu_video_id:    { type: sql.VarChar, maxLength: 36 },
  video_type:       { type: sql.VarChar, maxLength: 36 },
  video_url:        { type: sql.VarChar },
  poster_image_url: { type: sql.VarChar },
  autoplay:         { type: sql.Bit },
  loop_video:       { type: sql.Bit },
  mute_default:     { type: sql.Bit },
  display_order:    { type: sql.Int },
  isactive:         { type: sql.Bit },
  isdeleted:        { type: sql.Bit },
  rcu:              { type: sql.VarChar },
  rcm:              { type: sql.DateTime },
  luu:              { type: sql.VarChar },
  lcm:              { type: sql.DateTime },
};

const INSERT_FIELDS = ['video_type', 'video_url', 'poster_image_url', 'autoplay', 'loop_video', 'mute_default', 'display_order', 'rcu'];
const UPDATE_FIELDS = ['video_type', 'video_url', 'poster_image_url', 'autoplay', 'loop_video', 'mute_default', 'display_order', 'isactive', 'isdeleted', 'luu'];

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
 * GET /menu-videos
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
      SELECT * FROM dbo.tbl_menu_video
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY display_order ASC;
    `;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC MenuVideo get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * GET /menu-videos/:id
 * Query: ?includeDeleted=1
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'menu_video_id required' });

    await poolConnect;
    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('menu_video_id', FIELD_TYPES.menu_video_id.type, id);
    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_menu_video WHERE menu_video_id = @menu_video_id;'
      : 'SELECT * FROM dbo.tbl_menu_video WHERE menu_video_id = @menu_video_id AND isdeleted = 0;';

    const result = await request.query(query);
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'Menu video not found' });

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC MenuVideo get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * POST /menu-videos
 * Required: video_url
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0)
      return res.status(400).json({ success: false, message: 'No data' });
    if (!data.video_url)
      return res.status(400).json({ success: false, message: 'video_url is required' });

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
      `INSERT INTO dbo.tbl_menu_video (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC MenuVideo post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * PUT /menu-videos
 * Required: menu_video_id
 */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.menu_video_id)
      return res.status(400).json({ success: false, message: 'menu_video_id required' });

    const updates = [];
    const request = pool.request();
    request.input('menu_video_id', FIELD_TYPES.menu_video_id.type, data.menu_video_id);

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
      `UPDATE dbo.tbl_menu_video
       SET ${updates.join(', ')}
       WHERE menu_video_id = @menu_video_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0)
      return res.status(404).json({ success: false, message: 'Menu video not found' });

    res.json({ success: true, message: 'Menu video updated' });
  } catch (err) {
    console.error('HC MenuVideo put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * DELETE /menu-videos
 * Soft delete. Body: { menu_video_id, luu? }
 */
router.delete('/', async (req, res) => {
  try {
    const { menu_video_id, luu } = req.body;
    if (!menu_video_id)
      return res.status(400).json({ success: false, message: 'menu_video_id required' });

    await poolConnect;
    const request = pool.request().input('menu_video_id', FIELD_TYPES.menu_video_id.type, menu_video_id);

    if (luu != null) {
      const v = prepareInputValue('luu', luu);
      if (v !== null) request.input('luu', FIELD_TYPES.luu.type, v);
    }

    const query = luu != null
      ? `UPDATE dbo.tbl_menu_video SET isdeleted=1, luu=@luu, lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE menu_video_id=@menu_video_id; SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_menu_video SET isdeleted=1, lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE menu_video_id=@menu_video_id; SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);
    if (result.recordset[0].affected === 0)
      return res.status(404).json({ success: false, message: 'Menu video not found' });

    res.json({ success: true, message: 'Menu video deleted (soft)' });
  } catch (err) {
    console.error('HC MenuVideo delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;

/**
 * ---------------------------
 * SAMPLE REQUEST PAYLOADS
 * ---------------------------
 *
 * 1) POST /menu-videos
 * {
 *   "video_type": "youtube",
 *   "video_url": "https://www.youtube.com/embed/ABC123",
 *   "poster_image_url": "https://cdn.example.com/poster.jpg",
 *   "autoplay": true,
 *   "loop_video": true,
 *   "mute_default": true,
 *   "display_order": 1,
 *   "rcu": "ADMIN_PORTAL"
 * }
 *
 * 2) PUT /menu-videos
 * {
 *   "menu_video_id": "UUID-HERE",
 *   "video_url": "https://www.youtube.com/embed/XYZ999",
 *   "isactive": true,
 *   "luu": "ADMIN_PORTAL"
 * }
 *
 * 3) DELETE /menu-videos
 * {
 *   "menu_video_id": "UUID-HERE",
 *   "luu": "ADMIN_PORTAL"
 * }
 */