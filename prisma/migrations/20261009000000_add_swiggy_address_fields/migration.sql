IF COL_LENGTH('dbo.tbl_addresses', 'address_label') IS NULL
  ALTER TABLE [dbo].[tbl_addresses] ADD [address_label] VARCHAR(20) NULL;

IF COL_LENGTH('dbo.tbl_addresses', 'house_no_floor') IS NULL
  ALTER TABLE [dbo].[tbl_addresses] ADD [house_no_floor] VARCHAR(255) NULL;

IF COL_LENGTH('dbo.tbl_addresses', 'building_block') IS NULL
  ALTER TABLE [dbo].[tbl_addresses] ADD [building_block] VARCHAR(255) NULL;

IF COL_LENGTH('dbo.tbl_addresses', 'area_name') IS NULL
  ALTER TABLE [dbo].[tbl_addresses] ADD [area_name] VARCHAR(255) NULL;

IF COL_LENGTH('dbo.tbl_order_addresses', 'address_label') IS NULL
  ALTER TABLE [dbo].[tbl_order_addresses] ADD [address_label] VARCHAR(20) NULL;

IF COL_LENGTH('dbo.tbl_order_addresses', 'house_no_floor') IS NULL
  ALTER TABLE [dbo].[tbl_order_addresses] ADD [house_no_floor] VARCHAR(255) NULL;

IF COL_LENGTH('dbo.tbl_order_addresses', 'building_block') IS NULL
  ALTER TABLE [dbo].[tbl_order_addresses] ADD [building_block] VARCHAR(255) NULL;

IF COL_LENGTH('dbo.tbl_order_addresses', 'area_name') IS NULL
  ALTER TABLE [dbo].[tbl_order_addresses] ADD [area_name] VARCHAR(255) NULL;

UPDATE dbo.tbl_addresses
SET house_no_floor = COALESCE(house_no_floor, house_street),
    area_name = COALESCE(area_name, landmark)
WHERE house_no_floor IS NULL OR area_name IS NULL;
