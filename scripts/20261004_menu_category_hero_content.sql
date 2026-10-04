IF COL_LENGTH('dbo.tbl_menu_categories', 'hero_description') IS NULL
  EXEC('ALTER TABLE dbo.tbl_menu_categories ADD hero_description NVARCHAR(2000) NULL');
IF COL_LENGTH('dbo.tbl_menu_categories', 'hero_cta_text') IS NULL
  EXEC('ALTER TABLE dbo.tbl_menu_categories ADD hero_cta_text NVARCHAR(255) NULL');
IF COL_LENGTH('dbo.tbl_menu_categories', 'hero_cta_link') IS NULL
  EXEC('ALTER TABLE dbo.tbl_menu_categories ADD hero_cta_link NVARCHAR(1000) NULL');
