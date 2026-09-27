-- One-time DBA run: per-FAQ toggle for the homepage FAQ strip.
-- The /FAQs page always shows every active row; show_on_home only decides
-- which rows the homepage HomeFaqs section renders.
-- Existing rows default to OFF so nothing appears on the homepage until it is
-- deliberately switched on from the admin panel (FAQs -> Show on home).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.tbl_faqs') AND name = 'show_on_home'
)
BEGIN
  ALTER TABLE dbo.tbl_faqs
    ADD show_on_home BIT NOT NULL
    CONSTRAINT DF__tbl_faqs__show_on_home DEFAULT 0;
END
GO

-- Indexed with the rest of the active/order lookup.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'ix_tbl_faqs_home'
    AND object_id = OBJECT_ID('dbo.tbl_faqs')
)
BEGIN
  CREATE INDEX ix_tbl_faqs_home
    ON dbo.tbl_faqs (show_on_home, display_order)
    WHERE isdeleted = 0 AND isactive = 1;
END
GO
