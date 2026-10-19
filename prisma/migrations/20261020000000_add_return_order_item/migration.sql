IF COL_LENGTH('dbo.tbl_returns', 'order_item_id') IS NULL
  ALTER TABLE dbo.tbl_returns ADD order_item_id VARCHAR(36) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_tbl_returns_order_item' AND object_id = OBJECT_ID('dbo.tbl_returns'))
  CREATE INDEX ix_tbl_returns_order_item ON dbo.tbl_returns(order_item_id) WHERE isdeleted = 0;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_tbl_returns_order_item')
  ALTER TABLE dbo.tbl_returns ADD CONSTRAINT fk_tbl_returns_order_item
    FOREIGN KEY (order_item_id) REFERENCES dbo.tbl_order_items(order_item_id);
