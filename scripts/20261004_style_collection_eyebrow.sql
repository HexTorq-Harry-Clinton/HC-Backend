IF COL_LENGTH('dbo.tbl_style_collections', 'eyebrow') IS NULL
  EXEC('ALTER TABLE dbo.tbl_style_collections ADD eyebrow VARCHAR(MAX) NULL');
