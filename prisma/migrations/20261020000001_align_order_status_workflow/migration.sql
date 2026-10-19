-- Keep the status master populated for the admin order workflow.
IF NOT EXISTS (SELECT 1 FROM dbo.tbl_order_status_master WHERE status_code = 'PROCESSING' AND isdeleted = 0)
  INSERT INTO dbo.tbl_order_status_master (order_status_id, status_name, status_code, display_order, iscancelled_status, isactive, isdeleted, rcu, rcm)
  VALUES (CONVERT(varchar(36), NEWID()), 'Processing', 'PROCESSING', 2, 0, 1, 0, 'SYSTEM_MIGRATION', DATEADD(MINUTE, 330, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_order_status_master WHERE status_code = 'SHIPPED' AND isdeleted = 0)
  INSERT INTO dbo.tbl_order_status_master (order_status_id, status_name, status_code, display_order, iscancelled_status, isactive, isdeleted, rcu, rcm)
  VALUES (CONVERT(varchar(36), NEWID()), 'Shipped', 'SHIPPED', 3, 0, 1, 0, 'SYSTEM_MIGRATION', DATEADD(MINUTE, 330, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_order_status_master WHERE status_code = 'DELIVERED' AND isdeleted = 0)
  INSERT INTO dbo.tbl_order_status_master (order_status_id, status_name, status_code, display_order, iscancelled_status, isactive, isdeleted, rcu, rcm)
  VALUES (CONVERT(varchar(36), NEWID()), 'Delivered', 'DELIVERED', 4, 0, 1, 0, 'SYSTEM_MIGRATION', DATEADD(MINUTE, 330, GETUTCDATE()));

IF NOT EXISTS (SELECT 1 FROM dbo.tbl_order_status_master WHERE status_code = 'CANCELLED' AND isdeleted = 0)
  INSERT INTO dbo.tbl_order_status_master (order_status_id, status_name, status_code, display_order, iscancelled_status, isactive, isdeleted, rcu, rcm)
  VALUES (CONVERT(varchar(36), NEWID()), 'Cancelled', 'CANCELLED', 5, 1, 1, 0, 'SYSTEM_MIGRATION', DATEADD(MINUTE, 330, GETUTCDATE()));

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_tbl_shipments_status')
  ALTER TABLE dbo.tbl_shipments DROP CONSTRAINT ck_tbl_shipments_status;

ALTER TABLE dbo.tbl_shipments ADD CONSTRAINT ck_tbl_shipments_status
  CHECK (shipment_status IN ('created', 'pending', 'shipped', 'in_transit', 'in-transit', 'out_for_delivery', 'delivered', 'returned', 'cancelled', 'failed'));
