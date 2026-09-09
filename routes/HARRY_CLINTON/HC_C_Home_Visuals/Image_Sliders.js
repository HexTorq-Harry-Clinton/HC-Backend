// routes/ImageSliders.js (HARRY_CLINTON)
const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELD_TYPES = {
  image_slider_id:             { type: sql.VarChar, maxLength: 36 },
  image_url:                   { type: sql.VarChar },
  title:                       { type: sql.VarChar },
  subtitle:                    { type: sql.VarChar },
  button_text:                 { type: sql.VarChar },
  redirect_link:               { type: sql.VarChar },
  display_order:               { type: sql.Int },
  auto_slide_interval_seconds: { type: sql.Int },
  isactive:                    { type: sql.Bit },
  isdeleted:                   { type: sql.Bit },
  rcu:                         { type: sql.VarChar },
  rcm:                         { type: sql.DateTime },
  luu:                         { type: sql.VarChar },
  lcm:                         { type: sql.DateTime },
};

const INSERT_FIELDS = ['image_url', 'title', 'subtitle', 'button_text', 'redirect_link', 'display_order', 'auto_slide_interval_seconds', 'rcu'];
const UPDATE_FIELDS = ['image_url', 'title', 'subtitle', 'button_text', 'redirect_link', 'display_order', 'auto_slide_interval_seconds', 'isactive', 'isdeleted', 'luu'];

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
 * GET /image-sliders
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
      SELECT * FROM dbo.tbl_image_sliders
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY display_order ASC;
    `;

    const result = await pool.request().query(query);
    res.json({ success: true, data: result.recordset, count: result.recordset.length });
  } catch (err) {
    console.error('HC ImageSliders get error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * GET /image-sliders/:id
 * Query: ?includeDeleted=1
 */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, message: 'image_slider_id required' });

    await poolConnect;
    const includeDeleted = req.query.includeDeleted === '1' || req.query.includeDeleted === 'true';

    const request = pool.request().input('image_slider_id', FIELD_TYPES.image_slider_id.type, id);
    const query = includeDeleted
      ? 'SELECT * FROM dbo.tbl_image_sliders WHERE image_slider_id = @image_slider_id;'
      : 'SELECT * FROM dbo.tbl_image_sliders WHERE image_slider_id = @image_slider_id AND isdeleted = 0;';

    const result = await request.query(query);
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: 'Image slider not found' });

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC ImageSliders get by id error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * POST /image-sliders
 * Required: image_url
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || Object.keys(data).length === 0)
      return res.status(400).json({ success: false, message: 'No data' });
    if (!data.image_url)
      return res.status(400).json({ success: false, message: 'image_url is required' });

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
      `INSERT INTO dbo.tbl_image_sliders (${cols.join(',')})
       OUTPUT INSERTED.*
       VALUES (${vals.join(',')});`
    );

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('HC ImageSliders post error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * PUT /image-sliders
 * Required: image_slider_id
 */
router.put('/', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.image_slider_id)
      return res.status(400).json({ success: false, message: 'image_slider_id required' });

    const updates = [];
    const request = pool.request();
    request.input('image_slider_id', FIELD_TYPES.image_slider_id.type, data.image_slider_id);

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
      `UPDATE dbo.tbl_image_sliders
       SET ${updates.join(', ')}
       WHERE image_slider_id = @image_slider_id;
       SELECT @@ROWCOUNT AS affected;`
    );

    if (result.recordset[0].affected === 0)
      return res.status(404).json({ success: false, message: 'Image slider not found' });

    res.json({ success: true, message: 'Image slider updated' });
  } catch (err) {
    console.error('HC ImageSliders put error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

/**
 * DELETE /image-sliders
 * Soft delete. Body: { image_slider_id, luu? }
 */
router.delete('/', async (req, res) => {
  try {
    const { image_slider_id, luu } = req.body;
    if (!image_slider_id)
      return res.status(400).json({ success: false, message: 'image_slider_id required' });

    await poolConnect;
    const request = pool.request().input('image_slider_id', FIELD_TYPES.image_slider_id.type, image_slider_id);

    if (luu != null) {
      const v = prepareInputValue('luu', luu);
      if (v !== null) request.input('luu', FIELD_TYPES.luu.type, v);
    }

    const query = luu != null
      ? `UPDATE dbo.tbl_image_sliders SET isdeleted=1, luu=@luu, lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE image_slider_id=@image_slider_id; SELECT @@ROWCOUNT AS affected;`
      : `UPDATE dbo.tbl_image_sliders SET isdeleted=1, lcm=DATEADD(MINUTE,330,GETUTCDATE()) WHERE image_slider_id=@image_slider_id; SELECT @@ROWCOUNT AS affected;`;

    const result = await request.query(query);
    if (result.recordset[0].affected === 0)
      return res.status(404).json({ success: false, message: 'Image slider not found' });

    res.json({ success: true, message: 'Image slider deleted (soft)' });
  } catch (err) {
    console.error('HC ImageSliders delete error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

module.exports = router;

/**
 * ---------------------------
 * SAMPLE REQUEST PAYLOADS
 * ---------------------------
 *
 * 1) POST /image-sliders
 * {
 *   "image_url": "https://cdn.example.com/banner1.jpg",
 *   "title": "New Arrivals",
 *   "subtitle": "Fresh styles just dropped",
 *   "button_text": "Shop Now",
 *   "redirect_link": "/new-arrivals",
 *   "display_order": 1,
 *   "auto_slide_interval_seconds": 5,
 *   "rcu": "ADMIN_PORTAL"
 * }
 *
 * 2) PUT /image-sliders
 * {
 *   "image_slider_id": "UUID-HERE",
 *   "title": "Updated Title",
 *   "display_order": 2,
 *   "isactive": true,
 *   "luu": "ADMIN_PORTAL"
 * }
 *
 * 3) DELETE /image-sliders
 * {
 *   "image_slider_id": "UUID-HERE",
 *   "luu": "ADMIN_PORTAL"
 * }
 */