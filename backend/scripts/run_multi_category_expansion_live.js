const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { runMultiSourceCanonicalSync } = require('../src/catalog/multiSourceCanonicalSync');
const { getCanonicalCatalog } = require('../src/commerce/getCanonicalCatalog');
const CanonicalProduct = require('../src/models/CanonicalProduct');
const ProductOffer = require('../src/models/ProductOffer');
const Category = require('../src/models/Category');

async function runLiveMultiCategoryExpansion() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('=== Step 3E.3 — Controlled Multi-Category Canonical Catalog Expansion ===\n');

    // Ensure 5 supported category records exist
    const slugs = ['laptops', 'monitors', 'keyboards', 'mouse', 'headphones'];
    for (const slug of slugs) {
      const name = slug.charAt(0).toUpperCase() + slug.slice(1);
      let cat = await Category.findOne({ slug });
      if (!cat) {
        await Category.create({ name, slug, isActive: true });
      }
    }

    console.log('--- 1. Executing Bounded Multi-Page Sync (maxPages: 3, perPage: 10 per source) ---');
    const syncResult = await runMultiSourceCanonicalSync({
      startPage: 1,
      maxPages: 3,
      perPage: 10
    });

    console.log('\n--- 2. Source-Wise Sync Totals ---');
    console.log('EEZEPC:');
    console.log(`  Fetched: ${syncResult.sources.eezepc.fetched}, Supported: ${syncResult.sources.eezepc.supported}`);
    console.log(`  Matchable: ${syncResult.sources.eezepc.matchable}, Insufficient Identity: ${syncResult.sources.eezepc.insufficientIdentity}`);
    console.log(`  Canonical Created: ${syncResult.sources.eezepc.canonicalCreated}, Reused: ${syncResult.sources.eezepc.canonicalReused}`);
    console.log(`  Offers Created: ${syncResult.sources.eezepc.offersCreated}, Updated: ${syncResult.sources.eezepc.offersUpdated}`);
    console.log(`  Skipped (Accessories / Unmapped): ${syncResult.sources.eezepc.skipped}`);

    console.log('\nInfinity Store:');
    console.log(`  Fetched: ${syncResult.sources.infinity.fetched}, Supported: ${syncResult.sources.infinity.supported}`);
    console.log(`  Matchable: ${syncResult.sources.infinity.matchable}, Insufficient Identity: ${syncResult.sources.infinity.insufficientIdentity}`);
    console.log(`  Canonical Created: ${syncResult.sources.infinity.canonicalCreated}, Reused: ${syncResult.sources.infinity.canonicalReused}`);
    console.log(`  Offers Created: ${syncResult.sources.infinity.offersCreated}, Updated: ${syncResult.sources.infinity.offersUpdated}`);
    console.log(`  Skipped (Accessories / Unmapped): ${syncResult.sources.infinity.skipped}`);

    console.log('\n--- 3. Category-Wise Aggregates (Across Both Sources) ---');
    for (const [catName, metrics] of Object.entries(syncResult.categories)) {
      console.log(`  [${catName.toUpperCase()}]`);
      console.log(`    Fetched: ${metrics.fetched}, Matchable: ${metrics.matchable}, Insufficient Identity: ${metrics.insufficientIdentity}`);
      console.log(`    Canonical Created: ${metrics.canonicalCreated}, Reused: ${metrics.canonicalReused}`);
      console.log(`    Offers Created: ${metrics.offersCreated}, Updated: ${metrics.offersUpdated}`);
    }

    console.log('\n--- 4. Cross-Source Canonical Convergence ---');
    if (syncResult.crossSourceMatches.length > 0) {
      console.log(`Found ${syncResult.crossSourceMatches.length} Cross-Source Matches:`);
      syncResult.crossSourceMatches.forEach((m, idx) => {
        console.log(`  [${idx + 1}] Key: ${m.canonicalKey}`);
        console.log(`      Name: ${m.name}`);
        console.log(`      Brand: ${m.brand}, Model: ${m.model}`);
        console.log(`      Sources: ${m.sources.join(', ')}`);
        console.log(`      Offer Count: ${m.offerCount}, Best Price: PKR ${m.bestPrice?.toLocaleString()}`);
      });
    } else {
      console.log('No cross-source canonical convergence detected in this bounded sample.');
    }

    console.log('\n--- 5. Total Post-Sync Canonical Catalog Verification ---');
    const fullCatalog = await getCanonicalCatalog({ page: 1, limit: 100 });
    console.log(`Total Public Canonical Products: ${fullCatalog.pagination.total}`);

    // Category breakdown in public catalog
    console.log('\nCategory Breakdown (Public Catalog):');
    for (const slug of slugs) {
      const catRes = await getCanonicalCatalog({ category: slug, page: 1, limit: 100 });
      console.log(`  - ${slug}: ${catRes.pagination.total} canonical products`);
      catRes.products.forEach((p, i) => {
        console.log(`      ${i + 1}. [${p.brand}] ${p.name} (Best: PKR ${p.bestOffer?.price?.toLocaleString()} from ${p.bestOffer?.seller}, ${p.offerCount} offers)`);
      });
    }

    // Source count breakdown
    const allActiveOffers = await ProductOffer.find({ isActive: true }).lean();
    const sourceBreakdown = {};
    for (const offer of allActiveOffers) {
      const s = offer.source?.name || 'UNKNOWN';
      sourceBreakdown[s] = (sourceBreakdown[s] || 0) + 1;
    }
    console.log('\nActive ProductOffer Source Breakdown:');
    for (const [src, cnt] of Object.entries(sourceBreakdown)) {
      console.log(`  - ${src}: ${cnt} active offers`);
    }

    // Products with multiple offers and multiple sellers
    const multiOfferProducts = fullCatalog.products.filter(p => p.offerCount > 1);
    const multiSellerProducts = fullCatalog.products.filter(p => p.sellerCount > 1);
    console.log(`\nCanonical Products with Multiple Offers: ${multiOfferProducts.length}`);
    console.log(`Canonical Products with Multiple Sellers: ${multiSellerProducts.length}`);

    console.log('\n--- 6. Quality Checks & Alerts ---');
    console.log(`Missing Images Count: ${syncResult.qualityAlerts.missingImagesCount}`);
    if (syncResult.qualityAlerts.missingImagesCount > 0) {
      console.log('Products without images:', syncResult.qualityAlerts.missingImagesProducts.map(p => p.name));
    }
    console.log(`Total Insufficient Identity (Unmatchable) in this Run: ${syncResult.qualityAlerts.insufficientIdentityTotal}`);
    console.log(`Suspicious Generic Identities: ${syncResult.qualityAlerts.suspiciousIdentities.length}`);

    console.log('\n=== Live Expansion Finished Successfully ===');
  } catch (err) {
    console.error('Live expansion failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

runLiveMultiCategoryExpansion();
