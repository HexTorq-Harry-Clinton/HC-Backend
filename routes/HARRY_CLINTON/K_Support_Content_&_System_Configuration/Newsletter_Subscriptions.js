// routes/NewsletterSubscriptions.js (HARRY_CLINTON) - BASIC CRUD (5 endpoints)

const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../../config/db_harry_clinton');

/* =========================================
   FIELD TYPES
========================================= */
const FIELD_TYPES = {
  newsletter_subscription_id: { type: sql.VarChar, maxLength: 36 },
  emailid: { type: sql.VarChar, maxLength: 255 },
  user_id: { type: sql.VarChar, maxLength: 36 },

  subscribed_at: { type: sql.DateTime },
  unsubscribed_at: { type: sql.DateTime },

  subscription_status: { type: sql.VarChar, maxLength: 20 },

  isactive: { type: sql.Bit },
  isdeleted: { type: sql.Bit },

  rcu: { type: sql.VarChar, maxLength: 100 },
  rcm: { type: sql.DateTime },
  luu: { type: sql.VarChar, maxLength: 100 },
  lcm: { type: sql.DateTime }
};

const INSERT_FIELDS = [
  'emailid',
  'user_id',
  'subscribed_at',
  'unsubscribed_at',
  'subscription_status',
  'rcu'
];

const UPDATE_FIELDS = [
  'subscription_status',
  'unsubscribed_at',
  'isactive',
  'isdeleted',
  'luu'
];

const VALID_SUBSCRIPTION_STATUSES = ['subscribed', 'unsubscribed'];

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
      if (['1', 'true', 'yes', 'y'].includes(v)) return 1;
      if (['0', 'false', 'no', 'n'].includes(v)) return 0;
    }
    return null;
  }

  if (field === 'subscription_status') {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : value;
    return VALID_SUBSCRIPTION_STATUSES.includes(v) ? v : null;
  }

  return typeof value === 'string' ? value.trim() : value;
};

const IST_NOW_SQL = 'DATEADD(MINUTE, 330, GETUTCDATE())';

/* =========================================
   1) GET ALL
========================================= */
router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const includeDeleted =
      req.query.includeDeleted === '1' ||
      req.query.includeDeleted === 'true';

    const includeInactive =
      req.query.includeInactive === '1' ||
      req.query.includeInactive === 'true';

    const where = [];
    if (!includeDeleted) where.push('isdeleted = 0');
    if (!includeInactive) where.push('isactive = 1');

    const query = `
      SELECT *
      FROM dbo.tbl_newsletter_subscriptions
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY subscribed_at DESC;
    `;

    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('NewsletterSubscriptions GET error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   2) GET BY ID
========================================= */
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'newsletter_subscription_id required' });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('newsletter_subscription_id', FIELD_TYPES.newsletter_subscription_id.type, id);

    const result = await request.query(`
      SELECT *
      FROM dbo.tbl_newsletter_subscriptions
      WHERE newsletter_subscription_id = @newsletter_subscription_id
        AND isdeleted = 0;
    `);

    if (result.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Newsletter subscription not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('NewsletterSubscriptions GET BY ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   3) POST (CREATE)
========================================= */
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.emailid) {
      return res.status(400).json({
        success: false,
        message: 'emailid required'
      });
    }

    if (data.subscription_status && !VALID_SUBSCRIPTION_STATUSES.includes(data.subscription_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `subscription_status must be one of: ${VALID_SUBSCRIPTION_STATUSES.join(', ')}`
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

    await poolConnect;

    try {
      const result = await request.query(`
        INSERT INTO dbo.tbl_newsletter_subscriptions (${cols.join(',')})
        OUTPUT INSERTED.*
        VALUES (${vals.join(',')});
      `);

      res.status(201).json({
        success: true,
        data: result.recordset[0]
      });
    } catch (err) {
      if (err.message.includes('Violation of UNIQUE KEY constraint')) {
        return res.status(409).json({
          success: false,
          message: 'emailid already subscribed'
        });
      }
      throw err;
    }
  } catch (err) {
    console.error('NewsletterSubscriptions POST error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   4) PUT (UPDATE)
========================================= */
router.put('/', async (req, res) => {
  try {
    const data = req.body;

    if (!data.newsletter_subscription_id) {
      return res.status(400).json({
        success: false,
        message: 'newsletter_subscription_id required'
      });
    }

    if (data.subscription_status && !VALID_SUBSCRIPTION_STATUSES.includes(data.subscription_status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `subscription_status must be one of: ${VALID_SUBSCRIPTION_STATUSES.join(', ')}`
      });
    }

    const updates = [];
    const request = pool.request();

    request.input(
      'newsletter_subscription_id',
      FIELD_TYPES.newsletter_subscription_id.type,
      data.newsletter_subscription_id
    );

    UPDATE_FIELDS.forEach((f) => {
      if (data[f] != null) {
        const v = prepareInputValue(f, data[f]);
        if (v !== null) {
          updates.push(`${f} = @${f}`);
          request.input(f, FIELD_TYPES[f].type, v);
        }
      }
    });

    updates.push(`lcm = ${IST_NOW_SQL}`);

    if (updates.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    await poolConnect;

    const result = await request.query(`
      UPDATE dbo.tbl_newsletter_subscriptions
      SET ${updates.join(', ')}
      WHERE newsletter_subscription_id = @newsletter_subscription_id;

      SELECT @@ROWCOUNT AS affected;
    `);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Newsletter subscription not found' });
    }

    res.json({
      success: true,
      message: 'Newsletter subscription updated'
    });
  } catch (err) {
    console.error('NewsletterSubscriptions PUT error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================
   5) DELETE (SOFT DELETE)
========================================= */
router.delete('/', async (req, res) => {
  try {
    const { newsletter_subscription_id, luu } = req.body;

    if (!newsletter_subscription_id) {
      return res.status(400).json({
        success: false,
        message: 'newsletter_subscription_id required'
      });
    }

    await poolConnect;

    const request = pool
      .request()
      .input('newsletter_subscription_id', FIELD_TYPES.newsletter_subscription_id.type, newsletter_subscription_id);

    if (luu != null) {
      request.input('luu', FIELD_TYPES.luu.type, luu);
    }

    const query = `
      UPDATE dbo.tbl_newsletter_subscriptions
      SET isdeleted = 1,
          ${luu ? 'luu = @luu,' : ''}
          lcm = ${IST_NOW_SQL}
      WHERE newsletter_subscription_id = @newsletter_subscription_id;

      SELECT @@ROWCOUNT AS affected;
    `;

    const result = await request.query(query);

    if (result.recordset[0].affected === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Newsletter subscription not found' });
    }

    res.json({
      success: true,
      message: 'Newsletter subscription deleted (soft)'
    });
  } catch (err) {
    console.error('NewsletterSubscriptions DELETE error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
