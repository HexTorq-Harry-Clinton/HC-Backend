IF COL_LENGTH(N'dbo.tbl_product_media', N'media_role') IS NULL
  ALTER TABLE dbo.tbl_product_media ADD media_role varchar(30) NULL;
