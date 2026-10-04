/*
  Idempotent seed for the five Suit occasion pages.
  The storefront already filters /Products by the relevant occasion keywords;
  these records make the reference collection names real database products.
  Existing public storefront images are reused through tbl_product_media.
*/

SET NOCOUNT ON;

DECLARE @Seed TABLE (
  product_name varchar(255) NOT NULL,
  product_slug varchar(255) NOT NULL,
  short_description varchar(500) NOT NULL,
  base_price decimal(18, 2) NOT NULL,
  original_price decimal(18, 2) NOT NULL,
  collection_display_order int NOT NULL,
  media_url varchar(1000) NOT NULL
);

INSERT INTO @Seed (product_name, product_slug, short_description, base_price, original_price, collection_display_order, media_url)
VALUES
-- Wedding
('The Royal Wedding Edit', 'the-royal-wedding-edit', 'Wedding suit for royal wedding celebrations and formal wedding events.', 30000, 36000, 1, '/brand/Wedding.jpeg'),
('The Church Affair', 'the-church-affair', 'Elegant wedding suit for church ceremonies and formal wedding occasions.', 29000, 34800, 2, '/brand/Designer.jpeg'),
('The Destination Dream', 'the-destination-dream', 'Destination wedding suit designed for refined celebrations and travel.', 28500, 34200, 3, '/brand/SmartCasual.jpeg'),
('The Reception Night', 'the-reception-night', 'Reception wedding suit for evening celebrations and black-tie events.', 31000, 37200, 4, '/brand/atelier-portrait.jpg'),
('The Engagement Chapter', 'the-engagement-chapter', 'Engagement wedding suit for elegant pre-wedding celebrations.', 30000, 36000, 5, '/brand/Wedding.jpeg'),
('The Sangeet Soirée', 'the-sangeet-soiree', 'Sangeet wedding suit for festive wedding nights and celebrations.', 27500, 33000, 6, '/brand/Designer.jpeg'),
('The Mehendi & Haldi Mood', 'the-mehendi-haldi-mood', 'Mehendi and haldi wedding suit for vibrant pre-wedding occasions.', 26500, 31800, 7, '/brand/SmartCasual.jpeg'),
('The Intimate Wedding Edit', 'the-intimate-wedding-edit', 'Intimate wedding suit for smaller ceremonies and elegant gatherings.', 28000, 33600, 8, '/brand/atelier-portrait.jpg'),
('The Modern Minimalist', 'the-modern-minimalist-wedding-suit', 'Modern minimalist wedding suit for understated formal celebrations.', 29500, 35400, 9, '/brand/Wedding.jpeg'),
-- Business
('Executive Charcoal Suit', 'executive-charcoal-suit', 'Executive business suit for corporate meetings and formal office dressing.', 26000, 31200, 1, '/brand/Designer.jpeg'),
('Navy Business Suit', 'navy-business-suit', 'Navy business suit for polished professional and formal occasions.', 25500, 30600, 2, '/brand/Wedding.jpeg'),
('Black Formal Suit', 'black-formal-suit', 'Black formal business suit for office, corporate, and evening dressing.', 27000, 32400, 3, '/brand/atelier-portrait.jpg'),
('Beige Office Suit', 'beige-office-suit', 'Beige office suit for warm-weather business and formal styling.', 24500, 29400, 4, '/brand/SmartCasual.jpeg'),
('Pinstripe Power Suit', 'pinstripe-power-suit', 'Pinstripe business suit for confident corporate and formal dressing.', 28000, 33600, 5, '/brand/Designer.jpeg'),
('Light Blue Formal Suit', 'light-blue-formal-suit', 'Light blue formal suit for modern business and office occasions.', 25000, 30000, 6, '/brand/Wedding.jpeg'),
('Dark Brown Business Suit', 'dark-brown-business-suit', 'Dark brown business suit for refined office and formal wardrobes.', 25500, 30600, 7, '/brand/SmartCasual.jpeg'),
('Checkered Formal Suit', 'checkered-formal-suit', 'Checkered formal suit for contemporary business and corporate style.', 27500, 33000, 8, '/brand/atelier-portrait.jpg'),
('Slim Fit Grey Suit', 'slim-fit-grey-suit', 'Slim fit grey business suit for sharp professional dressing.', 26500, 31800, 9, '/brand/Designer.jpeg'),
-- Designer
('Midnight Designer Suit', 'midnight-designer-suit', 'Luxury designer suit for premium evening fashion and formal events.', 36000, 43200, 1, '/brand/Designer.jpeg'),
('Velvet Designer Blazer', 'velvet-designer-blazer', 'Velvet designer blazer for luxury evening and statement styling.', 34000, 40800, 2, '/brand/Wedding.jpeg'),
('Signature Designer Suit', 'signature-designer-suit', 'Signature designer suit crafted for premium modern fashion.', 38000, 45600, 3, '/brand/atelier-portrait.jpg'),
('Modern Cut Designer Suit', 'modern-cut-designer-suit', 'Modern cut designer suit with sharp contemporary tailoring.', 35000, 42000, 4, '/brand/SmartCasual.jpeg'),
('Royal Designer Suit', 'royal-designer-suit', 'Royal designer suit crafted for luxury formal and ceremonial dressing.', 42000, 50400, 5, '/brand/Designer.jpeg'),
('Designer Party Suit', 'designer-party-suit', 'Designer party suit for stylish evening events and celebrations.', 33000, 39600, 6, '/brand/Wedding.jpeg'),
('Luxury Textured Suit', 'luxury-textured-suit', 'Luxury textured designer suit with rich fabric and distinctive detail.', 39500, 47400, 7, '/brand/atelier-portrait.jpg'),
('Fusion Designer Outfit', 'fusion-designer-outfit', 'Fusion designer outfit blending modern tailoring with expressive style.', 37000, 44400, 8, '/brand/SmartCasual.jpeg'),
('Signature Black Designer Suit', 'signature-black-designer-suit', 'Signature black designer suit for elevated luxury formal dressing.', 40000, 48000, 9, '/brand/Designer.jpeg'),
-- Travel
('Urban Traveler Jacket', 'urban-traveler-jacket', 'Travel jacket designed for comfort, movement, and refined journeys.', 22000, 26400, 1, '/brand/SmartCasual.jpeg'),
('Explorer Casual Blazer', 'explorer-casual-blazer', 'Travel casual blazer for effortless style and comfortable movement.', 23000, 27600, 2, '/brand/Designer.jpeg'),
('Jetsetter Linen Suit', 'jetsetter-linen-suit', 'Travel linen suit for warm destinations and relaxed formal dressing.', 25000, 30000, 3, '/brand/Wedding.jpeg'),
('Nomad Stretch Suit', 'nomad-stretch-suit', 'Travel stretch suit designed for comfort during long journeys.', 24500, 29400, 4, '/brand/SmartCasual.jpeg'),
('Weekender Relaxed Blazer', 'weekender-relaxed-blazer', 'Travel relaxed blazer for weekend trips and casual styling.', 21500, 25800, 5, '/brand/atelier-portrait.jpg'),
('All Weather Travel Coat', 'all-weather-travel-coat', 'Travel coat designed for versatile styling across different climates.', 28500, 34200, 6, '/brand/Designer.jpeg'),
('Minimalist Travel Set', 'minimalist-travel-set', 'Minimalist travel suit set for clean, comfortable, and refined journeys.', 24000, 28800, 7, '/brand/Wedding.jpeg'),
('Adventure Hybrid Suit', 'adventure-hybrid-suit', 'Adventure travel suit balancing flexibility, comfort, and tailoring.', 26000, 31200, 8, '/brand/SmartCasual.jpeg'),
('Airport Luxe Suit', 'airport-luxe-suit', 'Airport travel suit for polished comfort before and after every journey.', 27000, 32400, 9, '/brand/atelier-portrait.jpg'),
-- Smart casual
('Smart Beige Blazer Set', 'smart-beige-blazer-set', 'Smart casual beige blazer set for refined everyday dressing.', 21000, 25200, 1, '/brand/SmartCasual.jpeg'),
('Navy Casual Blazer', 'navy-casual-blazer', 'Smart casual navy blazer combining comfort with polished style.', 20500, 24600, 2, '/brand/Designer.jpeg'),
('Light Grey Casual Suit', 'light-grey-casual-suit', 'Smart casual light grey suit for modern relaxed occasions.', 23500, 28200, 3, '/brand/Wedding.jpeg'),
('Olive Green Blazer Set', 'olive-green-blazer-set', 'Smart casual olive blazer set for a bold relaxed statement.', 22000, 26400, 4, '/brand/SmartCasual.jpeg'),
('Cream Smart Jacket', 'cream-smart-jacket', 'Smart casual cream jacket offering soft elegance and comfort.', 19500, 23400, 5, '/brand/atelier-portrait.jpg'),
('Blue Textured Casual Suit', 'blue-textured-casual-suit', 'Smart casual blue textured suit combining style and comfort.', 24500, 29400, 6, '/brand/Designer.jpeg'),
('Brown Linen Casual Set', 'brown-linen-casual-set', 'Smart casual brown linen set for breathable summer styling.', 21500, 25800, 7, '/brand/Wedding.jpeg'),
('Charcoal Smart Casual Suit', 'charcoal-smart-casual-suit', 'Smart casual charcoal suit balancing relaxed and formal dressing.', 24000, 28800, 8, '/brand/SmartCasual.jpeg'),
('Checkered Casual Blazer', 'checkered-casual-blazer', 'Smart casual checkered blazer for contemporary everyday style.', 20500, 24600, 9, '/brand/atelier-portrait.jpg');

