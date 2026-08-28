const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const { getProductOffersComparison } = require('../src/commerce/getProductOffersComparison');

async function runLiveValidation() {
  console.log('=== Step 3E — Live Offer Comparison & Best Offer Selection Validation ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Locate Ajazz AK680 V2 Canonical Product
  const canonical = await CanonicalProduct.findOne({ canonicalKey: 'ajazz|ak680v2' });
  if (!canonical) {
    console.error('Error: ajazz|ak680v2 CanonicalProduct not found in database.');
    process.exit(1);
  }

  console.log(`Found CanonicalProduct: "${canonical.name}" (ID: ${canonical._id}, Key: ${canonical.canonicalKey})\n`);

  // 2. Full Unfiltered Offer Comparison
  console.log('--- 1. Full Comparison (No Filters) ---');
  const fullComparison = await getProductOffersComparison(canonical._id);
  console.log('Summary:', JSON.stringify(fullComparison.summary, null, 2));
  console.log('\nBest Offer Selected:');
  console.log(JSON.stringify(fullComparison.bestOffer, null, 2));
  console.log(`\nAll Ranked Offers (${fullComparison.offers.length}):`);
  fullComparison.offers.forEach((o, idx) => {
    console.log(`  ${idx + 1}. [${o.seller}] Price: Rs. ${o.price} - Color: ${o.variant?.color || 'N/A'} - Cond: ${o.condition} - Avail: ${o.availability}`);
  });

  // 3. Variant Filter: Black Contour
  console.log('\n--- 2. Variant Filter: color="Black Contour" ---');
  const blackContourComparison = await getProductOffersComparison(canonical._id, { color: 'Black Contour' });
  console.log('Summary:', JSON.stringify(blackContourComparison.summary, null, 2));
  console.log('Best Offer Selected for "Black Contour":');
  console.log(JSON.stringify(blackContourComparison.bestOffer, null, 2));

  // 4. Variant Filter: White Contour
  console.log('\n--- 3. Variant Filter: color="White Contour" ---');
  const whiteContourComparison = await getProductOffersComparison(canonical._id, { color: 'White Contour' });
  console.log('Summary:', JSON.stringify(whiteContourComparison.summary, null, 2));
  console.log('Best Offer Selected for "White Contour":');
  console.log(JSON.stringify(whiteContourComparison.bestOffer, null, 2));

  // 5. Variant Filter: Non-Existent Color
  console.log('\n--- 4. Variant Filter: color="Ruby Red" (Non-existent) ---');
  const nonExistentComparison = await getProductOffersComparison(canonical._id, { color: 'Ruby Red' });
  console.log('Summary:', JSON.stringify(nonExistentComparison.summary, null, 2));
  console.log('Best Offer Selected:', nonExistentComparison.bestOffer);
  console.log('Ranked Offers count:', nonExistentComparison.offers.length);

  // 6. Security Check
  console.log('\n--- 5. Security Check: Raw Affiliate URL Exposure ---');
  const serialized = JSON.stringify(fullComparison);
  const containsAffiliateKey = serialized.includes('affiliateUrl') || serialized.includes('campaign') || serialized.includes('network');
  console.log(`Internal Affiliate Fields Exposed in Public Response: ${containsAffiliateKey ? 'FAIL' : 'NO (PASSED)'}`);

  await mongoose.disconnect();
  console.log('\n=== Live Validation Finished ===');
}

runLiveValidation().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
