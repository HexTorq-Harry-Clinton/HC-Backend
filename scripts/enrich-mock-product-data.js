const BASE = process.env.HC_API_BASE || 'https://git-pipeline.metatronhost.in/hc/API/HARRY-CLINTON';

async function api(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`${BASE}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const text = await response.text();
      let payload;
      try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} ${response.status}: ${text.slice(0, 300)}`);
      return payload.data ?? payload;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

const list = (value) => Array.isArray(value) ? value : [];
const unique = (values) => [...new Set(values.filter(Boolean).map(String))];
const text = (product) => `${product.product_name || ''} ${product.short_description || ''} ${product.description || ''}`.toLowerCase();
const isApparel = (value) => !/\b(88|cigarette|flavor|smok|menthol|tobacco|lights|bold red)\b/i.test(value);

function detailsFor(product, clothNames) {
  const source = text(product);
  const apparel = isApparel(source);
  const tailored = /suit|blazer|jacket|coat|gurkha|poppins|trouser|wedding|outfit|set\b/i.test(source);
  const shirt = /shirt|shacket/i.test(source);
  const slim = /slim|tailored|fitted/i.test(source);
  const relaxed = /relaxed|oversized|baggy|loose/i.test(source);
  const knit = /knit|knitted|sweater|jersey/i.test(source);
  const fabric = clothNames.length
    ? `Fabric selected for this piece: ${clothNames.join(', ')}.`
    : /linen/i.test(source) ? 'Linen-inspired construction.'
      : /velvet/i.test(source) ? 'Velvet construction.'
        : /cotton/i.test(source) ? 'Cotton construction.'
          : apparel ? 'Signature Harry Clinton apparel cloth.'
            : 'Material details are based on the current product listing.';
  const trims = /embroid|crystal|stone|katdana|shimmer|silver work|floral|print/i.test(source)
    ? 'Decorative finish referenced in the product name or description.'
    : tailored ? 'Tailored buttons and finishing hardware.'
      : shirt ? 'Signature buttons and finishing hardware.'
        : 'Finishing details follow the product listing.';
  const special = /embroid|crystal|stone|katdana|shimmer|silver work|floral|print|textur|houndstooth|pinstripe/i.test(source)
    ? 'Pattern, embroidery, embellishment, or texture referenced in the product listing.'
    : 'Clean signature finishing as represented in the product listing.';
  return {
    product_id: product.product_id,
    fabric_details: fabric,
    trims_used: trims,
    special_detailing: special,
    lining_details: tailored ? 'Structured internal lining for shape and comfort.' : apparel ? 'Lightweight internal finishing.' : 'Not applicable to this product type.',
    product_fit: !apparel ? 'Not applicable to this product type.' : slim ? 'Slim fit' : relaxed ? 'Relaxed fit' : 'Regular fit',
    model_fit: 'Model fit information is not included in the current listing.',
    construction_type: !apparel ? 'Not applicable to this product type.' : knit ? 'Knitted' : 'Woven',
    sleeve_type: apparel && !/trouser/i.test(source) ? (shirt || tailored ? 'Full sleeve' : 'Sleeve detail as shown in product imagery') : 'Not applicable to this product type.',
    sleeve_pattern: apparel && !/trouser/i.test(source) ? 'Classic set-in sleeve construction.' : 'Not applicable to this product type.',
    wash_care: !apparel ? 'Follow the care and handling instructions supplied with this product.' : tailored ? 'Dry clean only and store on a broad contoured hanger.' : 'Gentle wash or dry clean according to the final garment care label.',
    sleeve_length: apparel && !/trouser/i.test(source) ? 'Full length' : 'Not applicable to this product type.',
    rcu: 'MOCK_DATA_ENRICHMENT',
  };
}

function measurementFor(sizeName) {
  const label = String(sizeName || '').trim().toUpperCase();
  const alpha = { XS: 34, S: 36, M: 38, L: 40, XL: 42, XXL: 44, XXXL: 46 };
  const chest = alpha[label] || (Number(label) ? Number(label) + 8 : 38);
  const waist = Number(label) || Math.round(chest - 4);
  return { chest, waist, hip: waist + 10, shoulder: Math.round((chest / 2) * 0.9 * 10) / 10, sleeve_length: label === 'XS' ? 24 : label === 'S' ? 24.5 : label === 'M' ? 25 : label === 'L' ? 25.5 : 26 };
}

async function runPool(items, worker, concurrency = 8) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const [products, variants, media, clothTypes, sizes] = await Promise.all([
    api('/Products?page=1&pageSize=1000'),
    api('/Products-Variants?page=1&pageSize=2000'),
    api('/Products-Media?page=1&pageSize=5000'),
    api('/Products-Cloth-Types?page=1&pageSize=500'),
    api('/Products-Sizes?page=1&pageSize=500'),
  ]);
  const productList = list(products);
  const variantList = list(variants);
  const mediaList = list(media);
  const clothList = list(clothTypes);
  const sizeList = list(sizes);
  let detailCount = 0;
  await runPool(productList, async (product) => {
    const names = unique(variantList.filter((variant) => String(variant.product_id) === String(product.product_id)).map((variant) => clothList.find((cloth) => String(cloth.cloth_type_id) === String(variant.cloth_type_id))?.cloth_type_name));
    await api('/Product-Details', { method: 'PUT', body: detailsFor(product, names) });
    detailCount += 1;
  });

  const roleCounters = { front: 0, side: 0, back: 0, 'close-up': 0, detailing: 0, video: 0 };
  const groupedMedia = new Map();
  for (const item of mediaList) {
    const key = `${item.product_id}|${item.product_variant_id || 'product'}`;
    if (!groupedMedia.has(key)) groupedMedia.set(key, []);
    groupedMedia.get(key).push(item);
  }
  for (const items of groupedMedia.values()) items.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  await runPool(mediaList, async (item) => {
    const items = groupedMedia.get(`${item.product_id}|${item.product_variant_id || 'product'}`) || [item];
    const position = items.findIndex((candidate) => candidate.product_media_id === item.product_media_id);
    const role = item.media_type === 'video' ? 'video' : position === 0 || item.isprimary ? 'front' : position === 1 ? 'side' : position === 2 ? 'back' : position === 3 ? 'close-up' : 'detailing';
    await api('/Products-Media', { method: 'PUT', body: { product_media_id: item.product_media_id, media_role: role, luu: 'MOCK_DATA_ENRICHMENT' } });
    roleCounters[role] += 1;
  });

  const productSizePairs = [];
  for (const product of productList) {
    const seen = new Set();
    for (const variant of variantList.filter((candidate) => String(candidate.product_id) === String(product.product_id) && candidate.size_id)) {
      if (!seen.has(variant.size_id)) {
        const size = sizeList.find((candidate) => String(candidate.size_id) === String(variant.size_id));
        if (size) productSizePairs.push({ product_id: product.product_id, size_id: size.size_id, size_name: size.size_name });
        seen.add(variant.size_id);
      }
    }
  }
  await runPool(productSizePairs, async (pair) => {
    await api('/Products-Size-Charts', { method: 'PUT', body: { product_id: pair.product_id, size_id: pair.size_id, unit: 'in', ...measurementFor(pair.size_name) } });
  });

  console.log(JSON.stringify({ products: productList.length, detailsPopulated: detailCount, mediaRolesPopulated: mediaList.length, roleCounters, sizeMeasurementsPopulated: productSizePairs.length }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
