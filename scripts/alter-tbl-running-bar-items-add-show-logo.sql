-- One-time DBA run: per-item logo toggle for the running bar tape.
-- Existing rows default to logo ON (matches current storefront).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.tbl_running_bar_items') AND name = 'show_logo'
)
BEGIN
  ALTER TABLE dbo.tbl_running_bar_items
    ADD show_logo BIT NOT NULL DEFAULT 1;
END
