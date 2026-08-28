const https = require('https');
const { extractCorroboratedModel } = require('../src/catalog/corroborateModel');
const { isGenericBrandOrCategory, cleanText } = require('../src/ingestion/sources/eezepc/mapper');

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

function extractBrandWithCategories(raw) {
  if (Array.isArray(raw.categories)) {
    for (const cat of raw.categories) {
      const cleanCatName = cleanText(cat.name);
      if (cleanCatName && !isGenericBrandOrCategory(cleanCatName)) {
        return cleanCatName;
      }
    }
  }
  return undefined;
}

async function testHeadsets() {
  console.log('=== EEZEPC Headsets (page 1, 10 items) ===');
  const eezeHeadsets = await fetchJson('https://eezepc.com/wp-json/wc/store/v1/products?category=headsets&per_page=10');
  eezeHeadsets.forEach((raw, i) => {
    const brand = extractBrandWithCategories(raw);
    const modelInfo = extractCorroboratedModel({
      brand,
      title: cleanText(raw.name),
      sku: raw.sku,
      attributes: raw.attributes
    });
    console.log(`[${i+1}] ID: ${raw.id} | Brand: ${brand} | Model: ${modelInfo.model} (${modelInfo.modelIdentitySource}) | Sku: "${raw.sku}" | Title: "${raw.name.slice(0, 45)}..."`);
  });
}

testHeadsets();
