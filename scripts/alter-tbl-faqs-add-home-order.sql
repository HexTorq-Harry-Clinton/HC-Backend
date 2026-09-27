-- One-time DBA run: ordering for the homepage FAQ strip.
-- show_on_home decides WHICH rows the homepage shows; home_order decides in
-- what order, independently of display_order (which drives the /FAQs page).
-- NULL means "not on the homepage" and is ignored by the storefront.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.tbl_faqs') AND name = 'home_order'
)
BEGIN
  ALTER TABLE dbo.tbl_faqs
    ADD home_order INT NULL;
END
GO

-- Keeps the homepage read ordered by (show_on_home, home_order) with the
-- partial predicate the storefront query uses.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ix_tbl_faqs_home'
    AND object_id = OBJECT_ID('dbo.tbl_faqs')
)
BEGIN
  CREATE INDEX ix_tbl_faqs_home
    ON dbo.tbl_faqs (show_on_home, home_order)
    WHERE isdeleted = 0 AND isactive = 1;
END
GO
