const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { getCanonicalCatalog, getCanonicalProductById } = require('../src/commerce/getCanonicalCatalog');

async function runLiveValidation() {
  console.log('=== Step 3E.1 — Live Canonical Catalog Read Validation (Strictly Read-Only) ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Fetch full catalog without mutating DB
  console.log('--- 1. Fetching Full Canonical Catalog (GET /api/canonical-products) ---');
  const catalog = await getCanonicalCatalog({ page: 1, limit: 20 });
  console.log('Pagination:', JSON.stringify(catalog.pagination, null, 2));
  console.log(`Total Products Returned: ${catalog.products.length}\n`);

  console.log('Sanitized Products in Catalog:');
  catalog.products.forEach((p, idx) => {
    console.log(`\n[Product ${idx + 1}] ID: ${p.id}`);
    console.log(`  Name: "${p.name}"`);
    console.log(`  Brand: ${p.brand}, Model: ${p.model}`);
    console.log(`  Category: ${p.category?.name} (${p.category?.slug})`);
    console.log(`  Offer Count: ${p.offerCount}, Seller Count: ${p.sellerCount}, Source Count: ${p.sourceCount}`);
    if (p.bestOffer) {
      console.log(`  Best Offer:`);
      console.log(`    ID: ${p.bestOffer.id}`);
      console.log(`    Seller: ${p.bestOffer.seller}`);
      console.log(`    Price: Rs. ${p.bestOffer.price} ${p.bestOffer.currency}`);
      console.log(`    Availability: ${p.bestOffer.availability}, Condition: ${p.bestOffer.condition}`);
      console.log(`    Variant: ${JSON.stringify(p.bestOffer.variant)}`);
      console.log(`    Redirect URL: ${p.bestOffer.redirectUrl}`);
    } else {
      console.log(`  Best Offer: null`);
    }
  });

  // 3. Inspect Ajazz AK680 V2 specifically
  const ajazz = catalog.products.find(p => p.model === 'AK680V2' || (p.brand?.toLowerCase() === 'ajazz' && p.model === 'AK680V2'));
  if (ajazz) {
    console.log('\n--- 2. Ajazz AK680 V2 Detailed Verification ---');
    console.log(`Best Price: Rs. ${ajazz.bestOffer?.price} (Expected: 10500)`);
    console.log(`Offer Count: ${ajazz.offerCount} (Expected: 4)`);
    console.log(`Seller Count: ${ajazz.sellerCount} (Expected: 1)`);
    console.log(`Source Count: ${ajazz.sourceCount} (Expected: 1)`);
  } else {
    console.log('\n--- 2. Ajazz AK680 V2 Detailed Verification ---');
    console.log('Warning: Ajazz AK680 V2 (model: AK680V2) not found in catalog response.');
  }

  // 4. Test Single Product Read
  if (ajazz) {
    console.log('\n--- 3. Single Canonical Product Read (GET /api/canonical-products/:id) ---');
    const singleProduct = await getCanonicalProductById(ajazz.id);
    console.log(JSON.stringify(singleProduct, null, 2));
  }

  // 5. Security & Privacy Guarantee Check
  console.log('\n--- 4. Security & Privacy Audit ---');
  const catalogSerialized = JSON.stringify(catalog);
  const containsRawAffiliate = catalogSerialized.includes('affiliateUrl') || catalogSerialized.includes('network') || catalogSerialized.includes('campaign');
  console.log(`Internal Affiliate / Secret Exposure: ${containsRawAffiliate ? 'FAIL (Exposed)' : 'NO (PASSED)'}`);

  await mongoose.disconnect();
  console.log('\n=== Live Validation Finished ===');
}

runLiveValidation().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
