/* Category/subcategory editorial content used by the storefront and admin UI.
   Run once against db_harry_clinton before using the new CRUD fields. */

IF COL_LENGTH('dbo.tbl_menu_categories', 'hero_title') IS NULL
  ALTER TABLE dbo.tbl_menu_categories ADD hero_title NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.tbl_menu_categories', 'hero_subtitle') IS NULL
  ALTER TABLE dbo.tbl_menu_categories ADD hero_subtitle NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.tbl_menu_categories', 'hero_image_url') IS NULL
  ALTER TABLE dbo.tbl_menu_categories ADD hero_image_url NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.tbl_menu_categories', 'marquee_words') IS NULL
  ALTER TABLE dbo.tbl_menu_categories ADD marquee_words NVARCHAR(4000) NULL;

IF COL_LENGTH('dbo.tbl_menu_subcategories', 'image_url') IS NULL
  ALTER TABLE dbo.tbl_menu_subcategories ADD image_url NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.tbl_menu_subcategories', 'video_url') IS NULL
  ALTER TABLE dbo.tbl_menu_subcategories ADD video_url NVARCHAR(1000) NULL;
