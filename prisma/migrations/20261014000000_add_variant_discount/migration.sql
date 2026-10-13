-- Variant-level discount: discount_type (none/amount/percentage) + discount_value.
IF COL_LENGTH('dbo.tbl_product_variants', 'discount_type') IS NULL
  ALTER TABLE dbo.tbl_product_variants ADD discount_type VARCHAR(20) NULL;
IF COL_LENGTH('dbo.tbl_product_variants', 'discount_value') IS NULL
  ALTER TABLE dbo.tbl_product_variants ADD discount_value DECIMAL(18, 2) NULL;
