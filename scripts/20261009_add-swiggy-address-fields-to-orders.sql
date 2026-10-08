IF COL_LENGTH('dbo.tbl_order_addresses', 'address_label') IS NULL
  ALTER TABLE dbo.tbl_order_addresses ADD address_label VARCHAR(20) NULL;

IF COL_LENGTH('dbo.tbl_order_addresses', 'house_no_floor') IS NULL
  ALTER TABLE dbo.tbl_order_addresses ADD house_no_floor VARCHAR(255) NULL;

IF COL_LENGTH('dbo.tbl_order_addresses', 'building_block') IS NULL
  ALTER TABLE dbo.tbl_order_addresses ADD building_block VARCHAR(255) NULL;

IF COL_LENGTH('dbo.tbl_order_addresses', 'area_name') IS NULL
  ALTER TABLE dbo.tbl_order_addresses ADD area_name VARCHAR(255) NULL;