DECLARE @Inserted TABLE (product_id varchar(36), product_slug varchar(255));

INSERT INTO dbo.tbl_products (
  product_name, product_slug, short_description, description,
  base_price, original_price, currency_code, collection_display_order,
  isactive, isdeleted, rcu, rcm
)
OUTPUT INSERTED.product_id, INSERTED.product_slug INTO @Inserted (product_id, product_slug)
SELECT
  s.product_name,
  s.product_slug,
  s.short_description,
  s.short_description,
  s.base_price,
  s.original_price,
  'inr',
  s.collection_display_order,
  1,
  0,
  'seed:suit-occasion',
  DATEADD(MINUTE, 330, GETUTCDATE())
FROM @Seed s
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.tbl_products p
  WHERE p.product_slug = s.product_slug AND p.isdeleted = 0
);

INSERT INTO dbo.tbl_product_media (
  product_id, media_type, media_url, alt_text, display_order,
  isprimary, isactive, isdeleted, rcu, rcm
)
SELECT
  p.product_id,
  'image',
  s.media_url,
  s.product_name,
  1,
  1,
  1,
  0,
  'seed:suit-occasion',
  DATEADD(MINUTE, 330, GETUTCDATE())
FROM dbo.tbl_products p
JOIN @Seed s ON s.product_slug = p.product_slug
WHERE p.isdeleted = 0
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.tbl_product_media m
    WHERE m.product_id = p.product_id
      AND m.isprimary = 1
      AND m.isdeleted = 0
  );

SELECT p.product_id, p.product_name, p.product_slug
FROM dbo.tbl_products p
JOIN @Seed s ON s.product_slug = p.product_slug
WHERE p.isdeleted = 0
ORDER BY p.product_slug;
