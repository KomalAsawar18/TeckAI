const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { runTargetedCategoryCanonicalSync, SOURCE_CATEGORY_CONFIG } = require('../src/catalog/targetedCategoryCanonicalSync');
const { getCanonicalCatalog } = require('../src/commerce/getCanonicalCatalog');

async function runLiveTargetedExpansion() {
  console.log('=== Step 3E.4 — Targeted Laptop & Headphone Canonical Catalog Expansion ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('1. Discovered Source Category Slugs / IDs:');
  console.log('  [EEZEPC]');
  console.log('    - Laptops: ' + JSON.stringify(SOURCE_CATEGORY_CONFIG.EEZEPC.laptops) + ' (WooCommerce Store API Parent ID: 3566, ~117 products)');
  console.log('    - Headphones: ' + JSON.stringify(SOURCE_CATEGORY_CONFIG.EEZEPC.headphones) + ' (WooCommerce Store API IDs: 9159 [Headphones], 60 [Headsets])');
  console.log('  [INFINITY_STORE]');
  console.log('    - Laptops: ' + JSON.stringify(SOURCE_CATEGORY_CONFIG.INFINITY_STORE.laptops) + ' (0 laptop categories found - peripheral specialist)');
  console.log('    - Headphones: ' + JSON.stringify(SOURCE_CATEGORY_CONFIG.INFINITY_STORE.headphones) + ' (WooCommerce Store API ID: 267 [Headphones], ~50 products)\n');

  // --- Run 1: Targeted Expansion ---
  console.log('--- 2. Executing Targeted Expansion (Run 1: maxPages=3, perPage=10 per category) ---');
  const run1 = await runTargetedCategoryCanonicalSync({
    targetCategories: ['laptops', 'headphones'],
    maxPages: 3,
    perPage: 10
  });

  console.log('\nCategory-Level Breakdown (Run 1):');
  for (const source of ['EEZEPC', 'INFINITY_STORE']) {
    for (const cat of ['laptops', 'headphones']) {
      const stats = run1.sourceResults[source][cat];
      console.log(`\n  * [${source} / ${cat}] Status: ${stats.status}`);
      console.log(`      Fetched: ${stats.fetched}, Supported: ${stats.supported}, Matchable: ${stats.matchable}`);
      console.log(`      Insufficient Identity: ${stats.insufficientIdentity}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
      console.log(`      Canonical Created: ${stats.canonicalCreated}, Canonical Reused: ${stats.canonicalReused}`);
      console.log(`      Offers Created: ${stats.offersCreated}, Offers Updated: ${stats.offersUpdated}`);
    }
  }

  console.log('\nRun 1 Summary:');
  console.log(JSON.stringify(run1.summary, null, 2));

  // --- Run 2: Idempotency Verification ---
  console.log('\n--- 3. Executing Idempotency Re-Sync Test (Run 2: Exact Same Parameters) ---');
  const run2 = await runTargetedCategoryCanonicalSync({
    targetCategories: ['laptops', 'headphones'],
    maxPages: 3,
    perPage: 10
  });

  console.log('Run 2 Summary:');
  console.log(JSON.stringify(run2.summary, null, 2));
  console.log(`Idempotency Check: Canonical Created = ${run2.summary.canonicalCreated} (Expected 0), Offers Created = ${run2.summary.offersCreated} (Expected 0), Offers Updated = ${run2.summary.offersUpdated}`);

  // --- Cross-Source Matches ---
  console.log('\n--- 4. Cross-Source Overlap Detection ---');
  if (run2.crossSourceMatches.length > 0) {
    console.log(`Found ${run2.crossSourceMatches.length} genuine cross-source match(es):`);
    run2.crossSourceMatches.forEach((m, idx) => {
      console.log(`  [Match ${idx + 1}] ${m.brand} ${m.model} (${m.name}) [Category: ${m.category}]`);
      console.log(`      CanonicalKey: ${m.canonicalKey}`);
      console.log(`      Sources (${m.sources.length}): [${m.sources.join(', ')}]`);
      m.offers.forEach(o => {
        console.log(`        - ${o.seller} (${o.source}): PKR ${o.price?.toLocaleString()}`);
      });
    });
  } else {
    console.log('No cross-source overlapping products in this bounded sample.');
  }

  // --- Public Catalog Verification ---
  console.log('\n--- 5. Public Canonical Catalog Verification ---');
  
  // Laptops
  console.log('\n>> Querying GET /api/canonical-products?category=laptops:');
  const laptopCatalog = await getCanonicalCatalog({ category: 'laptops' });
  console.log(`Total Laptops: ${laptopCatalog.pagination.total}`);
  laptopCatalog.products.forEach((p, idx) => {
    console.log(`  [Laptop ${idx + 1}] ${p.name}`);
    console.log(`      Brand: ${p.brand}, Model: ${p.model || 'N/A'}`);
    console.log(`      Best Price: ${p.bestOffer?.currency} ${p.bestOffer?.price?.toLocaleString()} from ${p.bestOffer?.seller}`);
    console.log(`      Offers: ${p.offerCount}`);
  });

  // Headphones
  console.log('\n>> Querying GET /api/canonical-products?category=headphones:');
  const headphoneCatalog = await getCanonicalCatalog({ category: 'headphones' });
  console.log(`Total Headphones: ${headphoneCatalog.pagination.total}`);
  headphoneCatalog.products.forEach((p, idx) => {
    console.log(`  [Headphone ${idx + 1}] ${p.name}`);
    console.log(`      Brand: ${p.brand}, Model: ${p.model || 'N/A'}`);
    console.log(`      Best Price: ${p.bestOffer?.currency} ${p.bestOffer?.price?.toLocaleString()} from ${p.bestOffer?.seller}`);
    console.log(`      Offers: ${p.offerCount}`);
  });

  // Overall Catalog Distribution
  console.log('\n--- 6. Final Overall Canonical Catalog Distribution ---');
  console.log(JSON.stringify(run2.catalogDistribution, null, 2));

  // Missing Images Audit
  console.log('\n--- 7. Missing Image Audit ---');
  console.log(JSON.stringify(run2.missingImages, null, 2));

  await mongoose.disconnect();
  console.log('\n=== Step 3E.4 Live Expansion Completed Successfully ===');
}

runLiveTargetedExpansion().catch(err => {
  console.error('Targeted expansion error:', err);
  process.exit(1);
});
