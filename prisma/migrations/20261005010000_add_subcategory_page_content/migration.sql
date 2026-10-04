IF OBJECT_ID(N'dbo.tbl_subcategory_page_content', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.tbl_subcategory_page_content (
    subcategory_page_content_id varchar(36) NOT NULL CONSTRAINT pk_tbl_subcategory_page_content PRIMARY KEY DEFAULT CONVERT(varchar(36), NEWID()),
    subcategory_slug varchar(100) NOT NULL,
    category_group varchar(100) NULL,
    hero_title varchar(255) NULL,
    hero_subtitle varchar(500) NULL,
    hero_video_url varchar(1000) NULL,
    marquee_words_json varchar(max) NULL,
    left_image_url varchar(1000) NULL,
    center_video_url varchar(1000) NULL,
    right_image_url varchar(1000) NULL,
    slider_images_json varchar(max) NULL,
    slider_image_1_url varchar(1000) NULL,
    slider_image_2_url varchar(1000) NULL,
    slider_image_3_url varchar(1000) NULL,
    description_title varchar(255) NULL,
    description_text varchar(max) NULL,
    label_video_url varchar(1000) NULL,
    label_image_url varchar(1000) NULL,
    footer_text varchar(255) NULL,
    display_order int NOT NULL CONSTRAINT df_tbl_subcategory_page_content_order DEFAULT 0,
    isactive bit NOT NULL CONSTRAINT df_tbl_subcategory_page_content_active DEFAULT 1,
    isdeleted bit NOT NULL CONSTRAINT df_tbl_subcategory_page_content_deleted DEFAULT 0,
    rcu varchar(100) NULL,
    rcm datetime NOT NULL CONSTRAINT df_tbl_subcategory_page_content_created DEFAULT DATEADD(MINUTE, 330, GETUTCDATE()),
    luu varchar(100) NULL,
    lcm datetime NULL
  );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_tbl_subcategory_page_content_slug' AND object_id = OBJECT_ID('dbo.tbl_subcategory_page_content'))
  CREATE UNIQUE INDEX ux_tbl_subcategory_page_content_slug ON dbo.tbl_subcategory_page_content(subcategory_slug) WHERE isdeleted = 0;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_tbl_subcategory_page_content_group' AND object_id = OBJECT_ID('dbo.tbl_subcategory_page_content'))
  CREATE INDEX ix_tbl_subcategory_page_content_group ON dbo.tbl_subcategory_page_content(category_group, display_order);
