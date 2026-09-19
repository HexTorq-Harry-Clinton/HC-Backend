-- Home Screen Content: new tbl_settings columns (single-row config read by
-- the homepage) + tbl_reviews.reviewer_name (drives WHAT OUR CLIENTS SAY).
-- Idempotent: every ADD is guarded by IF NOT EXISTS.
DECLARE @col SYSNAME;

-- ---------- tbl_settings: home sections ----------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_collection_eyebrow')
  ALTER TABLE dbo.tbl_settings ADD home_collection_eyebrow VARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_collection_title')
  ALTER TABLE dbo.tbl_settings ADD home_collection_title VARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_collection_json')
  ALTER TABLE dbo.tbl_settings ADD home_collection_json VARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_new_arrivals_eyebrow')
  ALTER TABLE dbo.tbl_settings ADD home_new_arrivals_eyebrow VARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_new_arrivals_title')
  ALTER TABLE dbo.tbl_settings ADD home_new_arrivals_title VARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_new_arrivals_subtitle')
  ALTER TABLE dbo.tbl_settings ADD home_new_arrivals_subtitle VARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_new_arrivals_count')
  ALTER TABLE dbo.tbl_settings ADD home_new_arrivals_count INT NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_new_arrivals_cols')
  ALTER TABLE dbo.tbl_settings ADD home_new_arrivals_cols INT NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_reviews_eyebrow')
  ALTER TABLE dbo.tbl_settings ADD home_reviews_eyebrow VARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_reviews_title')
  ALTER TABLE dbo.tbl_settings ADD home_reviews_title VARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_reviews_subtitle')
  ALTER TABLE dbo.tbl_settings ADD home_reviews_subtitle VARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_faqs_title')
  ALTER TABLE dbo.tbl_settings ADD home_faqs_title VARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_faqs_subtitle')
  ALTER TABLE dbo.tbl_settings ADD home_faqs_subtitle VARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_spotlight_title')
  ALTER TABLE dbo.tbl_settings ADD home_spotlight_title VARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'home_style_by_hc_title')
  ALTER TABLE dbo.tbl_settings ADD home_style_by_hc_title VARCHAR(255) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'footer_facebook_url')
  ALTER TABLE dbo.tbl_settings ADD footer_facebook_url VARCHAR(1000) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'footer_instagram_url')
  ALTER TABLE dbo.tbl_settings ADD footer_instagram_url VARCHAR(1000) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'footer_youtube_url')
  ALTER TABLE dbo.tbl_settings ADD footer_youtube_url VARCHAR(1000) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'footer_quick_links_json')
  ALTER TABLE dbo.tbl_settings ADD footer_quick_links_json VARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'footer_support_links_json')
  ALTER TABLE dbo.tbl_settings ADD footer_support_links_json VARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_settings' AND COLUMN_NAME = 'footer_copyright_text')
  ALTER TABLE dbo.tbl_settings ADD footer_copyright_text VARCHAR(255) NULL;

-- ---------- tbl_reviews: display name for homepage carousel ----------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tbl_reviews' AND COLUMN_NAME = 'reviewer_name')
  ALTER TABLE dbo.tbl_reviews ADD reviewer_name VARCHAR(255) NULL;
