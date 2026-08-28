const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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

async function inspectEezepcRaw() {
  const eeze = await fetchJson('https://eezepc.com/wp-json/wc/store/v1/products?category=laptops&per_page=3');
  console.log('Sample EEZEPC raw product:');
  console.log(JSON.stringify({
    id: eeze[0].id,
    name: eeze[0].name,
    sku: eeze[0].sku,
    categories: eeze[0].categories,
    attributes: eeze[0].attributes,
    brands: eeze[0].brands,
    brand: eeze[0].brand
  }, null, 2));

  // Let's check headphone raw product
  const eezeH = await fetchJson('https://eezepc.com/wp-json/wc/store/v1/products?category=headphones&per_page=2');
  console.log('\nSample EEZEPC Headphone raw product:');
  console.log(JSON.stringify({
    id: eezeH[0].id,
    name: eezeH[0].name,
    sku: eezeH[0].sku,
    categories: eezeH[0].categories,
    attributes: eezeH[0].attributes,
    brands: eezeH[0].brands,
    brand: eezeH[0].brand
  }, null, 2));
}

inspectEezepcRaw();
