/*
  Create the five Suit occasion product sets through the live API.

  Usage:
    $env.HC_API_TOKEN = "<admin-token>"
    node scripts/seed-suit-occasion-products-api.js

  The script is idempotent: existing product slugs and primary media are
  reused, while missing records are created.
*/

const API_BASE = process.env.HC_API_BASE || "https://git-pipeline.metatronhost.in/hc/API/HARRY-CLINTON";
const TOKEN = process.env.HC_API_TOKEN || "";

const groups = [
  {
    key: "wedding",
    names: [
      "The Royal Wedding Edit", "The Church Affair", "The Destination Dream",
      "The Reception Night", "The Engagement Chapter", "The Sangeet Soirée",
      "The Mehendi & Haldi Mood", "The Intimate Wedding Edit", "The Modern Minimalist",
    ],
  },
  {
    key: "business",
    names: [
      "Executive Charcoal Suit", "Navy Business Suit", "Black Formal Suit",
      "Beige Office Suit", "Pinstripe Power Suit", "Light Blue Formal Suit",
      "Dark Brown Business Suit", "Checkered Formal Suit", "Slim Fit Grey Suit",
    ],
  },
  {
    key: "designer",
    names: [
      "Midnight Designer Suit", "Velvet Designer Blazer", "Signature Designer Suit",
      "Modern Cut Designer Suit", "Royal Designer Suit", "Designer Party Suit",
      "Luxury Textured Suit", "Fusion Designer Outfit", "Signature Black Designer Suit",
    ],
  },
  {
    key: "travel",
    names: [
      "Urban Traveler Jacket", "Explorer Casual Blazer", "Jetsetter Linen Suit",
      "Nomad Stretch Suit", "Weekender Relaxed Blazer", "All Weather Travel Coat",
      "Minimalist Travel Set", "Adventure Hybrid Suit", "Airport Luxe Suit",
    ],
  },
  {
    key: "smart-casual",
    names: [
      "Smart Beige Blazer Set", "Navy Casual Blazer", "Light Grey Casual Suit",
      "Olive Green Blazer Set", "Cream Smart Jacket", "Blue Textured Casual Suit",
      "Brown Linen Casual Set", "Charcoal Smart Casual Suit", "Checkered Casual Blazer",
    ],
  },
];

const images = ["/brand/Wedding.jpeg", "/brand/Designer.jpeg", "/brand/SmartCasual.jpeg", "/brand/atelier-portrait.jpg"];

const slugify = (value) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^\w\s-]/g, "")
  .trim()
  .replace(/[\s_-]+/g, "-");

const unwrap = (body) => body?.data?.data || body?.data || [];

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} ${response.status}: ${body.message || text}`);
  return body;
}

async function main() {
  const existingProducts = unwrap(await request("/Products?pageSize=200"));
  const existingMedia = unwrap(await request("/Products-Media"));
  let created = 0;
  let mediaCreated = 0;

  for (const group of groups) {
    for (const [index, name] of group.names.entries()) {
      const slug = slugify(name);
      let product = existingProducts.find((item) => item.product_slug === slug && !item.isdeleted);
      if (!product) {
        const createdResponse = await request("/Products", {
          method: "POST",
          body: JSON.stringify({
            product_name: name,
            product_slug: slug,
            short_description: `${name} for ${group.key} menswear and refined tailoring.`,
            description: `${name} is a ${group.key} suit designed for the Harry Clinton collection.`,
            base_price: 22000 + index * 1000,
            original_price: 26400 + index * 1200,
            currency_code: "inr",
            collection_display_order: index + 1,
            rcu: "api-seed:suit-occasion",
          }),
        });
        product = createdResponse.data || createdResponse;
        existingProducts.push(product);
        created += 1;
      }

      const hasPrimary = existingMedia.some(
        (item) => String(item.product_id) === String(product.product_id) && (item.isprimary === true || item.isprimary === 1) && !item.isdeleted
      );
      if (!hasPrimary) {
        const mediaResponse = await request("/Products-Media", {
          method: "POST",
          body: JSON.stringify({
            product_id: product.product_id,
            media_type: "image",
            media_url: images[index % images.length],
            alt_text: name,
            display_order: 1,
            isprimary: 1,
            rcu: "api-seed:suit-occasion",
          }),
        });
        existingMedia.push(mediaResponse.data || mediaResponse);
        mediaCreated += 1;
      }
    }
  }

  console.log(`Suit occasion seed complete: ${created} products created, ${mediaCreated} media records created.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
