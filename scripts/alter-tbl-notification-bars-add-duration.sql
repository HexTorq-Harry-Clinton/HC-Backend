-- One-time DBA run: per-item hold seconds for the notification bar train.
-- Existing rows default to 4 seconds (matches the previous fixed hold).
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.tbl_notification_bars') AND name = 'duration_seconds'
)
BEGIN
  ALTER TABLE dbo.tbl_notification_bars
    ADD duration_seconds INT NOT NULL DEFAULT 4;
END
