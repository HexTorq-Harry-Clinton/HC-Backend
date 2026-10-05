IF OBJECT_ID(N'dbo.tbl_product_details', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tbl_product_details (
    product_details_id varchar(36) NOT NULL CONSTRAINT pk_tbl_product_details PRIMARY KEY DEFAULT CONVERT(varchar(36), NEWID()),
    product_id varchar(36) NOT NULL,
    fabric_details varchar(max) NULL,
    trims_used varchar(max) NULL,
    special_detailing varchar(max) NULL,
    lining_details varchar(max) NULL,
    product_fit varchar(100) NULL,
    model_fit varchar(255) NULL,
    construction_type varchar(50) NULL,
    sleeve_type varchar(100) NULL,
    sleeve_pattern varchar(255) NULL,
    wash_care varchar(max) NULL,
    sleeve_length varchar(100) NULL,
    isactive bit NOT NULL CONSTRAINT df_tbl_product_details_active DEFAULT 1,
    isdeleted bit NOT NULL CONSTRAINT df_tbl_product_details_deleted DEFAULT 0,
    rcu varchar(100) NULL,
    rcm datetime NOT NULL CONSTRAINT df_tbl_product_details_created DEFAULT DATEADD(MINUTE, 330, GETUTCDATE()),
    luu varchar(100) NULL,
    lcm datetime NULL,
    CONSTRAINT fk_tbl_product_details_product FOREIGN KEY (product_id) REFERENCES dbo.tbl_products(product_id)
  );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_tbl_product_details_product' AND object_id = OBJECT_ID('dbo.tbl_product_details'))
  CREATE UNIQUE INDEX ux_tbl_product_details_product ON dbo.tbl_product_details(product_id) WHERE isdeleted = 0;
