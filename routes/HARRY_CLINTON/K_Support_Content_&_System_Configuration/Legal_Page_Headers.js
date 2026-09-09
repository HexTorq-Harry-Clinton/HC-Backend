const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */

const FIELD_TYPES = {
  id: { type: sql.Int },

  page_type: { type: sql.NVarChar, maxLength: 50 },
  page_title: { type: sql.NVarChar, maxLength: 255 },
  intro_text: { type: sql.NVarChar, maxLength: sql.MAX },

  effective_date: { type: sql.Date },
  version_number: { type: sql.NVarChar, maxLength: 20 },

  is_active: { type: sql.Bit },

  updated_by: { type: sql.NVarChar, maxLength: 100 },
  updated_at: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'page_type',
  'page_title',
  'intro_text',
  'effective_date',
  'version_number',
  'updated_by'
];

const UPDATE_FIELDS = [
  'page_type',
  'page_title',
  'intro_text',
  'effective_date',
  'version_number',
  'is_active',
  'updated_by'
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

      if (['1','true','yes','y'].includes(v)) return 1;

      if (['0','false','no','n'].includes(v)) return 0;

    }

    return null;
  }

  if (field === 'effective_date') {
    return value;
  }

  return typeof value === 'string'
    ? value.trim()
    : value;
};

const IST_NOW_SQL = 'DATEADD(MINUTE, 330, GETUTCDATE())';


router.get('/', async (req, res) => {

  try {

    await poolConnect;

    const includeInactive =
      req.query.includeInactive === '1' ||
      req.query.includeInactive === 'true';

    const where = [];

    if (!includeInactive) where.push('is_active = 1');

    const query = `
      SELECT *
      FROM dbo.tbl_legal_page_header
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });

  } catch (err) {

    console.error('LegalPageHeader GET error:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});


router.get('/:id', async (req, res) => {

  try {

    const id = req.params.id;

    if (!id) {

      return res.status(400).json({
        success: false,
        message: 'id required'
      });

    }

    await poolConnect;

    const request = pool
      .request()
      .input('id', FIELD_TYPES.id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_legal_page_header
      WHERE id = @id;
    `);

    if (result.recordset.length === 0) {

      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });

    }

    res.json({
      success: true,
      data: result.recordset[0]
    });

  } catch (err) {

    console.error('LegalPageHeader GET BY ID error:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});


router.post('/', async (req, res) => {

  try {

    const data = req.body;

    if (!data.page_type || !data.page_title || !data.intro_text) {

      return res.status(400).json({
        success: false,
        message: 'page_type, page_title, intro_text required'
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

          request.input(
            f,
            FIELD_TYPES[f].type,
            v
          );

        }

      }

    });

    await poolConnect;

    const result = await request.query(`
      INSERT INTO dbo.tbl_legal_page_header (${cols.join(',')})
      OUTPUT INSERTED.*
      VALUES (${vals.join(',')});
    `);

    res.status(201).json({
      success: true,
      data: result.recordset[0]
    });

  } catch (err) {

    console.error('LegalPageHeader POST error:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});



router.put('/', async (req, res) => {

  try {

    const data = req.body;

    if (!data.id) {

      return res.status(400).json({
        success: false,
        message: 'id required'
      });

    }

    const updates = [];

    const request = pool.request();

    request.input(
      'id',
      FIELD_TYPES.id.type,
      data.id
    );

    UPDATE_FIELDS.forEach((f) => {

      if (data[f] != null) {

        const v = prepareInputValue(f, data[f]);

        if (v !== null) {

          updates.push(`${f} = @${f}`);

          request.input(
            f,
            FIELD_TYPES[f].type,
            v
          );

        }

      }

    });

    updates.push(`updated_at = ${IST_NOW_SQL}`);

    if (updates.length === 1) {

      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });

    }

    await poolConnect;

    const result = await request.query(`
      UPDATE dbo.tbl_legal_page_header
      SET ${updates.join(', ')}
      WHERE id = @id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {

      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });

    }

    res.json({
      success: true,
      message: 'Record updated'
    });

  } catch (err) {

    console.error('LegalPageHeader PUT error:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});



router.delete('/', async (req, res) => {

  try {

    const { id } = req.body;

    if (!id) {

      return res.status(400).json({
        success: false,
        message: 'id required'
      });

    }

    await poolConnect;

    const request = pool
      .request()
      .input('id', FIELD_TYPES.id.type, id);

    const result = await request.query(`
      DELETE FROM dbo.tbl_legal_page_header
      WHERE id = @id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {

      return res.status(404).json({
        success: false,
        message: 'Record not found'
      });

    }

    res.json({
      success: true,
      message: 'Record deleted'
    });

  } catch (err) {

    console.error('LegalPageHeader DELETE error:', err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});

module.exports = router;