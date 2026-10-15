-- Showcase-to-product linkage: an entry/collection can feature a catalog product + variant.
IF COL_LENGTH('dbo.tbl_spotlight_entries', 'product_id') IS NULL
  ALTER TABLE dbo.tbl_spotlight_entries ADD product_id VARCHAR(36) NULL;
IF COL_LENGTH('dbo.tbl_spotlight_entries', 'product_variant_id') IS NULL
  ALTER TABLE dbo.tbl_spotlight_entries ADD product_variant_id VARCHAR(36) NULL;
IF COL_LENGTH('dbo.tbl_style_collections', 'product_id') IS NULL
  ALTER TABLE dbo.tbl_style_collections ADD product_id VARCHAR(36) NULL;
IF COL_LENGTH('dbo.tbl_style_collections', 'product_variant_id') IS NULL
  ALTER TABLE dbo.tbl_style_collections ADD product_variant_id VARCHAR(36) NULL;
