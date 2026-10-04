const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

const FIELDS = {
  subcategory_page_content_id: sql.VarChar(36), subcategory_slug: sql.VarChar(100), category_group: sql.VarChar(100),
  hero_title: sql.VarChar(255), hero_subtitle: sql.VarChar(500), hero_video_url: sql.VarChar(1000),
  marquee_words_json: sql.VarChar(sql.MAX), left_image_url: sql.VarChar(1000), center_video_url: sql.VarChar(1000),
  right_image_url: sql.VarChar(1000), slider_images_json: sql.VarChar(sql.MAX), slider_image_1_url: sql.VarChar(1000), slider_image_2_url: sql.VarChar(1000), slider_image_3_url: sql.VarChar(1000), description_title: sql.VarChar(255),
  description_text: sql.VarChar(sql.MAX), label_video_url: sql.VarChar(1000), label_image_url: sql.VarChar(1000),
  footer_text: sql.VarChar(255), display_order: sql.Int, isactive: sql.Bit, isdeleted: sql.Bit,
  rcu: sql.VarChar(100), luu: sql.VarChar(100),
};

const INSERT_FIELDS = Object.keys(FIELDS).filter((f) => !['subcategory_page_content_id', 'isactive', 'isdeleted'].includes(f));
const UPDATE_FIELDS = INSERT_FIELDS.filter((f) => f !== 'subcategory_slug');
const bind = (request, field, value) => request.input(field, FIELDS[field], value);
const clean = (field, value) => {
  if (value === undefined || value === null || value === '') return null;
  if (field === 'display_order') return Number.isFinite(Number(value)) ? Number(value) : 0;
  if (field === 'isactive' || field === 'isdeleted') return value === true || value === 1 || value === '1' ? 1 : 0;
  return String(value);
};

router.get('/', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`SELECT * FROM dbo.tbl_subcategory_page_content WHERE isdeleted = 0 ORDER BY display_order, subcategory_slug;`);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().input('slug', sql.VarChar(100), req.params.slug.toLowerCase()).query(`SELECT TOP 1 * FROM dbo.tbl_subcategory_page_content WHERE subcategory_slug = @slug AND isdeleted = 0 AND isactive = 1;`);
    if (!result.recordset[0]) return res.status(404).json({ success: false, message: 'Subcategory page content not found' });
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.subcategory_slug) return res.status(400).json({ success: false, message: 'subcategory_slug required' });
    await poolConnect;
    const request = pool.request();
    const cols = [], vals = [];
    for (const field of INSERT_FIELDS) {
      const value = clean(field, data[field]);
      if (value !== null) { cols.push(field); vals.push(`@${field}`); bind(request, field, value); }
    }
    cols.push('isactive', 'isdeleted', 'rcm'); vals.push('1', '0', 'DATEADD(MINUTE, 330, GETUTCDATE())');
    const result = await request.query(`INSERT INTO dbo.tbl_subcategory_page_content (${cols.join(',')}) OUTPUT INSERTED.* VALUES (${vals.join(',')});`);
    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(err.number === 2627 || err.number === 2601 ? 409 : 500).json({ success: false, message: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const data = req.body || {};
    if (!data.subcategory_page_content_id) return res.status(400).json({ success: false, message: 'subcategory_page_content_id required' });
    await poolConnect;
    const request = pool.request().input('subcategory_page_content_id', sql.VarChar(36), data.subcategory_page_content_id);
    const updates = [];
    for (const field of UPDATE_FIELDS) {
      if (data[field] !== undefined) { updates.push(`${field} = @${field}`); bind(request, field, clean(field, data[field])); }
    }
    if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    updates.push('lcm = DATEADD(MINUTE, 330, GETUTCDATE())');
    const result = await request.query(`UPDATE dbo.tbl_subcategory_page_content SET ${updates.join(', ')} OUTPUT INSERTED.* WHERE subcategory_page_content_id = @subcategory_page_content_id AND isdeleted = 0;`);
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(err.number === 2627 || err.number === 2601 ? 409 : 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
