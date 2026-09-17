-- One-time DBA run: hero slider mixes images + videos in one reel.
-- Existing rows default to image (matches current storefront).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.tbl_image_sliders') AND name = 'media_type'
)
BEGIN
  ALTER TABLE dbo.tbl_image_sliders
    ADD media_type VARCHAR(20) NOT NULL DEFAULT 'image';
END
