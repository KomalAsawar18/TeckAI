const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: e.message, raw: data.slice(0, 200) });
        }
      });
    }).on('error', reject);
  });
}

async function probeEezepc() {
  console.log('=== Fetching all EEZEPC categories for Laptops and Headphones ===');
  let allEeze = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetchJson(`https://eezepc.com/wp-json/wc/store/v1/products/categories?page=${page}&per_page=100`);
    if (!Array.isArray(res) || res.length === 0) break;
    allEeze = allEeze.concat(res);
  }
  
  const laptopCats = allEeze.filter(c => {
    const s = (c.slug || '').toLowerCase();
    const n = (c.name || '').toLowerCase();
    return s.includes('laptop') || n.includes('laptop') || s.includes('notebook') || n.includes('notebook');
  });
  console.log('EEZEPC Laptop Categories:');
  laptopCats.forEach(c => console.log(`  ID: ${c.id}, Name: "${c.name}", Slug: "${c.slug}", Count: ${c.count}, Parent: ${c.parent}`));

  const headphoneCats = allEeze.filter(c => {
    const s = (c.slug || '').toLowerCase();
    const n = (c.name || '').toLowerCase();
    return s.includes('headphone') || n.includes('headphone') || s.includes('headset') || n.includes('headset');
  });
  console.log('\nEEZEPC Headphone Categories:');
  headphoneCats.forEach(c => console.log(`  ID: ${c.id}, Name: "${c.name}", Slug: "${c.slug}", Count: ${c.count}, Parent: ${c.parent}`));

  // Check parent 3566 (what is parent 3566 in EEZEPC?)
  const p3566 = allEeze.find(c => c.id === 3566);
  console.log('\nParent 3566:', p3566);

  // Test category filtering on EEZEPC
  console.log('\n--- Testing EEZEPC category queries ---');
  // Laptops: test category=laptops, category=3566, etc.
  const testUrls = [
    'https://eezepc.com/wp-json/wc/store/v1/products?category=3566&per_page=3',
    'https://eezepc.com/wp-json/wc/store/v1/products?category=laptops&per_page=3',
    'https://eezepc.com/wp-json/wc/store/v1/products?category=apple-laptops&per_page=3',
    'https://eezepc.com/wp-json/wc/store/v1/products?category=asus-laptops&per_page=3',
    'https://eezepc.com/wp-json/wc/store/v1/products?category=9159&per_page=3',
    'https://eezepc.com/wp-json/wc/store/v1/products?category=headphones&per_page=3',
    'https://eezepc.com/wp-json/wc/store/v1/products?category=60&per_page=3',
    'https://eezepc.com/wp-json/wc/store/v1/products?category=headsets&per_page=3'
  ];

  for (const u of testUrls) {
    const r = await fetchJson(u);
    console.log(`URL: ${u}`);
    if (Array.isArray(r)) {
      console.log(`  Count: ${r.length}`);
      if (r.length > 0) {
        console.log(`  Sample 1: "${r[0].name}" (Cats: ${r[0].categories.map(c => `${c.id}:${c.slug}`).join(', ')})`);
      }
    } else {
      console.log(`  Error:`, r);
    }
  }

  // Also check if Infinity Store has any laptop categories
  console.log('\n--- Checking Infinity Store for Laptops ---');
  let allInf = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetchJson(`https://infinitystore.pk/wp-json/wc/store/v1/products/categories?page=${page}&per_page=100`);
    if (!Array.isArray(res) || res.length === 0) break;
    allInf = allInf.concat(res);
  }
  const infLaptops = allInf.filter(c => {
    const s = (c.slug || '').toLowerCase();
    const n = (c.name || '').toLowerCase();
    return s.includes('laptop') || n.includes('laptop') || s.includes('notebook') || n.includes('notebook');
  });
  console.log('Infinity Laptop categories count:', infLaptops.length);
  infLaptops.forEach(c => console.log(`  ID: ${c.id}, Name: "${c.name}", Slug: "${c.slug}"`));
}

probeEezepc();
