const mongoose = require('mongoose');
const { fetchProducts } = require('./src/ingestion/sources/eezepc/client');
const { mapProduct } = require('./src/ingestion/sources/eezepc/mapper');

async function run() {
  try {
    const rawProducts = await fetchProducts({ page: 1, perPage: 20 });
    console.log(`Fetched ${rawProducts.length} products`);
    
    for (const raw of rawProducts) {
      try {
        const mapped = mapProduct(raw);
        console.log(`- ${mapped.name}`);
        console.log(`  Category: ${mapped.category}`);
        console.log(`  Brand: ${mapped.brand === undefined ? 'UNDEFINED' : mapped.brand}`);
      } catch (err) {
        // skip unsupported
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
