IF OBJECT_ID(N'dbo.tbl_product_size_charts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tbl_product_size_charts (
    product_size_chart_id varchar(36) NOT NULL CONSTRAINT pk_tbl_product_size_charts PRIMARY KEY DEFAULT CONVERT(varchar(36), NEWID()),
    product_id varchar(36) NOT NULL,
    unit varchar(20) NOT NULL CONSTRAINT df_tbl_product_size_charts_unit DEFAULT 'in',
    isactive bit NOT NULL CONSTRAINT df_tbl_product_size_charts_active DEFAULT 1,
    isdeleted bit NOT NULL CONSTRAINT df_tbl_product_size_charts_deleted DEFAULT 0,
    rcu varchar(100) NULL,
    rcm datetime NOT NULL CONSTRAINT df_tbl_product_size_charts_created DEFAULT DATEADD(MINUTE, 330, GETUTCDATE()),
    luu varchar(100) NULL,
    lcm datetime NULL,
    CONSTRAINT fk_tbl_product_size_charts_product FOREIGN KEY (product_id) REFERENCES dbo.tbl_products(product_id)
  );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_tbl_product_size_charts_product' AND object_id = OBJECT_ID('dbo.tbl_product_size_charts'))
  CREATE UNIQUE INDEX ux_tbl_product_size_charts_product ON dbo.tbl_product_size_charts(product_id) WHERE isdeleted = 0;

IF OBJECT_ID(N'dbo.tbl_product_size_measurements', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tbl_product_size_measurements (
    product_size_measurement_id varchar(36) NOT NULL CONSTRAINT pk_tbl_product_size_measurements PRIMARY KEY DEFAULT CONVERT(varchar(36), NEWID()),
    product_size_chart_id varchar(36) NOT NULL,
    size_id varchar(36) NOT NULL,
    chest decimal(10,2) NULL,
    waist decimal(10,2) NULL,
    hip decimal(10,2) NULL,
    shoulder decimal(10,2) NULL,
    sleeve_length decimal(10,2) NULL,
    isactive bit NOT NULL CONSTRAINT df_tbl_product_size_measurements_active DEFAULT 1,
    isdeleted bit NOT NULL CONSTRAINT df_tbl_product_size_measurements_deleted DEFAULT 0,
    rcu varchar(100) NULL,
    rcm datetime NOT NULL CONSTRAINT df_tbl_product_size_measurements_created DEFAULT DATEADD(MINUTE, 330, GETUTCDATE()),
    luu varchar(100) NULL,
    lcm datetime NULL,
    CONSTRAINT fk_tbl_product_size_measurements_chart FOREIGN KEY (product_size_chart_id) REFERENCES dbo.tbl_product_size_charts(product_size_chart_id),
    CONSTRAINT fk_tbl_product_size_measurements_size FOREIGN KEY (size_id) REFERENCES dbo.tbl_sizes(size_id)
  );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_tbl_product_size_measurements_chart_size' AND object_id = OBJECT_ID('dbo.tbl_product_size_measurements'))
  CREATE UNIQUE INDEX ux_tbl_product_size_measurements_chart_size ON dbo.tbl_product_size_measurements(product_size_chart_id, size_id) WHERE isdeleted = 0;
