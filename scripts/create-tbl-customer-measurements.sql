IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'tbl_customer_measurements')
BEGIN
  CREATE TABLE dbo.tbl_customer_measurements (
    measurement_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    guest_name VARCHAR(255) NULL,
    product_name VARCHAR(255) NULL,
    unit VARCHAR(30) NOT NULL DEFAULT 'inches',
    shirt_body_length VARCHAR(50) NULL,
    shirt_shoulder VARCHAR(50) NULL,
    shirt_sleeve_length VARCHAR(50) NULL,
    shirt_arm_loose VARCHAR(50) NULL,
    shirt_chest VARCHAR(50) NULL,
    shirt_waist VARCHAR(50) NULL,
    shirt_hip VARCHAR(50) NULL,
    shirt_collar VARCHAR(50) NULL,
    shirt_cuff VARCHAR(50) NULL,
    trouser_full_length VARCHAR(50) NULL,
    trouser_inseam VARCHAR(50) NULL,
    trouser_fly VARCHAR(50) NULL,
    trouser_u_round VARCHAR(50) NULL,
    trouser_waist VARCHAR(50) NULL,
    trouser_hip VARCHAR(50) NULL,
    trouser_thigh VARCHAR(50) NULL,
    trouser_knee VARCHAR(50) NULL,
    trouser_bottom VARCHAR(50) NULL,
    notes VARCHAR(MAX) NULL,
    isactive BIT NOT NULL DEFAULT 1,
    isdeleted BIT NOT NULL DEFAULT 0,
    rcu VARCHAR(100) NULL,
    rcm DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, GETUTCDATE()),
    luu VARCHAR(100) NULL,
    lcm DATETIME NULL,
    CONSTRAINT FK_tbl_customer_measurements_user FOREIGN KEY (user_id) REFERENCES dbo.tbl_users(user_id)
  );
  CREATE UNIQUE INDEX UX_tbl_customer_measurements_user ON dbo.tbl_customer_measurements(user_id) WHERE isdeleted = 0;
  CREATE INDEX IX_tbl_customer_measurements_active ON dbo.tbl_customer_measurements(isactive, isdeleted);
END
