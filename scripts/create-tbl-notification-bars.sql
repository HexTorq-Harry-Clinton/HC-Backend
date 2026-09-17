-- One-time DBA run for the top black strip (notification bar).
-- Creates dbo.tbl_notification_bars per the approved schema.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'tbl_notification_bars' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.tbl_notification_bars (
    notification_bar_id VARCHAR(36) NOT NULL
      CONSTRAINT PK_tbl_notification_bars PRIMARY KEY
      DEFAULT CONVERT(VARCHAR(36), NEWID()),
    notification_text VARCHAR(MAX) NOT NULL,
    orderpriority INT NOT NULL DEFAULT 1,
    isactive BIT NOT NULL DEFAULT 1,
    isdeleted BIT NOT NULL DEFAULT 0,
    rcu VARCHAR(100) NULL,
    rcm DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, GETUTCDATE()),
    luu VARCHAR(100) NULL,
    lcm DATETIME NULL
  );
  CREATE INDEX IX_tbl_notification_bars_order
    ON dbo.tbl_notification_bars (orderpriority ASC)
    WHERE isdeleted = 0;
END
