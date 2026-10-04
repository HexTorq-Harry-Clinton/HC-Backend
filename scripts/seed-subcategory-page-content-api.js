/* Seed all 25 subcategory page content rows through the API. */
const API_BASE = process.env.HC_API_BASE || "https://git-pipeline.metatronhost.in/hc/API/HARRY-CLINTON";
const TOKEN = process.env.HC_API_TOKEN || "";
const SUBTITLE = "For the Men Who Wear Royalty, Not Just Suits.";
const DESCRIPTION = "Command attention with this masterpiece of craftsmanship: a luxurious black velvet tuxedo intricately hand-embroidered with golden threadwork and shimmering sequins. The blazer features an ornate front design, extending seamlessly to an equally detailed back, showcasing royal patterns inspired by heritage artistry. Paired with a sleek black shirt, bow tie, and trousers, the look is finished with a golden pocket square for the perfect touch of elegance.\n\nThis outfit blends modern tailoring with timeless hand embroidery, making it the ideal choice for weddings, receptions, red carpet events, and any occasion where sophistication meets grandeur.";
const media = {
  hero_video_url: "/brand/wedding-page.mp4",
  left_image_url: "/brand/Wedding.jpeg",
  center_video_url: "/brand/wedding-center.mp4",
  right_image_url: "/brand/Designer.jpeg",
  slider_image_1_url: "/brand/Wedding.jpeg",
  slider_image_2_url: "/brand/Designer.jpeg",
  slider_image_3_url: "/brand/SmartCasual.jpeg",
  label_video_url: "/brand/wedding-label.mp4",
  label_image_url: "/brand/SmartCasual.jpeg",
};

const groups = [
  ["suits", [["wedding", "Wedding", "The Wedding Edit", "The Wedding Collection"], ["business", "Business", "The Business Edit", "The Business Collection"], ["designer", "Designer", "The Designer Edit", "The Designer Collection"], ["travel", "Travel", "The Travel Edit", "The Travel Collection"], ["smart-casual", "Smart casual", "The Smart casual Edit", "The Smart casual Collection"]]],
  ["babysuits", [["wedding-baby", "Wedding & Ring Bearer Suits", "The Wedding & Ring Bearer Suits Edit", "The Wedding & Ring Bearer Suits Collection"], ["business-baby", "Business Baby Suits", "The Business Baby Suits Edit", "The Business Baby Suits Collection"], ["designer-baby", "Designer Baby Suits", "The Designer Baby Suits Edit", "The Designer Baby Suits Collection"], ["travel-baby", "Travel Baby Suits", "The Travel Baby Suits Edit", "The Travel Baby Suits Collection"], ["casual-baby", "Smart Casual Baby Suits", "The Smart Casual Baby Suits Edit", "The Smart Casual Baby Suits Collection"]]],
  ["indowestern", [["indo-wedding", "Wedding Indo Western", "The Wedding Indo Western Edit", "The Wedding Indo Western Collection"], ["indo-business", "Business Indo Western", "The Business Indo Western Edit", "The Business Indo Western Collection"], ["indo-designer", "Designer IW", "The Designer IW Edit", "The Designer IW Collection"], ["indo-travel", "Travel Indo Western", "The Travel Indo Western Edit", "The Travel Indo Western Collection"], ["indo-casual", "Smart Casual Indo Western", "The Smart Casual Indo Western Edit", "The Smart Casual Indo Western Collection"]]],
  ["shirts", [["wedding-shirts", "Wedding Shirts", "The Wedding Shirts Edit", "The Wedding Shirts Collection"], ["business-shirts", "Business", "The Business Edit", "The Business Collection"], ["designer-shirts", "Designer", "The Designer Edit", "The Designer Collection"], ["travel-shirts", "Travel Shirts", "The Travel Shirts Edit", "The Travel Shirts Collection"], ["casual-shirts", "Casual", "The Casual Edit", "The Casual Collection"]]],
  ["trousers", [["wedding-trouser", "Wedding Trousers", "The Wedding Trousers Edit", "The Wedding Trousers Collection"], ["business-trouser", "Business Trousers", "The Business Trousers Edit", "The Business Trousers Collection"], ["designer-trouser", "Designer", "The Designer Edit", "The Designer Collection"], ["travel-trouser", "Travel Trousers", "The Travel Trousers Edit", "The Travel Trousers Collection"], ["smart-casual-trouser", "Casual", "The Casual Edit", "The Casual Collection"]]],
];

const pages = groups.flatMap(([category_group, entries]) => entries.map(([subcategory_slug, hero_title, description_title, footer_text], index) => ({
  subcategory_slug, category_group, hero_title, hero_subtitle: SUBTITLE,
  marquee_words_json: JSON.stringify([hero_title]), description_title, description_text: DESCRIPTION, footer_text,
  display_order: index + 1, rcu: "api-seed:subcategory-content", ...media,
})));

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}), ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = {}; try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} ${response.status}: ${body.message || text}`);
  return body;
}

const unwrap = (body) => body?.data?.data || body?.data || body;

async function main() {
  const existing = unwrap(await request("/Subcategory-Content"));
  let created = 0; let updated = 0;
  for (const page of pages) {
    const current = existing.find((item) => item.subcategory_slug === page.subcategory_slug);
    if (current) {
      await request("/Subcategory-Content", { method: "PUT", body: JSON.stringify({ subcategory_page_content_id: current.subcategory_page_content_id, ...page }) });
      updated += 1;
    } else {
      await request("/Subcategory-Content", { method: "POST", body: JSON.stringify(page) });
      created += 1;
    }
  }
  console.log(`Subcategory content seed complete: ${created} created, ${updated} updated.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
