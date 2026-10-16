-- Parent-child chain: page content belongs to a menu sub-category.
IF COL_LENGTH('dbo.tbl_subcategory_page_content', 'menu_subcategory_id') IS NULL
  ALTER TABLE dbo.tbl_subcategory_page_content ADD menu_subcategory_id VARCHAR(36) NULL;

UPDATE c
SET c.menu_subcategory_id = s.menu_subcategory_id
FROM dbo.tbl_subcategory_page_content c
JOIN dbo.tbl_menu_subcategories s ON LOWER(s.menu_subcategory_slug) = LOWER(c.subcategory_slug)
WHERE c.menu_subcategory_id IS NULL AND s.isdeleted = 0;
