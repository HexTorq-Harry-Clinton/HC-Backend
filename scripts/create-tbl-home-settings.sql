-- Generic multipurpose key-value store for Home Screen Content (and any
-- future free-form config). ONE table, custom rows: setting_key + value.
-- Idempotent: table + seed guard included.
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'tbl_home_settings')
BEGIN
  CREATE TABLE dbo.tbl_home_settings (
    setting_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    setting_group VARCHAR(100) NOT NULL DEFAULT 'home',
    setting_key VARCHAR(255) NOT NULL,
    setting_value VARCHAR(MAX) NULL,
    display_order INT NOT NULL DEFAULT 0,
    isactive BIT NOT NULL DEFAULT 1,
    isdeleted BIT NOT NULL DEFAULT 0,
    rcu VARCHAR(100) NULL,
    rcm DATETIME NULL DEFAULT DATEADD(MINUTE, 330, GETUTCDATE()),
    luu VARCHAR(100) NULL,
    lcm DATETIME NULL
  );
  CREATE UNIQUE INDEX UX_tbl_home_settings_key ON dbo.tbl_home_settings (setting_key) WHERE isdeleted = 0;
END
