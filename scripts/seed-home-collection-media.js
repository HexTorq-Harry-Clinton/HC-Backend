const fs = require('fs');

const BASE = process.env.HC_API_BASE || 'https://git-pipeline.metatronhost.in/hc/API/HARRY-CLINTON';

async function upload(filePath, type) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type }), filePath.split(/[\\/]/).pop());
  const response = await fetch(`${BASE}/FileUpload`, { method: 'POST', body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.virtualPath || data.data?.virtualPath;
}

async function save(key, value) {
  const response = await fetch(`${BASE}/Home-Settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setting_key: key, setting_value: value, setting_group: 'home', rcu: 'ADMIN_PORTAL', luu: 'ADMIN_PORTAL' }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
}

async function main() {
  const indo = await upload('../harry-clinton/public/category-pages/indo-western-hero.png', 'image/png');
  const baby = await upload('../harry-clinton/public/category-pages/baby-suits-hero.jpeg', 'image/jpeg');
  const tiles = [
    { name: 'Suits', tagline: 'For the Men Who Wear Royalty, Not Just Suits.', image_url: '', link: '/suits', order: 1, active: true },
    { name: 'Shirts', tagline: 'Sharp shirts for every hour of the day.', image_url: '', link: '/shirts', order: 2, active: true },
    { name: 'Trousers', tagline: 'Tailored trousers, cut to move with you.', image_url: '', link: '/trousers', order: 3, active: true },
    { name: 'Indo-Western', tagline: 'Heritage craft meets modern tailoring.', image_url: indo, link: '/indowestern', order: 4, active: true },
    { name: 'Baby Suits', tagline: 'Tailored from day one.', image_url: baby, link: '/babysuits', order: 5, active: true },
  ];
  await save('home_collection_json', JSON.stringify(tiles));
  console.log(JSON.stringify({ indo, baby, updated: 'home_collection_json' }));
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
