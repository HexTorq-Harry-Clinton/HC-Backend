IF COL_LENGTH('dbo.tbl_addresses', 'emailid') IS NULL
BEGIN
  ALTER TABLE [dbo].[tbl_addresses]
    ADD [emailid] VARCHAR(255) NULL;
END;
