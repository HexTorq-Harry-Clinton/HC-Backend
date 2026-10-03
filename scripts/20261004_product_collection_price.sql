/* Product-to-collection relationship and compare-at pricing. */

IF COL_LENGTH('dbo.tbl_products', 'style_collection_id') IS NULL
  EXEC('ALTER TABLE dbo.tbl_products ADD style_collection_id VARCHAR(36) NULL');
IF COL_LENGTH('dbo.tbl_products', 'collection_display_order') IS NULL
  EXEC('ALTER TABLE dbo.tbl_products ADD collection_display_order INT NULL');
IF COL_LENGTH('dbo.tbl_products', 'original_price') IS NULL
  EXEC('ALTER TABLE dbo.tbl_products ADD original_price DECIMAL(18, 2) NULL');

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_style_collections WHERE collection_slug = 'tuxedo' AND isdeleted = 0)
BEGIN
  INSERT INTO dbo.tbl_style_collections
    (collection_name, collection_slug, description, redirect_link, cta_text, display_order, isactive, isdeleted, rcu, rcm)
  VALUES
    ('Tuxedo', 'tuxedo', 'Precision tailoring and expressive details for black-tie evenings, receptions, and landmark celebrations.', '/tuxedo', 'Explore collection', 1, 1, 0, 'COLLECTION_MIGRATION', DATEADD(MINUTE, 330, GETUTCDATE()));
END;

DECLARE @tuxedo_id VARCHAR(36) = (
  SELECT TOP 1 style_collection_id FROM dbo.tbl_style_collections
  WHERE collection_slug = 'tuxedo' AND isdeleted = 0 ORDER BY rcm DESC
);

EXEC sp_executesql N'
  UPDATE p
  SET p.style_collection_id = @collection_id,
      p.collection_display_order = CASE p.product_slug
        WHEN ''black-tuxedo-wedding-suit-church-affair'' THEN 1
        WHEN ''wedding-black-tuxedo-lapel-edge-suit'' THEN 2
        WHEN ''wedding-burgundy-3pcs-tuxedo-reception-night-suit'' THEN 3
        ELSE p.collection_display_order END,
      p.luu = ''COLLECTION_MIGRATION'',
      p.lcm = DATEADD(MINUTE, 330, GETUTCDATE())
  FROM dbo.tbl_products p
  WHERE p.product_slug IN (
    ''black-tuxedo-wedding-suit-church-affair'',
    ''wedding-black-tuxedo-lapel-edge-suit'',
    ''wedding-burgundy-3pcs-tuxedo-reception-night-suit''
  );', N'@collection_id VARCHAR(36)', @collection_id = @tuxedo_id;
