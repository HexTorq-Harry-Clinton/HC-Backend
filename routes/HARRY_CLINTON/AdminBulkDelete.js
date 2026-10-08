const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../../config/db_harry_clinton');
const { requireAuth } = require('../../middlewares/auth.middleware');

// Only registered admin resources may be hard-deleted. Identifiers are never
// interpolated from the request; both table and key come from this allowlist.
const RESOURCES = {
  '/Users': ['tbl_users', 'user_id'], '/Roles': ['tbl_roles', 'role_id'], '/User-Roles': ['tbl_user_roles', 'user_role_id'],
  '/Products': ['tbl_products', 'product_id'], '/Products-Variants': ['tbl_product_variants', 'product_variant_id'],
  '/Products-Attributes': ['tbl_attributes', 'attribute_id'], '/Products-Attributes-Values': ['tbl_product_attributes_values', 'product_attribute_value_id'],
  '/Products-Sizes': ['tbl_sizes', 'size_id'], '/Products-Size-Charts': ['tbl_product_size_measurements', 'product_size_measurement_id'],
  '/Products-Cloth-Types': ['tbl_cloth_types', 'cloth_type_id'], '/Products-Care-Instructions': ['tbl_care_instructions', 'care_instruction_id'],
  '/Products-Seo': ['tbl_product_seo', 'product_seo_id'], '/Products-Media': ['tbl_product_media', 'product_media_id'],
  '/Profiles': ['tbl_profiles', 'profile_id'], '/Addresses': ['tbl_addresses', 'address_id'], '/Measurements': ['tbl_customer_measurements', 'measurement_id'],
  '/Spotlight-Entries': ['tbl_spotlight_entries', 'spotlight_entry_id'], '/Spotlight-Media': ['tbl_spotlight_media', 'spotlight_media_id'],
  '/Style-Collections': ['tbl_style_collections', 'style_collection_id'], '/Style-Collection-Media': ['tbl_style_collection_media', 'style_collection_media_id'],
  '/Image-Sliders': ['tbl_image_sliders', 'image_slider_id'], '/Menu-Video': ['tbl_menu_video', 'menu_video_id'],
  '/Running-Bar': ['tbl_running_bars', 'running_bar_id'], '/Running-Bar-Items': ['tbl_running_bar_items', 'running_bar_item_id'],
  '/Notification-Bar': ['tbl_notification_bars', 'notification_bar_id'], '/FAQs': ['tbl_faqs', 'faq_id'],
  '/Support-Contacts': ['tbl_support_contacts', 'support_contact_id'], '/Newsletter-Subscriptions': ['tbl_newsletter_subscriptions', 'newsletter_subscription_id'],
  '/Home-Settings': ['tbl_home_settings', 'setting_id'], '/Subcategory-Content': ['tbl_subcategory_page_content', 'subcategory_page_content_id'],
  '/Orders': ['tbl_orders', 'order_id'], '/Order-Items': ['tbl_order_items', 'order_item_id'], '/Order-Addresses': ['tbl_order_addresses', 'order_address_id'],
  '/Order-Status-Master': ['tbl_order_status_master', 'order_status_id'], '/Order-Status-History': ['tbl_order_status_history', 'order_status_history_id'],
  '/Invoices': ['tbl_invoices', 'invoice_id'], '/Payments': ['tbl_payments', 'payment_id'],
  '/Coupons': ['tbl_coupons', 'coupon_id'], '/Discounts': ['tbl_discounts', 'discount_id'], '/Discount-Targets': ['tbl_discount_targets', 'discount_target_id'],
  '/Courier-Partners': ['tbl_courier_partners', 'courier_partner_id'], '/Shipments': ['tbl_shipments', 'shipment_id'], '/Shipment-Events': ['tbl_shipment_events', 'shipment_event_id'],
  '/Returns': ['tbl_returns', 'return_id'], '/Refunds': ['tbl_refunds', 'refund_id'],
  '/Reviews': ['tbl_reviews', 'review_id'], '/Review-Media': ['tbl_review_media', 'review_media_id'], '/Review-Votes': ['tbl_review_votes', 'review_vote_id'],
};

router.post('/', requireAuth, async (req, res) => {
  if (!String(req.user?.role_code || '').toLowerCase().includes('admin')) {
    return res.status(403).json({ success: false, message: 'Administrator access required.' });
  }
  const { resource, ids, hard_delete: hardDelete } = req.body || {};
  const config = RESOURCES[resource];
  if (!hardDelete || !config || !Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return res.status(400).json({ success: false, message: 'A valid resource, up to 100 IDs, and hard_delete=true are required.' });
  }
  try {
    await poolConnect;
    const [table, key] = config;
    const request = pool.request();
    const placeholders = ids.map((id, index) => {
      const name = `id${index}`;
      request.input(name, sql.VarChar, String(id));
      return `@${name}`;
    });
    const result = await request.query(`DELETE FROM dbo.${table} WHERE ${key} IN (${placeholders.join(',')}); SELECT @@ROWCOUNT AS affected;`);
    res.json({ success: true, affected: result.recordset[0]?.affected || 0, message: 'Records permanently deleted.' });
  } catch (err) {
    console.error('Admin hard delete error:', err);
    res.status(409).json({ success: false, message: 'Hard delete failed. The record may still be referenced by related data.' });
  }
});

module.exports = router;
